import {
	DiscoveredHandler,
	groupBy,
	pascalCase,
	toImportPathFromGeneratedServer,
} from "../../utils/utils";

export type WebsocketDoImportSection = {
	schemaImportPath: string;
	configImportPath: string;
	handlerImports: string[];
	localNameFor: (handler: DiscoveredHandler) => string;
};

export function buildImportSection(params: {
	queries: DiscoveredHandler[];
	outDirAbs: string;
	schemaPathAbs: string;
	configPathAbs: string;
}): WebsocketDoImportSection {
	const schemaImportPath = toImportPathFromGeneratedServer(
		params.outDirAbs,
		params.schemaPathAbs
	);
	const configImportPath = toImportPathFromGeneratedServer(
		params.outDirAbs,
		params.configPathAbs
	);

	const localNameFor = (handler: DiscoveredHandler): string =>
		`__appflare_${pascalCase(handler.fileName)}_${handler.name}`;

	const grouped = groupBy(params.queries, (handler) => handler.sourceFileAbs);
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
		configImportPath,
		handlerImports,
		localNameFor,
	};
}
