import path from "node:path";
import {
	DiscoveredHandler,
	groupBy,
	pascalCase,
	toImportPathFromGeneratedServer,
} from "../../utils/utils";

export type ImportSection = {
	schemaImportPath: string;
	configImportLine: string;
	localNameFor: (handler: DiscoveredHandler) => string;
	handlerImports: string[];
};

export function buildImportSection(params: {
	handlers: DiscoveredHandler[];
	outDirAbs: string;
	schemaPathAbs: string;
	configPathAbs: string;
}): ImportSection {
	const generatedSchemaAbs = path.join(params.outDirAbs, "src", "schema.ts");
	const schemaImportPath = toImportPathFromGeneratedServer(
		params.outDirAbs,
		generatedSchemaAbs
	);
	const configImportPath = toImportPathFromGeneratedServer(
		params.outDirAbs,
		params.configPathAbs
	);
	const configImportLine = `import appflareConfig from ${JSON.stringify(configImportPath)};`;
	const localNameFor = (handler: DiscoveredHandler): string =>
		`__appflare_${pascalCase(handler.fileName)}_${handler.name}`;
	const grouped = groupBy(params.handlers, (handler) => handler.sourceFileAbs);
	const handlerImports: string[] = [];
	for (const [fileAbs, list] of Array.from(grouped.entries())) {
		const specifiers = list
			.slice()
			.sort((a, b) => a.name.localeCompare(b.name))
			.map((handler) => `${handler.name} as ${localNameFor(handler)}`);
		const importPath = toImportPathFromGeneratedServer(
			params.outDirAbs,
			fileAbs
		);
		handlerImports.push(
			`import { ${specifiers.join(", ")} } from ${JSON.stringify(importPath)};`
		);
	}
	return {
		schemaImportPath,
		configImportLine,
		localNameFor,
		handlerImports,
	};
}
