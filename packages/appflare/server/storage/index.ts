import { Hono } from "hono";
import { createRouteHandler } from "./route-handler";
import { ensureMethods, joinPaths, normalizeBasePath } from "./utils";
import type {
	StorageHttpMethod,
	StorageManagerOptions,
	StorageRule,
} from "./types";

export function createR2StorageManager<Env = unknown, Principal = unknown>(
	options: StorageManagerOptions<Env, Principal>
): Hono<Env> {
	const basePath = normalizeBasePath(options.basePath);
	const app = new Hono<Env>();
	const defaultCache =
		options.defaultCacheControl ?? "private, max-age=0, must-revalidate";

	for (const rule of options.rules) {
		const routePath = joinPaths(basePath, rule.route ?? "");
		const methods = ensureMethods(rule.methods);

		for (const method of methods) {
			app.on(
				method,
				routePath,
				createRouteHandler(options, basePath, defaultCache, rule, method)
			);
		}
	}

	return app;
}

export type {
	StorageManagerOptions,
	StorageRule,
	StorageHttpMethod,
} from "./types";
