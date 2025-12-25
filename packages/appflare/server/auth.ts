import { betterAuth, type Auth, type BetterAuthOptions } from "better-auth";
import { Hono } from "hono";
import type { Context } from "hono";

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
			return await options.auth.handler(c.req.raw);
		} catch (error) {
			if (options.onError) return options.onError(error, c);
			console.error("BetterAuth handler error", error);
			return c.json({ error: "Authentication failed" }, 500);
		}
	};
}

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
	return betterAuth(options);
}
