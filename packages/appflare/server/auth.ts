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

import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { getDatabase } from "cloudflare-do-mongo";
import { env } from "cloudflare:workers";
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
	options: Options
): Auth<Options> {
	return betterAuth({
		...options,
		database: mongodbAdapter(getDatabase((env as any).MONGO_DB) as any),
	});
}

export const getHeaders = (headers: Headers) => {
	const newHeaders = Object.fromEntries(headers as any);
	const headerObject: Record<string, any> = {};
	for (const key in newHeaders) {
		const isAuthorization =
			key.toLowerCase() === "authorization" && newHeaders[key]?.Length > 7;
		if (isAuthorization) {
			if (key !== "cookie") {
				headerObject[key] = newHeaders[key];
			}
		} else {
			if (key !== "authorization") {
				headerObject[key] = newHeaders[key];
			}
		}
	}

	return headerObject as any as Headers;
};
export const getSanitizedRequest = (req: Request) => {
	const newRequest = new Request(req, {
		headers: getHeaders(req.headers),
	});
	return newRequest;
};
