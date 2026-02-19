import { betterAuth, type Auth, type BetterAuthOptions } from "better-auth";
import type { Context } from "hono";
import { Hono } from "hono";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";

type D1DatabaseLike = {
	prepare: (query: string) => unknown;
	batch: (statements: unknown[]) => Promise<unknown>;
};

function isD1DatabaseLike(value: unknown): value is D1DatabaseLike {
	if (!value || typeof value !== "object") return false;
	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.prepare === "function" &&
		typeof candidate.batch === "function"
	);
}

function normalizeBetterAuthDatabase(
	options: BetterAuthOptions,
): BetterAuthOptions {
	const normalized = { ...options } as BetterAuthOptions;
	const database = (normalized as any).database;

	if (isD1DatabaseLike(database)) {
		(normalized as any).database = {
			type: "sqlite",
			db: new Kysely({
				dialect: new D1Dialect({
					database: database as any,
				}),
			}),
		};
	}

	return normalized;
}

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
	bindings?: {
		env?: Record<string, unknown>;
		kvBinding?: string;
	},
): Auth<Options> {
	const authConfig: BetterAuthOptions = {
		...options,
	};

	// Add secondary storage if KV binding is provided
	const envObject = bindings?.env as Record<string, any> | undefined;
	const kvBinding = bindings?.kvBinding;
	if (kvBinding && envObject?.[kvBinding]) {
		(authConfig as any).secondaryStorage = {
			get: async (key: string) => {
				const kv = envObject[kvBinding];
				return await kv.get(key);
			},
			set: async (key: string, value: string, ttl?: number) => {
				const kv = envObject[kvBinding];
				await kv.put(key, value, ttl ? { expirationTtl: ttl } : undefined);
			},
			delete: async (key: string) => {
				const kv = envObject[kvBinding];
				await kv.delete(key);
			},
		};
	}

	const normalizedAuthConfig = normalizeBetterAuthDatabase(authConfig);

	return betterAuth(normalizedAuthConfig as Options);
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
