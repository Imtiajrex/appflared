import type { Context } from "hono";
import type { R2Bucket } from "@cloudflare/workers-types";

export type StorageHttpMethod =
	| "GET"
	| "HEAD"
	| "PUT"
	| "POST"
	| "DELETE"
	| "OPTIONS";
export type Awaitable<T> = T | Promise<T>;

export type StorageAuthResult<Principal = unknown> =
	| { allow: true; principal?: Principal }
	| { allow: false; status?: number; message?: string };

export type StorageBaseContext<Env, Principal> = {
	c: Context<Env>;
	params: Record<string, string>;
	wildcard: string;
	defaultKey: string;
	method: StorageHttpMethod;
};

export type StorageKeyContext<Env, Principal> = StorageBaseContext<
	Env,
	Principal
> & {
	principal?: Principal;
};

export type BucketResolver<Env> = (c: Context<Env>) => Awaitable<R2Bucket>;

export type StorageRule<Env = unknown, Principal = unknown> = {
	route?: string;
	methods?: StorageHttpMethod[];
	deriveKey?: (ctx: StorageKeyContext<Env, Principal>) => string;
	authorize?: (
		ctx: StorageBaseContext<Env, Principal>
	) => Awaitable<StorageAuthResult<Principal>>;
	getBucket?: BucketResolver<Env>;
	maxSizeBytes?: number;
	cacheControl?: string;
	contentType?: (ctx: StorageKeyContext<Env, Principal>) => string | undefined;
};

export type StorageManagerOptions<Env = unknown, Principal = unknown> = {
	basePath?: string;
	rules: StorageRule<Env, Principal>[];
	defaultCacheControl?: string;
	bucketBinding?: string;
	getBucket?: BucketResolver<Env>;
};

export type RouteHandler<Env> = (c: Context<Env>) => Promise<Response>;
