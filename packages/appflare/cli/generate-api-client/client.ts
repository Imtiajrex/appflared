import { DiscoveredHandler } from "../utils";
import {
	handlerTypePrefix,
	normalizeTableName,
	renderObjectKey,
	sortedEntries,
} from "./utils";

export function generateQueriesClientLines(
	queriesByFile: Map<string, DiscoveredHandler[]>,
	importAliasBySource: Map<string, string>
): string {
	return sortedEntries(queriesByFile)
		.map(([fileName, list]) => {
			const fileKey = renderObjectKey(fileName);
			const inner = list
				.slice()
				.sort((a, b) => a.name.localeCompare(b.name))
				.map((h) => {
					const pascal = handlerTypePrefix(h);
					const route = `/queries/${fileName}/${h.name}`;
					const importAlias = importAliasBySource.get(h.sourceFileAbs)!;
					const handlerAccessor = `${importAlias}.${h.name}`;
					return (
						`\t\t${h.name}: withHandlerMetadata<${pascal}Definition>(\n` +
						`\t\t\tasync (args: ${pascal}Args, init) => {\n` +
						`\t\t\t\tconst url = buildQueryUrl(baseUrl, ${JSON.stringify(route)}, args);\n` +
						`\t\t\t\tconst response = await request(url, {\n` +
						`\t\t\t\t\t...(init ?? {}),\n` +
						`\t\t\t\t\tmethod: "GET",\n` +
						`\t\t\t\t});\n` +
						`\t\t\t\treturn parseJson<${pascal}Result>(response);\n` +
						`\t\t\t},\n` +
						`\t\t\t{\n` +
						`\t\t\t\tschema: createHandlerSchema(${handlerAccessor}.args),\n` +
						`\t\t\t\twebsocket: createHandlerWebsocket<${pascal}Args, ${pascal}Result>(realtime, {\n` +
						`\t\t\t\t\tdefaultTable: ${JSON.stringify(normalizeTableName(fileName))},\n` +
						`\t\t\t\t\tdefaultHandler: { file: ${JSON.stringify(fileName)}, name: ${JSON.stringify(h.name)} },\n` +
						`\t\t\t\t}),\n` +
						`\t\t\t\tpath: ${JSON.stringify(route)},\n` +
						`\t\t\t}\n` +
						`\t\t),`
					);
				})
				.join("\n");
			return `\t${fileKey}: {\n${inner || "\t\t// (none)"}\n\t},`;
		})
		.join("\n");
}

export function generateMutationsClientLines(
	mutationsByFile: Map<string, DiscoveredHandler[]>,
	importAliasBySource: Map<string, string>
): string {
	return sortedEntries(mutationsByFile)
		.map(([fileName, list]) => {
			const fileKey = renderObjectKey(fileName);
			const inner = list
				.slice()
				.sort((a, b) => a.name.localeCompare(b.name))
				.map((h) => {
					const pascal = handlerTypePrefix(h);
					const route = `/mutations/${fileName}/${h.name}`;
					const importAlias = importAliasBySource.get(h.sourceFileAbs)!;
					const handlerAccessor = `${importAlias}.${h.name}`;
					return (
						`\t\t${h.name}: withHandlerMetadata<${pascal}Definition>(\n` +
						`\t\t\tasync (args: ${pascal}Args, init) => {\n` +
						`\t\t\t\tconst url = buildUrl(baseUrl, ${JSON.stringify(route)});\n` +
						`\t\t\t\tconst response = await request(url, {\n` +
						`\t\t\t\t\t...(init ?? {}),\n` +
						`\t\t\t\t\tmethod: "POST",\n` +
						`\t\t\t\t\theaders: ensureJsonHeaders(init?.headers),\n` +
						`\t\t\t\t\tbody: JSON.stringify(args),\n` +
						`\t\t\t\t});\n` +
						`\t\t\t\treturn parseJson<${pascal}Result>(response);\n` +
						`\t\t\t},\n` +
						`\t\t\t{\n` +
						`\t\t\t\tschema: createHandlerSchema(${handlerAccessor}.args),\n` +
						`\t\t\t\twebsocket: createHandlerWebsocket<${pascal}Args, ${pascal}Result>(realtime, {\n` +
						`\t\t\t\t\tdefaultTable: ${JSON.stringify(normalizeTableName(fileName))},\n` +
						`\t\t\t\t\tdefaultHandler: { file: ${JSON.stringify(fileName)}, name: ${JSON.stringify(h.name)} },\n` +
						`\t\t\t\t}),\n` +
						`\t\t\t\tpath: ${JSON.stringify(route)},\n` +
						`\t\t\t}\n` +
						`\t\t),`
					);
				})
				.join("\n");
			return `\t${fileKey}: {\n${inner || "\t\t// (none)"}\n\t},`;
		})
		.join("\n");
}
