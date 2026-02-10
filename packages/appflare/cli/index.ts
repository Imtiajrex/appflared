#!/usr/bin/env bun

import chokidar, { FSWatcher } from "chokidar";
import { Command } from "commander";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
	discoverHandlers,
	generateApiClient,
	generateDbHandlers,
	generateHonoServer,
	generateWebsocketDurableObject,
	generateSchedulerHandlers,
	generateCronHandlers,
} from "./core/handlers";
import {
	generateCloudflareWorkerIndex,
	generateWranglerJson,
} from "./generators/generate-cloudflare-worker";
import { generateSchemaTypes, getSchemaTableNames } from "./schema/schema";
import { runTscEmit, writeEmitTsconfig } from "./utils/tsc";
import {
	AppflareConfig,
	assertDirExists,
	assertFileExists,
	toImportPathFromGeneratedSrc,
} from "./utils/utils";

type WatchConfig = {
	targets: string[];
	ignored: string[];
};

const program = new Command();

program.name("appflare").description("Appflare CLI").version("0.0.0");

program
	.command("build")
	.description(
		"Generate typed schema + query/mutation client/server into outDir",
	)
	.option(
		"-c, --config <path>",
		"Path to appflare.config.ts",
		"appflare.config.ts",
	)
	.option("--emit", "Also run tsc to emit JS + .d.ts into outDir/dist")
	.option("-w, --watch", "Watch for changes and rebuild")
	.action(
		async (options: { config: string; emit?: boolean; watch?: boolean }) => {
			try {
				const configPath = path.resolve(process.cwd(), options.config);

				if (options.watch) {
					await watchAndBuild({
						configPathAbs: configPath,
						emit: Boolean(options.emit),
					});
					return;
				}

				const { config, configDirAbs } = await loadConfig(configPath);
				await buildFromConfig({
					config,
					configDirAbs,
					configPathAbs: configPath,
					emit: Boolean(options.emit),
				});
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				console.error(message);
				process.exitCode = 1;
			}
		},
	);

void main();

async function main(): Promise<void> {
	await program.parseAsync(process.argv);
}

/**
 * Regex that matches ES import lines pulling in React Native / Expo native
 * modules (e.g. `import * as SecureStore from "expo-secure-store"`).
 * These cannot be transpiled by Bun and are only needed at client runtime.
 */
const NATIVE_IMPORT_RE =
	/^import\s+(?:(?:\*\s+as\s+(\w+))|(?:\{[^}]*\})|(?:(\w+)(?:\s*,\s*\{[^}]*\})?))?\s*from\s*["'](expo-[^"']+)["'];?\s*$/gm;

/**
 * Strip native-module imports from a config source and replace them with
 * harmless stub declarations so the CLI can evaluate the config object
 * without triggering Bun transpilation errors on native code.
 */
function sanitizeConfigSource(source: string): string {
	const stubs: string[] = [];
	const sanitized = source.replace(
		NATIVE_IMPORT_RE,
		(_match, starAs, defaultImport, _mod) => {
			const name = starAs || defaultImport;
			if (name) {
				stubs.push(`const ${name} = {} as any;`);
			}
			return ""; // remove the original import line
		},
	);
	return stubs.length > 0 ? stubs.join("\n") + "\n" + sanitized : sanitized;
}

