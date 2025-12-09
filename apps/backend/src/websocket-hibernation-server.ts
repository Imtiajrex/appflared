import { DurableObject } from 'cloudflare:workers';
import { getDatabase } from 'cloudflare-do-mongo';
import { buildUserFilter, matchesUserQuery, parseUserQueryParams, type UserQuery } from './query-utils';

type MutationPayload = {
	type?: 'create' | 'update' | 'delete';
	document?: Record<string, unknown>;
};

export class WebSocketHibernationServer extends DurableObject {
	env: Env;
	private subscriptions: Map<WebSocket, UserQuery>;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.env = env;
		this.subscriptions = new Map();

		// Rehydrate any hibernated sockets so existing subscriptions survive restarts.
		for (const socket of this.ctx.getWebSockets()) {
			const attachment = socket.deserializeAttachment() as UserQuery | undefined;
			if (attachment) {
				this.subscriptions.set(socket, attachment);
			}
		}

		this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const { pathname, searchParams } = url;
		const isWebSocket = request.headers.get('Upgrade') === 'websocket';

		if (isWebSocket && pathname === '/ws') {
			const parsed = parseUserQueryParams(searchParams);
			if (!parsed.success) {
				return new Response(parsed.error.message, { status: 400 });
			}

			const { 0: client, 1: server } = Object.values(new WebSocketPair());
			this.ctx.acceptWebSocket(server);
			server.serializeAttachment(parsed.data);
			this.subscriptions.set(server, parsed.data);
			server.send(JSON.stringify({ type: 'subscribed', query: parsed.data }));

			return new Response(null, { status: 101, webSocket: client });
		}

		if (pathname === '/notify-mutation' && request.method === 'POST') {
			const body = (await request.json().catch(() => null)) as MutationPayload | null;
			if (!body) {
				return new Response('Invalid mutation payload', { status: 400 });
			}
			console.log(body);
			await this.broadcastForMutation(body.document ?? body);
			return new Response('ok', { status: 200 });
		}

		return new Response('Not found', { status: 404 });
	}

	async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
		// Lightweight ping/pong support to keep connections alive.
		if (typeof message === 'string' && message.toLowerCase() === 'ping') {
			ws.send('pong');
			return;
		}
		ws.send(`[Durable Object] message: ${message}, connections: ${this.ctx.getWebSockets().length}`);
	}

	async webSocketClose(ws: WebSocket): Promise<void> {
		console.log('WebSocket closed');
		this.subscriptions.delete(ws);
	}

	private async broadcastForMutation(document: Record<string, unknown>): Promise<void> {
		if (!document || typeof document !== 'object') {
			return;
		}

		const matchingSockets = Array.from(this.subscriptions.entries()).filter(([, query]) => matchesUserQuery(query, document));
		console.log(`Found ${matchingSockets.length} matching sockets for mutation notification.`);
		console.log(this.subscriptions.entries());
		if (matchingSockets.length === 0) {
			return;
		}

		const queriesToFetch = new Map<string, UserQuery>();
		for (const [, query] of matchingSockets) {
			const key = JSON.stringify(query);
			if (!queriesToFetch.has(key)) {
				queriesToFetch.set(key, query);
			}
		}

		const resultCache = new Map<string, unknown[]>();
		for (const [key, query] of queriesToFetch) {
			const data = await this.runQuery(query);
			resultCache.set(key, data);
		}

		for (const [socket, query] of matchingSockets) {
			const key = JSON.stringify(query);
			const data = resultCache.get(key) ?? [];
			try {
				socket.send(
					JSON.stringify({
						type: 'data',
						query,
						data,
					}),
				);
			} catch (err) {
				socket.close(1011, 'send failed');
				console.error('Failed to send data to websocket, closing connection.', err);
				this.subscriptions.delete(socket);
			}
		}
	}

	private async runQuery(query: UserQuery): Promise<unknown[]> {
		const collection = getDatabase(this.env.MONGO_DB).collection('users');
		const cursor = collection.find(buildUserFilter(query));
		return cursor.toArray();
	}
}
