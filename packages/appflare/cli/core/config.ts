import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { AppflareConfig, assertFileExists } from "../utils/utils";

export async function loadConfig(
	configPathAbs: string
): Promise<{ config: AppflareConfig; configDirAbs: string }> {
	await assertFileExists(configPathAbs, `Config not found: ${configPathAbs}`);
	const configDirAbs = path.dirname(configPathAbs);

	const mod = await import(pathToFileURL(configPathAbs).href);
	const config = (mod?.default ?? mod) as Partial<AppflareConfig>;
	if (!config || typeof config !== "object") {
		throw new Error(
			`Invalid config export in ${configPathAbs} (expected default export object)`
		);
	}
	if (typeof config.dir !== "string" || !config.dir) {
		throw new Error(`Invalid config.dir in ${configPathAbs}`);
	}
	if (typeof config.schema !== "string" || !config.schema) {
		throw new Error(`Invalid config.schema in ${configPathAbs}`);
	}
	if (typeof config.outDir !== "string" || !config.outDir) {
		throw new Error(`Invalid config.outDir in ${configPathAbs}`);
	}

	const auth = (config as AppflareConfig).auth;
	if (auth !== undefined) {
		if (!auth || typeof auth !== "object") {
			throw new Error(`Invalid config.auth in ${configPathAbs}`);
		}
		if (auth.basePath !== undefined && typeof auth.basePath !== "string") {
			throw new Error(`Invalid config.auth.basePath in ${configPathAbs}`);
		}
		if (auth.enabled !== undefined && typeof auth.enabled !== "boolean") {
			throw new Error(`Invalid config.auth.enabled in ${configPathAbs}`);
		}
		if (auth.options !== undefined && typeof auth.options !== "object") {
			throw new Error(`Invalid config.auth.options in ${configPathAbs}`);
		}
	}
	return { config: config as AppflareConfig, configDirAbs };
}
