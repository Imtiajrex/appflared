import { DiscoveredHandler } from "../../utils/utils";
import { handlerTypePrefix, renderObjectKey } from "./utils";

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
				return `${indent(depth + 1)}${h.name}: ${pascal}Client;`;
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

export function generateMutationsTypeLines(
	mutationsByFile: Map<string, DiscoveredHandler[]>
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
				return `${indent(depth + 1)}${h.name}: ${pascal}Client;`;
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

export function generateInternalTypeLines(
	internalByFile: Map<string, DiscoveredHandler[]>,
	importAliasBySource: Map<string, string>
): string {
	const tree = buildPathTree(internalByFile);
	const renderLeaf = (
		leaf: { path: string; items: DiscoveredHandler[] },
		depth: number
	): string[] => {
		const inner = leaf.items
			.slice()
			.sort((a, b) => a.name.localeCompare(b.name))
			.map((h) => {
				const alias = importAliasBySource.get(h.sourceFileAbs)!;
				return `${indent(depth + 1)}${h.name}: typeof ${alias}[${JSON.stringify(h.name)}];`;
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
