import { betterAuth, type Auth, type BetterAuthOptions } from "better-auth";
import type { Context } from "hono";
import { Hono } from "hono";

export type BetterAuthHandlerOptions<
	Options extends BetterAuthOptions = BetterAuthOptions,
	Env = unknown,
> = {
	auth: Auth<Options>;
	onError?: (error: unknown, c: Context<Env>) => Response | Promise<Response>;
};

export function createBetterAuthHandler<
	Options extends BetterAuthOptions = BetterAuthOptions,
	Env = unknown,
>(options: BetterAuthHandlerOptions<Options, Env>) {
	return async (c: Context<Env>) => {
		try {
			return await options.auth.handler(getSanitizedRequest(c.req.raw));
		} catch (error) {
			if (options.onError) return options.onError(error, c);
			console.error("BetterAuth handler error", error);
			return c.json({ error: "Authentication failed" }, 500);
		}
	};
}

// Basic auth handler
export function createBetterAuthRouter<
	Options extends BetterAuthOptions = BetterAuthOptions,
	Env = unknown,
>(options: BetterAuthHandlerOptions<Options, Env>): Hono<Env> {
	const app = new Hono<Env>();
	const handler = createBetterAuthHandler(options);
	app.all("/", handler);
	app.all("/*", handler);
	return app;
}

export function initBetterAuth<Options extends BetterAuthOptions>(
	options: Options,
	kvBinding?: string,
): Auth<Options> {
	const authConfig: BetterAuthOptions = {
		...options,
	};

	// Add secondary storage if KV binding is provided
	if (kvBinding && (env as any)[kvBinding]) {
		(authConfig as any).secondaryStorage = {
			get: async (key: string) => {
				const kv = (env as any)[kvBinding];
				return await kv.get(key);
			},
			set: async (key: string, value: string, ttl?: number) => {
				const kv = (env as any)[kvBinding];
				await kv.put(key, value, ttl ? { expirationTtl: ttl } : undefined);
			},
			delete: async (key: string) => {
				const kv = (env as any)[kvBinding];
				await kv.delete(key);
			},
		};
	}

	return betterAuth(authConfig as Options);
}
export const getHeaders = (headers: Headers) => {
	const newHeaders = Object.fromEntries(headers as any);
	const headerObject: Record<string, any> = {};
	let hasCookie = false;

	for (const key in newHeaders) {
		if (key.toLowerCase() === "cookie") {
			hasCookie = true;
			break;
		}
	}

	for (const key in newHeaders) {
		const isAuthorization =
			key.toLowerCase() === "authorization" &&
			newHeaders[key]?.includes("Bearer");

		if (hasCookie && key.toLowerCase() === "authorization") {
			continue;
		}

		if (key.toLowerCase() === "authorization" && !isAuthorization) {
			continue;
		}

		headerObject[key] = newHeaders[key];
	}

	return headerObject as any as Headers;
};

export const getSanitizedRequest = (req: Request) => {
	const newRequest = new Request(req, {
		headers: getHeaders(req.headers),
	});
	return newRequest;
};
