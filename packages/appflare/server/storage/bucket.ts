import type { Context } from "hono";
import type { R2Bucket } from "@cloudflare/workers-types";
import type { StorageManagerOptions, StorageRule } from "./types";

export function resolveBucket<Env, Principal>(
	c: Context<Env>,
	rule: StorageRule<Env, Principal>,
	opts: StorageManagerOptions<Env, Principal>
): Promise<R2Bucket> {
	const resolver = rule.getBucket ?? opts.getBucket;
	if (resolver) return Promise.resolve(resolver(c));
	if (opts.bucketBinding) {
		const bucket = (c.env as any)?.[opts.bucketBinding];
		if (!bucket) {
			throw new Error(
				`Bucket binding ${opts.bucketBinding} was not found on the worker env.`
			);
		}
		return Promise.resolve(bucket as R2Bucket);
	}
	throw new Error("Storage manager requires getBucket or bucketBinding.");
}
