import { promises as fs } from "node:fs";
import path from "node:path";
import {
	DiscoveredHandler,
	HandlerKind,
	walkTsFiles,
	groupBy,
} from "../utils/utils";

export async function discoverHandlers(params: {
	projectDirAbs: string;
	schemaPathAbs: string;
	outDirAbs: string;
	configPathAbs: string;
}): Promise<DiscoveredHandler[]> {
	const ignoreDirs = new Set([
		"node_modules",
		".git",
		"dist",
		"build",
		path.basename(params.outDirAbs),
	]);

	const files = await walkTsFiles(params.projectDirAbs, ignoreDirs);

	const handlers: DiscoveredHandler[] = [];
	for (const fileAbs of files) {
		if (path.resolve(fileAbs) === path.resolve(params.schemaPathAbs)) continue;
		if (path.resolve(fileAbs) === path.resolve(params.configPathAbs)) continue;

		const content = await fs.readFile(fileAbs, "utf8");
		const regex =
			/export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*(query|mutation|internalQuery|internalMutation|scheduler)\s*\(/g;
		let match: RegExpExecArray | null;
		while ((match = regex.exec(content)) !== null) {
			handlers.push({
				fileName: path.basename(fileAbs, ".ts"),
				name: match[1],
				kind: match[2] as HandlerKind,
				sourceFileAbs: fileAbs,
			});
		}
	}

	// De-dupe: keep first occurrence
	const seen = new Set<string>();
	const unique = handlers.filter((h) => {
		const key = `${h.kind}:${h.fileName}:${h.name}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});

	unique.sort((a, b) => {
		if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
		if (a.fileName !== b.fileName) return a.fileName.localeCompare(b.fileName);
		return a.name.localeCompare(b.name);
	});

	return unique;
}
