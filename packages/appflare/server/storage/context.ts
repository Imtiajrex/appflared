import type {
	StorageBaseContext,
	StorageKeyContext,
	StorageRule,
	StorageHttpMethod,
} from "./types";
import { deriveDefaultKey, normalizeKey } from "./utils";
import type { Context } from "hono";

export function buildBaseContext<Env, Principal>(
	params: Record<string, string>,
	method: StorageHttpMethod,
	basePath: string,
	c: Context<Env>
): StorageBaseContext<Env, Principal> {
	const wildcard = params["*"] ?? params["0"] ?? ""; // hono uses "0" for splat
	const defaultKey = deriveDefaultKey(c.req.path, basePath);
	return { c, params, wildcard, defaultKey, method };
}

export function buildKeyContext<Env, Principal>(
	ctx: StorageBaseContext<Env, Principal>,
	principal?: Principal
): StorageKeyContext<Env, Principal> {
	return { ...ctx, principal };
}

export function deriveStorageKey<Env, Principal>(
	rule: StorageRule<Env, Principal>,
	ctx: StorageKeyContext<Env, Principal>
): string {
	const key = (rule.deriveKey ?? ((keyCtx) => keyCtx.defaultKey))(ctx);
	return normalizeKey(key);
}
