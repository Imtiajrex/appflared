import type { StorageHttpMethod, StorageRule } from "./types";

export const DEFAULT_METHODS: StorageHttpMethod[] = [
	"GET",
	"HEAD",
	"PUT",
	"POST",
	"DELETE",
	"OPTIONS",
];

export function normalizeBasePath(basePath?: string): string {
	if (!basePath) return "/storage";
	if (!basePath.startsWith("/")) return `/${basePath}`;
	return basePath;
}

export function joinPaths(base: string, route: string): string {
	const trimmedBase = base.endsWith("/") ? base.slice(0, -1) : base;
	const normalizedRoute = route.startsWith("/") ? route : `/${route}`;
	return `${trimmedBase}${normalizedRoute}`;
}

export function deriveDefaultKey(path: string, basePath: string): string {
	const normalizedBase = basePath.endsWith("/") ? basePath : `${basePath}/`;
	const withoutBase = path.startsWith(normalizedBase)
		? path.slice(normalizedBase.length)
		: path.replace(/^\/+/, "");
	return normalizeKey(withoutBase);
}

export function normalizeKey(key: string): string {
	return key.replace(/^\/+/, "").replace(/\/+/g, "/");
}

export function ensureMethods(
	methods?: StorageHttpMethod[]
): StorageHttpMethod[] {
	return methods && methods.length ? methods : DEFAULT_METHODS;
}

export function resolveCacheControl<Env, Principal>(
	rule: StorageRule<Env, Principal>,
	defaultCache: string
): string {
	return rule.cacheControl ?? defaultCache;
}
