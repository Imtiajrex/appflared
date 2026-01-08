#!/usr/bin/env bun

import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

export async function runTscEmit(tsconfigPathAbs: string): Promise<void> {
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

export async function writeEmitTsconfig(params: {
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
			rootDir: `.`,
			sourceMap: false,
			declarationMap: false,
			skipLibCheck: true,
			target: "ES2022",
			module: "ES2022",
			moduleResolution: "Bundler",
			types: ["node"],
		},
		include: [
			`./${outDirRel}/src/schema-types.ts`,
			`./${outDirRel}/src/schema.ts`,
			`./${outDirRel}/src/handlers/**/*`,
		],
	};
	await fs.writeFile(tsconfigPathAbs, JSON.stringify(content, null, 2));
	return tsconfigPathAbs;
}
