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

		const authConfig = (appflareConfig as any).auth;
		const authOptions = authConfig?.options as BetterAuthOptions | undefined;
		const allowedOrigins = 'http://localhost:3000'
			.split(',')
			.map((origin) => origin.trim())
			.filter(Boolean);
		const resolveCorsOrigin = (origin: string | undefined | null) => (origin && allowedOrigins.includes(origin) ? origin : undefined);

		const app = createAppflareHonoServer({
			db: getDatabase(env.MONGO_DB) as unknown as Db,
			corsOrigin: allowedOrigins,
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
		const authCors = cors({
			origin: resolveCorsOrigin,
			credentials: true,
			allowMethods: ['GET', 'POST', 'OPTIONS'],
			allowHeaders: ['Content-Type', 'Authorization', 'Cookie'],
			exposeHeaders: ['set-cookie'],
		});
		app.use(
			'*',
			cors({
				origin: resolveCorsOrigin,
				credentials: true,
				allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
				allowHeaders: ['Content-Type', 'Authorization', 'Cookie'],
				exposeHeaders: ['set-cookie'],
			}),
		);

		const origin = request.headers.get('Origin');
		const allowedOrigin = resolveCorsOrigin(origin);
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				status: 204,
				headers: {
					'Access-Control-Allow-Origin': allowedOrigin ?? '',
					'Access-Control-Allow-Credentials': 'true',
					'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
					'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') ?? 'Content-Type, Authorization, Cookie',
					Vary: 'Origin',
				},
			});
		}
		const authRouter =
			authConfig && authConfig.enabled !== false && authOptions
				? createBetterAuthRouter<BetterAuthOptions, WorkerEnv>({
						// initBetterAuth will throw if required options (adapter/providers) are missing
						auth: initBetterAuth(authOptions),
					})
				: undefined;
		if (authRouter) {
			const authBasePath = authConfig.basePath ?? '/auth';
			app.use(`${authBasePath}/*`, authCors);
			app.route(authBasePath, authRouter);
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

		const response = await app.fetch(request, env, ctx);
		if (allowedOrigin) {
			response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
			response.headers.set('Access-Control-Allow-Credentials', 'true');
			response.headers.append('Vary', 'Origin');
		}
		return response;
	},
} satisfies ExportedHandler<Env>;

export { MONGO_DURABLE_OBJECT, WebSocketHibernationServer };
