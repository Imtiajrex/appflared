import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import {
	AppflareConfig,
	assertDirExists,
	assertFileExists,
} from "../utils/utils";
import { getSchemaTableNames, generateSchemaTypes } from "../schema/schema";
import {
	generateDbHandlers,
	discoverHandlers,
	generateApiClient,
	generateHonoServer,
	generateWebsocketDurableObject,
} from "./handlers";

export async function buildFromConfig(params: {
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

	const schemaTypesTs = await generateSchemaTypes({
		schemaPathAbs,
		configPathAbs,
		outDirAbs,
	});
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
		configPathAbs,
		config,
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

async function writeEmitTsconfig(params: {
	configDirAbs: string;
	outDirAbs: string;
}): Promise<string> {
	const outDirRel =
		path.relative(params.configDirAbs, params.outDirAbs).replace(/\\/g, "/") ||
		"./_generated";
	const tsconfigPathAbs = path.join(
		params.configDirAbs,
		".appflare.tsconfig.emit.json"
	);
	const content = {
		compilerOptions: {
			noEmit: false,
			declaration: true,
			emitDeclarationOnly: false,
			outDir: `./${outDirRel}/dist`,
			rootDir: `./${outDirRel}/src`,
			sourceMap: false,
			declarationMap: false,
			skipLibCheck: true,
			target: "ES2022",
			module: "ES2022",
			moduleResolution: "Bundler",
			types: [],
		},
		include: [
			`./${outDirRel}/src/schema-types.ts`,
			`./${outDirRel}/src/handlers/**/*`,
		],
	};
	await fs.writeFile(tsconfigPathAbs, JSON.stringify(content, null, 2));
	return tsconfigPathAbs;
}

async function runTscEmit(tsconfigPathAbs: string): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const child = spawn("bunx", ["tsc", "-p", tsconfigPathAbs], {
			stdio: "inherit",
		});
		child.on("error", reject);
		child.on("exit", (code) => {
			if (code === 0) resolve();
			reject(new Error(`tsc exited with code ${code}`));
		});
	});
}