async function loadConfig(
	configPathAbs: string,
): Promise<{ config: AppflareConfig; configDirAbs: string }> {
	await assertFileExists(configPathAbs, `Config not found: ${configPathAbs}`);
	const configDirAbs = path.dirname(configPathAbs);

	// Read the config source and strip native-module imports (e.g. expo-secure-store)
	// that Bun cannot transpile. Write the sanitized source to a temp file and import that.
	const raw = await fs.readFile(configPathAbs, "utf-8");
	const sanitized = sanitizeConfigSource(raw);

	let mod: Record<string, unknown>;
	if (sanitized !== raw) {
		const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "appflare-cfg-"));
		const tmpFile = path.join(tmpDir, path.basename(configPathAbs));
		await fs.writeFile(tmpFile, sanitized);
		try {
			mod = await import(pathToFileURL(tmpFile).href);
		} finally {
			await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
		}
	} else {
		mod = await import(pathToFileURL(configPathAbs).href);
	}

	const config = (mod?.default ?? mod) as Partial<AppflareConfig>;
	if (!config || typeof config !== "object") {
		throw new Error(
			`Invalid config export in ${configPathAbs} (expected default export object)`,
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
	if (
		config.wranglerOutPath !== undefined &&
		(typeof config.wranglerOutPath !== "string" || !config.wranglerOutPath)
	) {
		throw new Error(`Invalid config.wranglerOutPath in ${configPathAbs}`);
	}
	if (
		config.wranglerMain !== undefined &&
		(typeof config.wranglerMain !== "string" || !config.wranglerMain)
	) {
		throw new Error(`Invalid config.wranglerMain in ${configPathAbs}`);
	}
	return { config: config as AppflareConfig, configDirAbs };
}

async function buildFromConfig(params: {
	config: AppflareConfig;
	configDirAbs: string;
	configPathAbs: string;
	emit: boolean;
}): Promise<void> {
	const { config, configDirAbs, emit, configPathAbs } = params;

	const projectDirAbs = path.resolve(configDirAbs, config.dir);
	const schemaPathAbs = path.resolve(configDirAbs, config.schema);
	const outDirAbs = path.resolve(configDirAbs, config.outDir);

	await assertDirExists(
		projectDirAbs,
		`Project dir not found: ${projectDirAbs}`,
	);
	await assertFileExists(schemaPathAbs, `Schema not found: ${schemaPathAbs}`);

	await fs.mkdir(path.join(outDirAbs, "src"), { recursive: true });
	await fs.mkdir(path.join(outDirAbs, "server"), { recursive: true });

	// Re-export the user schema inside the generated output so downstream code can import it from the build directory.
	const schemaImportPathForGeneratedSrc = toImportPathFromGeneratedSrc(
		outDirAbs,
		schemaPathAbs,
	);
	const schemaReexport = `import schema from ${JSON.stringify(schemaImportPathForGeneratedSrc)};
export type AppflareGeneratedSchema = typeof schema;
export default schema;
`;
	await fs.writeFile(path.join(outDirAbs, "src", "schema.ts"), schemaReexport);

	const schemaTypesTs = await generateSchemaTypes({
		schemaPathAbs,
		configPathAbs,
		outDirAbs,
	});
	await fs.writeFile(
		path.join(outDirAbs, "src", "schema-types.ts"),
		schemaTypesTs,
	);

	// (Re)generate built-in DB handlers based on the schema tables.
	const schemaTableNames = await getSchemaTableNames(schemaPathAbs);
	await generateDbHandlers({ outDirAbs, tableNames: schemaTableNames });

	const handlers = await discoverHandlers({
		projectDirAbs,
		schemaPathAbs,
		outDirAbs,
		configPathAbs,
	});

	const apiTs = generateApiClient({
		handlers,
		outDirAbs,
		authBasePath:
			config.auth && config.auth.enabled === false
				? undefined
				: (config.auth?.basePath ?? "/auth"),
		authEnabled: config.auth?.enabled !== false,
		configPathAbs,
	});
	await fs.writeFile(path.join(outDirAbs, "src", "api.ts"), apiTs);

	const serverTs = generateHonoServer({
		handlers,
		outDirAbs,
		schemaPathAbs,
		configPathAbs,
		config,
	});
	await fs.writeFile(path.join(outDirAbs, "server", "server.ts"), serverTs);

	const websocketDoTs = generateWebsocketDurableObject({
		handlers,
		outDirAbs,
		schemaPathAbs,
		configPathAbs,
		config,
	});
	await fs.writeFile(
		path.join(outDirAbs, "server", "websocket-hibernation-server.ts"),
		websocketDoTs,
	);

	const schedulerTs = generateSchedulerHandlers({
		handlers,
		outDirAbs,
		schemaPathAbs,
		configPathAbs,
	});
	await fs.writeFile(
		path.join(outDirAbs, "server", "scheduler.ts"),
		schedulerTs,
	);

	const cronHandlersPresent = handlers.some(
		(handler) => handler.kind === "cron",
	);
	const { code: cronTs, cronTriggers } = generateCronHandlers({
		handlers,
		outDirAbs,
		schemaPathAbs,
		configPathAbs,
	});
	await fs.writeFile(path.join(outDirAbs, "server", "cron.ts"), cronTs);

	const allowedOrigins = normalizeAllowedOrigins(
		process.env.APPFLARE_ALLOWED_ORIGINS ??
			config.corsOrigin ??
			"http://localhost:3000",
	);
	const workerIndexTs = generateCloudflareWorkerIndex({
		allowedOrigins,
		hasCronHandlers: cronHandlersPresent,
	});
	await fs.writeFile(path.join(outDirAbs, "server", "index.ts"), workerIndexTs);

	const wranglerJson = generateWranglerJson({
		config,
		configDirAbs,
		allowedOrigins,
		cronTriggers,
	});
	const wranglerOutPath =
		config.wranglerOutPath ?? path.join(config.outDir, "wrangler.json");
	const wranglerOutAbs = path.resolve(configDirAbs, wranglerOutPath);
	await fs.mkdir(path.dirname(wranglerOutAbs), { recursive: true });
	await fs.writeFile(wranglerOutAbs, wranglerJson);

	if (emit) {
		// Remove previous emit output to avoid stale files lingering.
		await fs.rm(path.join(outDirAbs, "dist"), { recursive: true, force: true });

		// Emit only the files that don't pull in user code outside rootDir.
		// This avoids TS rootDir issues and dist overwrite issues caused by user modules.
		const emitTsconfigAbs = await writeEmitTsconfig({
			configDirAbs,
			outDirAbs,
		});
		await runTscEmit(emitTsconfigAbs);
	}
}

async function watchAndBuild(params: {
	configPathAbs: string;
	emit: boolean;
}): Promise<void> {
	let watcher: FSWatcher | undefined;
	let lastWatchConfig: WatchConfig | undefined;
	let isBuilding = false;
	let pendingBuild = false;
	let closed = false;

	const closeWatcher = async () => {
		if (!watcher) return;
		await watcher.close();
		watcher = undefined;
	};

	const applyWatchConfig = async (config: WatchConfig) => {
		const normalized = normalizeWatchConfig(config);
		if (watchConfigsEqual(lastWatchConfig, normalized)) return;

		await closeWatcher();
		watcher = chokidar.watch(normalized.targets, {
			ignored: normalized.ignored,
			ignoreInitial: true,
			persistent: true,
		});

		watcher.on("all", (_event, filePath) => {
			const rel = path.relative(process.cwd(), filePath) || filePath;
			console.log(`[appflare] change detected: ${rel}`);
			scheduleBuild();
		});

		lastWatchConfig = normalized;
		console.log(
			`[appflare] watching ${normalized.targets.length} path(s) (ignoring ${normalized.ignored.length})`,
		);
	};

	const scheduleBuild = () => {
		if (isBuilding) {
			pendingBuild = true;
			return;
		}
		void runBuild();
	};

	const runBuild = async () => {
		isBuilding = true;
		const startedAt = Date.now();
		try {
			const { config, configDirAbs } = await loadConfig(params.configPathAbs);
			await applyWatchConfig(
				computeWatchConfig({
					config,
					configDirAbs,
					configPathAbs: params.configPathAbs,
				}),
			);
			console.log("[appflare] build started");
			await buildFromConfig({
				config,
				configDirAbs,
				configPathAbs: params.configPathAbs,
				emit: params.emit,
			});
			const elapsed = Date.now() - startedAt;
			console.log(`[appflare] build finished in ${elapsed}ms`);
		} catch (err) {
			const message =
				err instanceof Error ? (err.stack ?? err.message) : String(err);
			console.error(`[appflare] build failed: ${message}`);
		} finally {
			isBuilding = false;
			if (pendingBuild && !closed) {
				pendingBuild = false;
				scheduleBuild();
			}
		}
	};

	const handleExit = async () => {
		closed = true;
		await closeWatcher();
	};

	process.once("SIGINT", handleExit);
	process.once("SIGTERM", handleExit);

	await runBuild();
}

function computeWatchConfig(params: {
	config: AppflareConfig;
	configDirAbs: string;
	configPathAbs: string;
}): WatchConfig {
	const { config, configDirAbs, configPathAbs } = params;
	const projectDirAbs = path.resolve(configDirAbs, config.dir);
	const schemaPathAbs = path.resolve(configDirAbs, config.schema);
	const outDirAbs = path.resolve(configDirAbs, config.outDir);

	return {
		targets: [projectDirAbs, schemaPathAbs, configPathAbs],
		ignored: [
			outDirAbs,
			path.join(outDirAbs, "**"),
			path.join(projectDirAbs, "node_modules/**"),
			path.join(projectDirAbs, "dist/**"),
			path.join(projectDirAbs, "build/**"),
			"**/node_modules/**",
			"**/.git/**",
			"**/dist/**",
			"**/build/**",
		],
	};
}

function normalizeWatchConfig(config: WatchConfig): WatchConfig {
	const normalizeList = (list: string[]): string[] =>
		[
			...new Set(
				list.map((item) => (hasGlob(item) ? item : path.resolve(item))),
			),
		].sort();

	return {
		targets: normalizeList(config.targets),
		ignored: normalizeList(config.ignored),
	};
}

function watchConfigsEqual(a?: WatchConfig, b?: WatchConfig): boolean {
	if (!a || !b) return false;
	return arraysEqual(a.targets, b.targets) && arraysEqual(a.ignored, b.ignored);
}

function arraysEqual(a: string[], b: string[]): boolean {
	return a.length === b.length && a.every((value, index) => value === b[index]);
}

function hasGlob(value: string): boolean {
	return value.includes("*") || value.includes("?") || value.includes("[");
}

function normalizeAllowedOrigins(origins: string | string[]): string[] {
	const list = Array.isArray(origins) ? origins : origins.split(",");
	return list.map((origin) => origin.trim()).filter(Boolean);
}
