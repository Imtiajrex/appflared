import { DiscoveredHandler } from "../../utils/utils";
import { handlerTypePrefix, renderObjectKey, sortedEntries } from "./utils";

export function generateTypeBlocks(
	handlers: DiscoveredHandler[],
	importAliasBySource: Map<string, string>
): string[] {
	const typeBlocks: string[] = [];
	for (const h of handlers) {
		const importAlias = importAliasBySource.get(h.sourceFileAbs)!;
		const handlerAccessor = `${importAlias}[${JSON.stringify(h.name)}]`;
		const pascal = handlerTypePrefix(h);
		typeBlocks.push(
			`type ${pascal}Definition = typeof ${handlerAccessor};\n` +
				`type ${pascal}Args = HandlerArgs<${pascal}Definition>;\n` +
				`type ${pascal}Result = HandlerResult<${pascal}Definition>;\n` +
				`type ${pascal}Client = AppflareHandler<${pascal}Definition>;`
		);
	}
	return typeBlocks;
}

export function generateQueriesTypeLines(
	queriesByFile: Map<string, DiscoveredHandler[]>
): string {
	return sortedEntries(queriesByFile)
		.map(([fileName, list]) => {
			const fileKey = renderObjectKey(fileName);
			const inner = list
				.slice()
				.sort((a, b) => a.name.localeCompare(b.name))
				.map((h) => {
					const pascal = handlerTypePrefix(h);
					return `\t\t${h.name}: ${pascal}Client;`;
				})
				.join("\n");
			return `\t${fileKey}: {\n${inner || "\t\t// (none)"}\n\t};`;
		})
		.join("\n");
}

export function generateMutationsTypeLines(
	mutationsByFile: Map<string, DiscoveredHandler[]>
): string {
	return sortedEntries(mutationsByFile)
		.map(([fileName, list]) => {
			const fileKey = renderObjectKey(fileName);
			const inner = list
				.slice()
				.sort((a, b) => a.name.localeCompare(b.name))
				.map((h) => {
					const pascal = handlerTypePrefix(h);
					return `\t\t${h.name}: ${pascal}Client;`;
				})
				.join("\n");
			return `\t${fileKey}: {\n${inner || "\t\t// (none)"}\n\t};`;
		})
		.join("\n");
}

export function generateInternalTypeLines(
	internalByFile: Map<string, DiscoveredHandler[]>,
	importAliasBySource: Map<string, string>
): string {
	return sortedEntries(internalByFile)
		.map(([fileName, list]) => {
			const fileKey = renderObjectKey(fileName);
			const inner = list
				.slice()
				.sort((a, b) => a.name.localeCompare(b.name))
				.map((h) => {
					const alias = importAliasBySource.get(h.sourceFileAbs)!;
					return `\t\t${h.name}: typeof ${alias}[${JSON.stringify(h.name)}];`;
				})
				.join("\n");
			return `\t${fileKey}: {\n${inner || "\t\t// (none)"}\n\t};`;
		})
		.join("\n");
}
