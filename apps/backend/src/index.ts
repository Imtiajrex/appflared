import { createAppflareHonoServer } from 'appflare-config/_generated/server/server';
import { WebSocketHibernationServer } from 'appflare-config/_generated/server/websocket-hibernation-server';
import { MONGO_DURABLE_OBJECT } from 'cloudflare-do-mongo/do';
import { getDatabase } from 'cloudflare-do-mongo';
import { Db } from 'mongodb';

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const app = createAppflareHonoServer({
			db: getDatabase(env.MONGO_DB) as any as Db,
		});
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
