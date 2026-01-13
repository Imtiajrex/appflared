import type { DiscoveredHandler } from "../../utils/utils";

export function buildQueryHandlerEntries(params: {
	queries: DiscoveredHandler[];
	localNameFor: (handler: DiscoveredHandler) => string;
}): string {
	return params.queries
		.slice()
		.sort((a, b) => {
			if (a.routePath === b.routePath) return a.name.localeCompare(b.name);
			return a.routePath.localeCompare(b.routePath);
		})
		.map(
			(query) =>
				`	${JSON.stringify(`${query.routePath}/${query.name}`)}: { file: ${JSON.stringify(query.routePath)}, name: ${JSON.stringify(query.name)}, definition: ${params.localNameFor(query)} },`
		)
		.join("\n");
}
