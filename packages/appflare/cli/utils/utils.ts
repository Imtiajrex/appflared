import { promises as fs } from "node:fs";
import path from "node:path";
import type { BetterAuthOptions } from "better-auth";
import type { StorageManagerOptions } from "../../server/storage/types";

export type AppflareAuthConfig<
	Options extends BetterAuthOptions = BetterAuthOptions,
> = {
	enabled?: boolean;
	basePath?: string;
	options?: Options;
};

export type AppflareStorageConfig<
	Env = unknown,
	Principal = unknown,
> = StorageManagerOptions<Env, Principal>;

export type AppflareSchedulerConfig = {
	/** Set to false to disable scheduler generation. */
	enabled?: boolean;
	/** Optional Cloudflare Queue binding name. Defaults to APPFLARE_SCHEDULER_QUEUE. */
	queueBinding?: string;
	/** Optional Cloudflare Queue name. Defaults to a sanitized worker name with -scheduler suffix. */
	queueName?: string;
};

export type AppflareConfig<
	Options extends BetterAuthOptions = BetterAuthOptions,
> = {
	dir: string;
	schema: string;
	outDir: string;
	/** Optional override for where wrangler.json is written. Resolved relative to the config file. */
	wranglerOutPath?: string;
	/** Optional override for wrangler.json main entrypoint. Defaults to ./server/index.ts in the generated worker. */
	wranglerMain?: string;
	/** Optional override for wrangler.json compatibility_date. Defaults to current date. */
	wranglerCompatibilityDate?: string;
	/** Optional CORS whitelist for generated Worker entrypoint. */
	corsOrigin?: string | string[];
	auth?: AppflareAuthConfig<Options>;
	storage?: AppflareStorageConfig;
	scheduler?: AppflareSchedulerConfig;
};

export type HandlerKind =
	| "query"
	| "mutation"
	| "internalQuery"
	| "internalMutation"
	| "scheduler"
	| "cron"
	| "http";

export type DiscoveredHandler = {
	fileName: string;
	/** Path relative to project root without .ts extension, using forward slashes. */
	routePath: string;
	name: string;
	kind: HandlerKind;
	sourceFileAbs: string;
	cronTriggers?: string[];
};

export function pascalCase(value: string): string {
	return value
		.replace(/(^|[^A-Za-z0-9]+)([A-Za-z0-9])/g, (_, __, c: string) =>
			c.toUpperCase()
		)
		.replace(/[^A-Za-z0-9]/g, "");
}

export function isValidIdentifier(value: string): boolean {
	return /^[A-Za-z_$][\w$]*$/.test(value);
}

export function groupBy<T, TKey>(
	items: T[],
	keyFn: (item: T) => TKey
): Map<TKey, T[]> {
	const map = new Map<TKey, T[]>();
	for (const item of items) {
		const key = keyFn(item);
		if (map.has(key)) {
			map.get(key)!.push(item);
		} else {
			map.set(key, [item]);
		}
	}
	return map;
}

export function toImportPathFromGeneratedSrc(
	outDirAbs: string,
	fileAbs: string
): string {
	const fromDir = path.join(outDirAbs, "src");
	let rel = path.relative(fromDir, fileAbs);
	rel = rel.replace(/\\/g, "/");
	rel = rel.replace(/\.ts$/, "");
	if (!rel.startsWith(".")) {
		rel = `./${rel}`;
	}
	return rel;
}

export function toImportPathFromGeneratedServer(
	outDirAbs: string,
	fileAbs: string
): string {
	const fromDir = path.join(outDirAbs, "server");
	let rel = path.relative(fromDir, fileAbs);
	rel = rel.replace(/\\/g, "/");
	rel = rel.replace(/\.ts$/, "");
	if (!rel.startsWith(".")) {
		rel = `./${rel}`;
	}
	return rel;
}

export async function assertFileExists(
	fileAbs: string,
	message: string
): Promise<void> {
	const ok = await fileExists(fileAbs);
	if (!ok) throw new Error(message);
}

export async function assertDirExists(
	dirAbs: string,
	message: string
): Promise<void> {
	try {
		const stat = await fs.stat(dirAbs);
		if (!stat.isDirectory()) throw new Error(message);
	} catch {
		throw new Error(message);
	}
}

export async function fileExists(fileAbs: string): Promise<boolean> {
	try {
		const stat = await fs.stat(fileAbs);
		return stat.isFile();
	} catch {
		return false;
	}
}

export async function walkTsFiles(
	rootAbs: string,
	ignoreDirs: Set<string>
): Promise<string[]> {
	const out: string[] = [];
	const entries = await fs.readdir(rootAbs, { withFileTypes: true });
	for (const entry of entries) {
		const abs = path.join(rootAbs, entry.name);
		if (entry.isDirectory()) {
			if (ignoreDirs.has(entry.name)) continue;
			out.push(...(await walkTsFiles(abs, ignoreDirs)));
			continue;
		}
		if (
			entry.isFile() &&
			entry.name.endsWith(".ts") &&
			!entry.name.endsWith(".d.ts")
		) {
			out.push(abs);
		}
	}
	return out;
}
