import type { DiscoveredHandler } from "../../utils/utils";

export function buildQueryHandlerEntries(params: {
	queries: DiscoveredHandler[];
	localNameFor: (handler: DiscoveredHandler) => string;
}): string {
	return params.queries
		.slice()
		.sort((a, b) => {
			if (a.fileName === b.fileName) return a.name.localeCompare(b.name);
			return a.fileName.localeCompare(b.fileName);
		})
		.map(
			(query) =>
				`\t${JSON.stringify(`${query.fileName}/${query.name}`)}: { file: ${JSON.stringify(query.fileName)}, name: ${JSON.stringify(query.name)}, definition: ${params.localNameFor(query)} },`
		)
		.join("\n");
}
