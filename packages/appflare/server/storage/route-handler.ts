import { authorizeRequest } from "./auth";
import { resolveBucket } from "./bucket";
import { buildBaseContext, buildKeyContext, deriveStorageKey } from "./context";
import { executeOperation } from "./operations";
import type {
	RouteHandler,
	StorageHttpMethod,
	StorageManagerOptions,
	StorageRule,
} from "./types";
import { resolveCacheControl } from "./utils";
import type { Context } from "hono";

export function createRouteHandler<Env, Principal>(
	options: StorageManagerOptions<Env, Principal>,
	basePath: string,
	defaultCache: string,
	rule: StorageRule<Env, Principal>,
	method: StorageHttpMethod
): RouteHandler<Env> {
	return async (c: Context<Env>) => {
		const params = c.req.param();
		const baseCtx = buildBaseContext<Env, Principal>(
			params,
			method,
			basePath,
			c
		);

		try {
			if (method === "OPTIONS") {
				return new Response(null, { status: 204 });
			}
			const bucket = await resolveBucket(c, rule, options);
			const auth = await authorizeRequest(baseCtx, rule);
			if (auth.allow === false) {
				return c.json(
					{ error: auth.message ?? "Unauthorized" },
					(auth.status as any) ?? 403
				);
			}

			const keyCtx = buildKeyContext(baseCtx, auth.principal);
			const key = deriveStorageKey(rule, keyCtx);
			const cacheControl = resolveCacheControl(rule, defaultCache);

			return executeOperation({
				method,
				bucket,
				key,
				cacheControl,
				ctx: keyCtx,
				rule,
			});
		} catch (err) {
			console.error("R2 storage manager error", err);
			return c.json({ error: "Storage operation failed" }, 500);
		}
	};
}
