import { MONGO_DURABLE_OBJECT } from 'cloudflare-do-mongo/do';
import app from './hono';
import { WebSocketHibernationServer } from './websocket-hibernation-server';

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const upgradeHeader = request.headers.get('Upgrade');
		if (upgradeHeader === 'websocket') {
			const url = new URL(request.url);
			if (url.pathname === '/ws') {
				const id = env.WEBSOCKET_HIBERNATION_SERVER.idFromName('primary');
				const stub = env.WEBSOCKET_HIBERNATION_SERVER.get(id);
				return stub.fetch(request);
			}
		}

		return app.fetch(request, env, ctx);
	},
} satisfies ExportedHandler<Env>;

export { MONGO_DURABLE_OBJECT, WebSocketHibernationServer };
