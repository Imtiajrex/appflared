#!/usr/bin/env bun

import { Command } from "commander";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
	discoverHandlers,
	generateApiClient,
	generateDbHandlers,
	generateHonoServer,
	generateWebsocketDurableObject,
} from "./handlers";
import { generateSchemaTypes, getSchemaTableNames } from "../schema/schema";
import { runTscEmit, writeEmitTsconfig } from "../utils/tsc";
import { assertDirExists, assertFileExists } from "../utils/utils";

type AppflareConfig = {
	dir: string;
	schema: string;
	outDir: string;
};

const program = new Command();

program.name("appflare").description("Appflare CLI").version("0.0.0");

program
	.command("build")
	.description(
		"Generate typed schema + query/mutation client/server into outDir"
	)
	.option(
		"-c, --config <path>",
		"Path to appflare.config.ts",
		"appflare.config.ts"
	)
	.option("--emit", "Also run tsc to emit JS + .d.ts into outDir/dist")
	.action(async (options: { config: string; emit?: boolean }) => {
		try {
			const configPath = path.resolve(process.cwd(), options.config);
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
	});

void main();

async function main(): Promise<void> {
	await program.parseAsync(process.argv);
}

async function loadConfig(
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
		`Project dir not found: ${projectDirAbs}`
	);
	await assertFileExists(schemaPathAbs, `Schema not found: ${schemaPathAbs}`);

	await fs.mkdir(path.join(outDirAbs, "src"), { recursive: true });
	await fs.mkdir(path.join(outDirAbs, "server"), { recursive: true });

	const schemaTypesTs = await generateSchemaTypes({ schemaPathAbs });
	await fs.writeFile(
		path.join(outDirAbs, "src", "schema-types.ts"),
		schemaTypesTs
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
	});
	await fs.writeFile(
		path.join(outDirAbs, "server", "websocket-hibernation-server.ts"),
		websocketDoTs
	);

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
