import type { BetterAuthOptions } from 'better-auth';
import { createAppflareHonoServer } from 'appflare-config/_generated/server/server';
import { WebSocketHibernationServer } from 'appflare-config/_generated/server/websocket-hibernation-server';
import { MONGO_DURABLE_OBJECT } from 'cloudflare-do-mongo/do';
import { getDatabase } from 'cloudflare-do-mongo';
import { Db } from 'mongodb';
import { createR2StorageManager } from 'appflare/server/storage';
import type { Hono } from 'hono';
import { cors } from 'hono/cors';
import appflareConfig from 'appflare-config/appflare.config';
import { createBetterAuthRouter, initBetterAuth } from 'appflare/server/auth';

export default {
	async fetch(request, env, ctx): Promise<Response> {
		type WorkerEnv = { Bindings: Env };

		const app = createAppflareHonoServer({
			db: getDatabase(env.MONGO_DB) as unknown as Db,
			realtime: {
				durableObject: env.WEBSOCKET_HIBERNATION_SERVER,
				durableObjectName: 'primary',
				notify: async (payload) => {
					const id = env.WEBSOCKET_HIBERNATION_SERVER.idFromName('primary');
					const stub = env.WEBSOCKET_HIBERNATION_SERVER.get(id);
					await stub.fetch('http://appflare-realtime/notify', {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify(payload),
					});
				},
			},
		}) as unknown as Hono<WorkerEnv>;

		const authConfig = (appflareConfig as any).auth;
		const authOptions = authConfig?.options as BetterAuthOptions | undefined;
		const authRouter =
			authConfig && authConfig.enabled !== false && authOptions
				? createBetterAuthRouter<BetterAuthOptions, WorkerEnv>({
						// initBetterAuth will throw if required options (adapter/providers) are missing
						auth: initBetterAuth(authOptions),
					})
				: undefined;
		if (authRouter) {
			app.route(authConfig.basePath ?? '/auth', authRouter);
		}

		const storageManager = createR2StorageManager<WorkerEnv>({
			bucketBinding: 'APPFLARE_STORAGE',
			rules: [
				{
					route: '/readonly',
					methods: ['GET', 'HEAD'],
					cacheControl: 'public, max-age=300',
				},
				{
					route: '/readonly',
					methods: ['PUT', 'POST', 'DELETE'],
					authorize: () => ({ allow: false, status: 405, message: 'Read-only bucket' }),
				},
				{
					route: '/readonly/*',
					methods: ['GET', 'HEAD'],
					cacheControl: 'public, max-age=300',
				},
				{
					route: '/readonly/*',
					methods: ['PUT', 'POST', 'DELETE'],
					authorize: () => ({ allow: false, status: 405, message: 'Read-only bucket' }),
				},
				{
					route: '/json/*',
					contentType: () => 'application/json',
				},
				{
					route: '/uploads/*',
					maxSizeBytes: 512 * 1024,
				},
				{
					route: '/users/:userId/*',
					authorize: ({ params, c }) => {
						const userId = params.userId;
						const headerUser = c.req.header('x-user-id');
						if (headerUser && headerUser === userId) {
							return { allow: true, principal: headerUser };
						}
						return {
							allow: false,
							status: 401,
							message: 'x-user-id header required for user bucket',
						};
					},
					deriveKey: ({ params, wildcard }) => `${params.userId}/${wildcard || 'root'}`,
					cacheControl: 'private, max-age=0, must-revalidate',
				},
				{
					// catch-all fallback must be last so more specific rules win
					route: '/*',
				},
			],
			basePath: '/storage',
		});

		app.use('/storage/*', cors({ origin: '*', allowHeaders: ['*'], allowMethods: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'OPTIONS'] }));
		app.route('/', storageManager);

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
