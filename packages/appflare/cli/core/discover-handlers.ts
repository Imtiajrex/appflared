import { promises as fs } from "node:fs";
import path from "node:path";
import * as ts from "typescript";
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

		const relPathRaw = path.relative(params.projectDirAbs, fileAbs);
		const relPath = relPathRaw.replace(/\\/g, "/");
		const rawRoutePath = relPath.replace(/\.ts$/, "");
		const routePath = rawRoutePath.endsWith("/index")
			? rawRoutePath.slice(0, -"/index".length) || "index"
			: rawRoutePath;

		const content = await fs.readFile(fileAbs, "utf8");
		const cronTriggersByHandler = extractCronTriggers(content);
		const regex =
			/export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*(query|mutation|internalQuery|internalMutation|scheduler|cron|http)\s*\(/g;
		let match: RegExpExecArray | null;
		while ((match = regex.exec(content)) !== null) {
			const kind = match[2] as HandlerKind;
			handlers.push({
				fileName: path.basename(fileAbs, ".ts"),
				routePath,
				name: match[1],
				kind,
				sourceFileAbs: fileAbs,
				cronTriggers:
					kind === "cron" ? cronTriggersByHandler.get(match[1]) : undefined,
			});
		}
	}

	// De-dupe: keep first occurrence
	const seen = new Set<string>();
	const unique = handlers.filter((h) => {
		const key = `${h.kind}:${h.routePath}:${h.name}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});

	unique.sort((a, b) => {
		if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
		if (a.routePath !== b.routePath)
			return a.routePath.localeCompare(b.routePath);
		if (a.fileName !== b.fileName) return a.fileName.localeCompare(b.fileName);
		return a.name.localeCompare(b.name);
	});

	return unique;
}

const cronPropertyNames = new Set(["cronTrigger", "cronTriggers"]);

const isExported = (node: ts.Node): boolean => {
	return Boolean(
		ts.canHaveModifiers(node) &&
		node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
	);
};

const extractCronTriggers = (sourceText: string): Map<string, string[]> => {
	const sourceFile = ts.createSourceFile(
		"cron-handlers.ts",
		sourceText,
		ts.ScriptTarget.Latest,
		true
	);
	const triggersByHandler = new Map<string, string[]>();

	const visit = (node: ts.Node): void => {
		if (ts.isVariableStatement(node) && isExported(node)) {
			for (const decl of node.declarationList.declarations) {
				if (!ts.isIdentifier(decl.name)) continue;
				const initializer = decl.initializer;
				if (!initializer || !ts.isCallExpression(initializer)) continue;
				const callee = initializer.expression;
				if (!ts.isIdentifier(callee) || callee.text !== "cron") continue;
				const cronTriggers = parseCronTriggerArg(initializer.arguments[0]);
				if (cronTriggers && cronTriggers.length > 0) {
					triggersByHandler.set(decl.name.text, cronTriggers);
				}
			}
		}
		ts.forEachChild(node, visit);
	};

	visit(sourceFile);
	return triggersByHandler;
};

const parseCronTriggerArg = (arg?: ts.Expression): string[] | undefined => {
	if (!arg || !ts.isObjectLiteralExpression(arg)) return undefined;
	const cronProp = arg.properties.find((prop) => {
		if (!ts.isPropertyAssignment(prop)) return false;
		if (ts.isIdentifier(prop.name))
			return cronPropertyNames.has(prop.name.text);
		if (ts.isStringLiteralLike(prop.name))
			return cronPropertyNames.has(prop.name.text);
		return false;
	});

	if (!cronProp || !ts.isPropertyAssignment(cronProp)) return undefined;
	const value = cronProp.initializer;
	const triggers: string[] = [];
	if (ts.isArrayLiteralExpression(value)) {
		for (const element of value.elements) {
			if (ts.isStringLiteralLike(element)) {
				triggers.push(element.text.trim());
			}
		}
	} else if (ts.isStringLiteralLike(value)) {
		triggers.push(value.text.trim());
	}

	const unique = Array.from(new Set(triggers.filter(Boolean)));
	return unique.length > 0 ? unique : undefined;
};
