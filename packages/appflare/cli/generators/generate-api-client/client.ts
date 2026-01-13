import { DiscoveredHandler } from "../../utils/utils";
import {
	handlerTypePrefix,
	normalizeTableName,
	renderObjectKey,
} from "./utils";

type PathTree<T> = {
	leaf?: { path: string; items: T[] };
	children: Map<string, PathTree<T>>;
};

const buildPathTree = <T>(byPath: Map<string, T[]>): PathTree<T> => {
	const root: PathTree<T> = { children: new Map() };
	for (const [path, items] of Array.from(byPath.entries())) {
		const segments = path.split("/").filter(Boolean);
		let node = root;
		for (const segment of segments) {
			if (!node.children.has(segment)) {
				node.children.set(segment, { children: new Map() });
			}
			node = node.children.get(segment)!;
		}
		node.leaf = { path, items };
	}
	return root;
};

const indent = (depth: number): string => "\t".repeat(depth);

const renderPathTreeLines = <T>(
	node: PathTree<T>,
	depth: number,
	renderLeaf: (leaf: { path: string; items: T[] }, depth: number) => string[]
): string[] => {
	const lines: string[] = [];
	if (node.leaf) {
		lines.push(...renderLeaf(node.leaf, depth));
	}
	const children = Array.from(node.children.entries()).sort((a, b) =>
		a[0].localeCompare(b[0])
	);
	for (const [segment, child] of children) {
		lines.push(`${indent(depth + 1)}${renderObjectKey(segment)}: {`);
		lines.push(...renderPathTreeLines(child, depth + 1, renderLeaf));
		lines.push(`${indent(depth + 1)}}`);
	}
	return lines;
};

export function generateQueriesClientLines(
	queriesByFile: Map<string, DiscoveredHandler[]>,
	importAliasBySource: Map<string, string>
): string {
	const tree = buildPathTree(queriesByFile);
	const renderLeaf = (
		leaf: { path: string; items: DiscoveredHandler[] },
		depth: number
	): string[] => {
		const inner = leaf.items
			.slice()
			.sort((a, b) => a.name.localeCompare(b.name))
			.map((h) => {
				const pascal = handlerTypePrefix(h);
				const route = `/queries/${leaf.path}/${h.name}`;
				const importAlias = importAliasBySource.get(h.sourceFileAbs)!;
				const handlerAccessor = `${importAlias}.${h.name}`;
				const pad = indent(depth + 1);
				return (
					`${pad}${h.name}: withHandlerMetadata<${pascal}Definition>(\n` +
					`${pad}\tasync (args: ${pascal}Args, init) => {\n` +
					`${pad}\t\tconst url = buildQueryUrl(baseUrl, ${JSON.stringify(route)}, args);\n` +
					`${pad}\t\tconst response = await request(url, {\n` +
					`${pad}\t\t\t...(init ?? {}),\n` +
					`${pad}\t\t\tmethod: "GET",\n` +
					`${pad}\t\t});\n` +
					`${pad}\t\treturn parseJson<${pascal}Result>(response);\n` +
					`${pad}\t},\n` +
					`${pad}\t{\n` +
					`${pad}\t\tschema: createHandlerSchema(${handlerAccessor}.args),\n` +
					`${pad}\t\twebsocket: createHandlerWebsocket<${pascal}Args, ${pascal}Result>(realtime, {\n` +
					`${pad}\t\t\tdefaultTable: ${JSON.stringify(normalizeTableName(h.fileName))},\n` +
					`${pad}\t\t\tdefaultHandler: { file: ${JSON.stringify(leaf.path)}, name: ${JSON.stringify(h.name)} },\n` +
					`${pad}\t\t}),\n` +
					`${pad}\t\tpath: ${JSON.stringify(route)},\n` +
					`${pad}\t}\n` +
					`${pad}),`
				);
			})
			.join("\n");

		return inner ? [inner] : [`${indent(depth + 1)}// (none)`];
	};

	const lines: string[] = [];
	const children = Array.from(tree.children.entries()).sort((a, b) =>
		a[0].localeCompare(b[0])
	);
	for (const [segment, child] of children) {
		lines.push(`${indent(1)}${renderObjectKey(segment)}: {`);
		lines.push(...renderPathTreeLines(child, 1, renderLeaf));
		lines.push(`${indent(1)}}`);
	}
	return lines.join("\n");
}

export function generateMutationsClientLines(
	mutationsByFile: Map<string, DiscoveredHandler[]>,
	importAliasBySource: Map<string, string>
): string {
	const tree = buildPathTree(mutationsByFile);
	const renderLeaf = (
		leaf: { path: string; items: DiscoveredHandler[] },
		depth: number
	): string[] => {
		const inner = leaf.items
			.slice()
			.sort((a, b) => a.name.localeCompare(b.name))
			.map((h) => {
				const pascal = handlerTypePrefix(h);
				const route = `/mutations/${leaf.path}/${h.name}`;
				const importAlias = importAliasBySource.get(h.sourceFileAbs)!;
				const handlerAccessor = `${importAlias}.${h.name}`;
				const pad = indent(depth + 1);
				return (
					`${pad}${h.name}: withHandlerMetadata<${pascal}Definition>(\n` +
					`${pad}\tasync (args: ${pascal}Args, init) => {\n` +
					`${pad}\t\tconst url = buildUrl(baseUrl, ${JSON.stringify(route)});\n` +
					`${pad}\t\tconst response = await request(url, {\n` +
					`${pad}\t\t\t...(init ?? {}),\n` +
					`${pad}\t\t\tmethod: "POST",\n` +
					`${pad}\t\t\theaders: ensureJsonHeaders(init?.headers),\n` +
					`${pad}\t\t\tbody: JSON.stringify(args),\n` +
					`${pad}\t\t});\n` +
					`${pad}\t\treturn parseJson<${pascal}Result>(response);\n` +
					`${pad}\t},\n` +
					`${pad}\t{\n` +
					`${pad}\t\tschema: createHandlerSchema(${handlerAccessor}.args),\n` +
					`${pad}\t\twebsocket: createHandlerWebsocket<${pascal}Args, ${pascal}Result>(realtime, {\n` +
					`${pad}\t\t\tdefaultTable: ${JSON.stringify(normalizeTableName(h.fileName))},\n` +
					`${pad}\t\t\tdefaultHandler: { file: ${JSON.stringify(leaf.path)}, name: ${JSON.stringify(h.name)} },\n` +
					`${pad}\t\t}),\n` +
					`${pad}\t\tpath: ${JSON.stringify(route)},\n` +
					`${pad}\t}\n` +
					`${pad}),`
				);
			})
			.join("\n");

		return inner ? [inner] : [`${indent(depth + 1)}// (none)`];
	};

	const lines: string[] = [];
	const children = Array.from(tree.children.entries()).sort((a, b) =>
		a[0].localeCompare(b[0])
	);
	for (const [segment, child] of children) {
		lines.push(`${indent(1)}${renderObjectKey(segment)}: {`);
		lines.push(...renderPathTreeLines(child, 1, renderLeaf));
		lines.push(`${indent(1)}}`);
	}
	return lines.join("\n");
}
