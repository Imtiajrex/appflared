import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export type ConfigModuleOptions = {
	displayPath?: string;
};

export function resolveConfigPathFromArgs(
	argv: string[] = process.argv
): string {
	const configPathArg = argv[2];
	if (!configPathArg) {
		throw new Error(
			"Missing config file path. Pass the path to appflare.config.ts, e.g. `pnpm appflare db-build packages/appflare-config/appflare.config.ts`."
		);
	}
	return resolve(process.cwd(), configPathArg);
}

export async function importConfigModule<TConfig extends object>(
	configFile: string,
	options: ConfigModuleOptions = {}
): Promise<TConfig> {
	const moduleUrl = pathToFileURL(configFile).href;
	const imported = await import(moduleUrl);
	const config = imported.default;
	if (!config || typeof config !== "object") {
		const displayPath = options.displayPath ?? configFile;
		throw new Error(
			`Config at ${displayPath} does not export a default config object.`
		);
	}
	return config as TConfig;
}
