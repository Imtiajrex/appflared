#!/usr/bin/env bun

import { Command } from "commander";
import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";

type AppflareConfig = {
	dir: string;
	schema: string;
	outDir: string;
};

type HandlerKind = "query" | "mutation";

type DiscoveredHandler = {
	name: string;
	kind: HandlerKind;
	sourceFileAbs: string;
};

const program = new Command();

program.name("appflare").description("Appflare CLI").version("0.0.0");

program
	.command("build")
	.description(
		"Generate typed schema + query/mutation client/server into outDir"
	)
	.option(
		"-c, --config <path>",
		"Path to appflare.config.ts",
		"appflare.config.ts"
	)
	.option("--emit", "Also run tsc to emit JS + .d.ts into outDir/dist")
	.action(async (options: { config: string; emit?: boolean }) => {
		try {
			const configPath = path.resolve(process.cwd(), options.config);
			const { config, configDirAbs } = await loadConfig(configPath);
			await buildFromConfig({
				config,
				configDirAbs,
				configPathAbs: configPath,
				emit: Boolean(options.emit),
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			console.error(message);
			process.exitCode = 1;
		}
	});

void main();

async function main(): Promise<void> {
	await program.parseAsync(process.argv);
}

async function loadConfig(
	configPathAbs: string
): Promise<{ config: AppflareConfig; configDirAbs: string }> {
	await assertFileExists(configPathAbs, `Config not found: ${configPathAbs}`);
	const configDirAbs = path.dirname(configPathAbs);

	const mod = await import(pathToFileURL(configPathAbs).href);
	const config = (mod?.default ?? mod) as Partial<AppflareConfig>;
	if (!config || typeof config !== "object") {
		throw new Error(
			`Invalid config export in ${configPathAbs} (expected default export object)`
		);
	}
	if (typeof config.dir !== "string" || !config.dir) {
		throw new Error(`Invalid config.dir in ${configPathAbs}`);
	}
	if (typeof config.schema !== "string" || !config.schema) {
		throw new Error(`Invalid config.schema in ${configPathAbs}`);
	}
	if (typeof config.outDir !== "string" || !config.outDir) {
		throw new Error(`Invalid config.outDir in ${configPathAbs}`);
	}
	return { config: config as AppflareConfig, configDirAbs };
}

async function buildFromConfig(params: {
	config: AppflareConfig;
	configDirAbs: string;
	configPathAbs: string;
	emit: boolean;
}): Promise<void> {
	const { config, configDirAbs, emit, configPathAbs } = params;

	const projectDirAbs = path.resolve(configDirAbs, config.dir);
	const schemaPathAbs = path.resolve(configDirAbs, config.schema);
	const outDirAbs = path.resolve(configDirAbs, config.outDir);

	await assertDirExists(
		projectDirAbs,
		`Project dir not found: ${projectDirAbs}`
	);
	await assertFileExists(schemaPathAbs, `Schema not found: ${schemaPathAbs}`);

	await fs.mkdir(path.join(outDirAbs, "src"), { recursive: true });
	await fs.mkdir(path.join(outDirAbs, "server"), { recursive: true });

	const schemaTypesTs = await generateSchemaTypes({ schemaPathAbs });
	await fs.writeFile(
		path.join(outDirAbs, "src", "schema-types.ts"),
		schemaTypesTs
	);

	// (Re)generate built-in DB handlers based on the schema tables.
	const schemaTableNames = await getSchemaTableNames(schemaPathAbs);
	await generateDbHandlers({ outDirAbs, tableNames: schemaTableNames });

	const handlers = await discoverHandlers({
		projectDirAbs,
		schemaPathAbs,
		outDirAbs,
		configPathAbs,
	});

	const apiTs = generateApiClient({ handlers, outDirAbs });
	await fs.writeFile(path.join(outDirAbs, "src", "api.ts"), apiTs);

	const serverTs = generateHonoServer({ handlers, outDirAbs });
	await fs.writeFile(path.join(outDirAbs, "server", "server.ts"), serverTs);

	if (emit) {
		// Remove previous emit output to avoid stale files lingering.
		await fs.rm(path.join(outDirAbs, "dist"), { recursive: true, force: true });

		// Emit only the files that don't pull in user code outside rootDir.
		// This avoids TS rootDir issues and dist overwrite issues caused by user modules.
		const emitTsconfigAbs = await writeEmitTsconfig({
			configDirAbs,
			outDirAbs,
		});
		await runTscEmit(emitTsconfigAbs);
	}
}

async function getSchemaTableNames(schemaPathAbs: string): Promise<string[]> {
	const mod = await import(pathToFileURL(schemaPathAbs).href);
	const schema = mod?.default ?? mod;
	if (!schema || typeof schema !== "object") {
		throw new Error(
			`Invalid schema export in ${schemaPathAbs} (expected default export object)`
		);
	}
	return Object.keys(schema).sort();
}

async function generateDbHandlers(params: {
	outDirAbs: string;
	tableNames: string[];
}): Promise<void> {
	const handlersDir = path.join(params.outDirAbs, "src", "handlers");
	await fs.mkdir(handlersDir, { recursive: true });

	// Clean existing handler files to avoid stale tables lingering.
	const existing = await fs.readdir(handlersDir).catch(() => [] as string[]);
	await Promise.all(
		existing
			.filter((name) => name.endsWith(".ts"))
			.map((name) =>
				fs.unlink(path.join(handlersDir, name)).catch(() => void 0)
			)
	);

	const exportLines: string[] = [];
	for (const tableName of params.tableNames) {
		const fnName = `list${pascalCase(tableName)}`;
		const fileName = `${tableName}.ts`;
		const content = `/* eslint-disable */
/**
 * This file is auto-generated by appflare/db-build.ts.
 * Do not edit directly.
 */
import { query } from "../schema-types";

export const ${fnName} = query({
	args: {},
	handler: async (ctx) => {
		return ctx.db.query(${JSON.stringify(tableName)} as any).collect();
	},
});
`;
		await fs.writeFile(path.join(handlersDir, fileName), content);
		exportLines.push(`export { ${fnName} } from "./${tableName}";`);
	}

	const indexTs = `/* eslint-disable */
/**
 * This file is auto-generated by appflare/db-build.ts.
 * Do not edit directly.
 */
${exportLines.join("\n")}
`;
	await fs.writeFile(path.join(handlersDir, "index.ts"), indexTs);
}

async function writeEmitTsconfig(params: {
	configDirAbs: string;
	outDirAbs: string;
}): Promise<string> {
	const outDirRel =
		path.relative(params.configDirAbs, params.outDirAbs).replace(/\\/g, "/") ||
		"./_generated";
	const tsconfigPathAbs = path.join(
		params.configDirAbs,
		".appflare.tsconfig.emit.json"
	);
	const content = {
		compilerOptions: {
			noEmit: false,
			declaration: true,
			emitDeclarationOnly: false,
			outDir: `./${outDirRel}/dist`,
			rootDir: `./${outDirRel}/src`,
			sourceMap: false,
			declarationMap: false,
			skipLibCheck: true,
			target: "ES2022",
			module: "ES2022",
			moduleResolution: "Bundler",
			types: [],
		},
		include: [
			`./${outDirRel}/src/schema-types.ts`,
			`./${outDirRel}/src/handlers/**/*`,
		],
	};
	await fs.writeFile(tsconfigPathAbs, JSON.stringify(content, null, 2));
	return tsconfigPathAbs;
}

async function generateSchemaTypes(params: {
	schemaPathAbs: string;
}): Promise<string> {
	const mod = await import(pathToFileURL(params.schemaPathAbs).href);
	const schema = mod?.default ?? mod;
	if (!schema || typeof schema !== "object") {
		throw new Error(
			`Invalid schema export in ${params.schemaPathAbs} (expected default export object)`
		);
	}

	const tableNames = Object.keys(schema).sort();
	if (tableNames.length === 0) {
		throw new Error(`Schema has no tables in ${params.schemaPathAbs}`);
	}

	const docInterfaces: string[] = [];
	const docMapEntries: string[] = [];
	const tableIndexEntries: string[] = [];

	for (const tableName of tableNames) {
		const validator = (schema as any)[tableName];
		const shape = getZodObjectShape(validator);
		const interfaceName = pascalCase(`${tableName}Doc`);

		const fields = Object.entries(shape);
		const lines: string[] = [];
		lines.push(`export interface ${interfaceName} {`);
		lines.push(`\t_id: Id<${JSON.stringify(tableName)}>;`);
		lines.push(`\t_creationTime: number;`);
		for (const [fieldName, fieldSchema] of fields) {
			const rendered = renderField(fieldName, fieldSchema);
			lines.push(`\t${rendered}`);
		}
		lines.push(`}`);

		docInterfaces.push(lines.join("\n"));
		docMapEntries.push(`\t${tableName}: ${interfaceName};`);
		tableIndexEntries.push(`\t${tableName}: [],`);
	}

	return `/* eslint-disable */
/**
 * This file is auto-generated by appflare/db-build.ts.
 * Do not edit directly.
 */
type SchemaValidator<TValue> = {
	parse: (value: unknown) => TValue;
};

export type AnyValidator = SchemaValidator<unknown>;

export type TableNames = ${tableNames.map((t) => JSON.stringify(t)).join(" | ")};

export type Id<TableName extends string> = string & { __table?: TableName };

${docInterfaces.join("\n\n")}

export interface TableDocMap {
${docMapEntries.join("\n")}
}

export type Doc<TableName extends TableNames> = TableDocMap[TableName];

export interface DatabaseQuery<TableName extends TableNames> {
	collect(): Promise<Array<TableDocMap[TableName]>>;
}

export interface DatabaseReader {
	query<TableName extends TableNames>(
		table: TableName
	): DatabaseQuery<TableName>;
}

export interface QueryContext {
	db: DatabaseReader;
}

export type QueryArgsShape = Record<string, AnyValidator>;

type InferValidator<TValidator> =
	TValidator extends SchemaValidator<infer TValue> ? TValue : never;

export type InferQueryArgs<TArgs extends QueryArgsShape> = {
	[Key in keyof TArgs]: InferValidator<TArgs[Key]>;
};

export interface QueryDefinition<TArgs extends QueryArgsShape, TResult> {
	args: TArgs;
	handler: (ctx: QueryContext, args: InferQueryArgs<TArgs>) => Promise<TResult>;
}

export const query = <TArgs extends QueryArgsShape, TResult>(
	definition: QueryDefinition<TArgs, TResult>
): QueryDefinition<TArgs, TResult> => definition;

export type EditableDoc<TableName extends TableNames> = Omit<
	TableDocMap[TableName],
	"_id" | "_creationTime"
>;

export interface DatabaseWriter extends DatabaseReader {
	insert<TableName extends TableNames>(
		table: TableName,
		value: EditableDoc<TableName>
	): Promise<Id<TableName>>;
	patch<TableName extends TableNames>(
		table: TableName,
		id: Id<TableName>,
		partial: Partial<EditableDoc<TableName>>
	): Promise<void>;
	delete<TableName extends TableNames>(
		table: TableName,
		id: Id<TableName>
	): Promise<void>;
}

export interface MutationContext {
	db: DatabaseWriter;
}

export interface MutationDefinition<TArgs extends QueryArgsShape, TResult> {
	args: TArgs;
	handler: (
		ctx: MutationContext,
		args: InferQueryArgs<TArgs>
	) => Promise<TResult>;
}

export const mutation = <TArgs extends QueryArgsShape, TResult>(
	definition: MutationDefinition<TArgs, TResult>
): MutationDefinition<TArgs, TResult> => definition;

export const tableIndexes = {
${tableIndexEntries.join("\n")}
} as const;
`;
}

function getZodObjectShape(schema: any): Record<string, any> {
	if (!schema || typeof schema !== "object") {
		throw new Error(`Schema table is not an object`);
	}

	const def = (schema as any)._def;
	if (def?.typeName === "ZodObject" || def?.type === "object") {
		const shape = def.shape;
		if (typeof shape === "function") {
			return shape();
		}
		if (shape && typeof shape === "object") {
			return shape;
		}
	}

	if (typeof (schema as any).shape === "function") {
		return (schema as any).shape;
	}
	if ((schema as any).shape && typeof (schema as any).shape === "object") {
		return (schema as any).shape;
	}

	throw new Error(`Table schema is not a Zod object`);
}

function renderField(fieldName: string, schema: any): string {
	const { tsType, optional } = renderType(schema);
	const safeKey = isValidIdentifier(fieldName)
		? fieldName
		: JSON.stringify(fieldName);
	return `${safeKey}${optional ? "?" : ""}: ${tsType};`;
}

function renderType(schema: any): { tsType: string; optional: boolean } {
	const def = schema?._def;
	const typeName: string | undefined = def?.typeName ?? def?.type;

	if (typeName === "ZodOptional" || typeName === "optional") {
		const inner = def?.innerType ?? def?.schema ?? schema?._def?.innerType;
		const rendered = renderType(inner);
		return { tsType: rendered.tsType, optional: true };
	}
	if (typeName === "ZodNullable" || typeName === "nullable") {
		const inner = def?.innerType ?? def?.schema;
		const rendered = renderType(inner);
		return { tsType: `${rendered.tsType} | null`, optional: false };
	}
	if (typeName === "ZodDefault" || typeName === "default") {
		const inner = def?.innerType ?? def?.schema;
		return renderType(inner);
	}

	if (typeName === "ZodString" || typeName === "string") {
		const description: string | undefined =
			schema?.description ?? def?.description;
		if (typeof description === "string" && description.startsWith("ref:")) {
			const table = description.slice("ref:".length);
			return { tsType: `Id<${JSON.stringify(table)}>`, optional: false };
		}
		return { tsType: "string", optional: false };
	}
	if (typeName === "ZodNumber" || typeName === "number") {
		return { tsType: "number", optional: false };
	}
	if (typeName === "ZodBoolean" || typeName === "boolean") {
		return { tsType: "boolean", optional: false };
	}
	if (typeName === "ZodDate" || typeName === "date") {
		return { tsType: "Date", optional: false };
	}
	if (typeName === "ZodArray" || typeName === "array") {
		const inner = def?.element ?? def?.innerType ?? def?.type;
		const rendered = renderType(inner);
		return { tsType: `Array<${rendered.tsType}>`, optional: false };
	}
	if (typeName === "ZodObject" || typeName === "object") {
		const shape = getZodObjectShape(schema);
		const entries = Object.entries(shape);
		if (entries.length === 0) {
			return { tsType: "Record<string, unknown>", optional: false };
		}
		const props = entries
			.map(([key, value]) => {
				const { tsType, optional } = renderType(value);
				const safeKey = isValidIdentifier(key) ? key : JSON.stringify(key);
				return `\t${safeKey}${optional ? "?" : ""}: ${tsType};`;
			})
			.join("\n");
		return { tsType: `{\n${props}\n}`, optional: false };
	}
	if (typeName === "ZodUnion" || typeName === "union") {
		const options: any[] = def?.options ?? def?.optionsMap ?? [];
		const parts = Array.isArray(options)
			? options.map((o) => renderType(o).tsType)
			: ["unknown"];
		return { tsType: parts.join(" | ") || "unknown", optional: false };
	}
	if (typeName === "ZodLiteral" || typeName === "literal") {
		const value = def?.value;
		return { tsType: JSON.stringify(value), optional: false };
	}
	if (typeName === "ZodAny" || typeName === "any") {
		return { tsType: "any", optional: false };
	}
	if (typeName === "ZodUnknown" || typeName === "unknown") {
		return { tsType: "unknown", optional: false };
	}

	return { tsType: "unknown", optional: false };
}

async function discoverHandlers(params: {
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
			/export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*(query|mutation)\s*\(/g;
		let match: RegExpExecArray | null;
		while ((match = regex.exec(content)) !== null) {
			handlers.push({
				name: match[1],
				kind: match[2] as HandlerKind,
				sourceFileAbs: fileAbs,
			});
		}
	}

	// De-dupe: keep first occurrence
	const seen = new Set<string>();
	const unique = handlers.filter((h) => {
		const key = `${h.kind}:${h.name}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});

	unique.sort((a, b) => {
		if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
		return a.name.localeCompare(b.name);
	});

	return unique;
}

async function walkTsFiles(
	rootAbs: string,
	ignoreDirs: Set<string>
): Promise<string[]> {
	const out: string[] = [];
	const entries = await fs.readdir(rootAbs, { withFileTypes: true });
	for (const entry of entries) {
		const abs = path.join(rootAbs, entry.name);
		if (entry.isDirectory()) {
			if (ignoreDirs.has(entry.name)) continue;
			out.push(...(await walkTsFiles(abs, ignoreDirs)));
			continue;
		}
		if (
			entry.isFile() &&
			entry.name.endsWith(".ts") &&
			!entry.name.endsWith(".d.ts")
		) {
			out.push(abs);
		}
	}
	return out;
}

function generateApiClient(params: {
	handlers: DiscoveredHandler[];
	outDirAbs: string;
}): string {
	const queries = params.handlers.filter((h) => h.kind === "query");
	const mutations = params.handlers.filter((h) => h.kind === "mutation");

	const typeBlocks: string[] = [];
	for (const h of params.handlers) {
		const importPath = toImportPathFromGeneratedSrc(
			params.outDirAbs,
			h.sourceFileAbs
		);
		const pascal = pascalCase(h.name);
		typeBlocks.push(
			`type ${pascal}Definition = typeof import(${JSON.stringify(importPath)})[${JSON.stringify(h.name)}];\n` +
				`type ${pascal}Args = HandlerArgs<${pascal}Definition>;\n` +
				`type ${pascal}Result = HandlerResult<${pascal}Definition>;`
		);
	}

	const queriesClientLines = queries
		.map((h) => {
			const pascal = pascalCase(h.name);
			return (
				`\t${h.name}: async (args: ${pascal}Args, init) => {\n` +
				`\t\t\tconst url = buildQueryUrl(baseUrl, ${JSON.stringify(`/queries/${h.name}`)}, args);\n` +
				`\t\t\tconst response = await request(url, {\n` +
				`\t\t\t\t...(init ?? {}),\n` +
				`\t\t\t\tmethod: "GET",\n` +
				`\t\t\t});\n` +
				`\t\t\treturn parseJson<${pascal}Result>(response);\n` +
				`\t\t},`
			);
		})
		.join("\n");

	const mutationsClientLines = mutations
		.map((h) => {
			const pascal = pascalCase(h.name);
			return (
				`\t${h.name}: async (args: ${pascal}Args, init) => {\n` +
				`\t\t\tconst url = buildUrl(baseUrl, ${JSON.stringify(`/mutations/${h.name}`)});\n` +
				`\t\t\tconst response = await request(url, {\n` +
				`\t\t\t\t...(init ?? {}),\n` +
				`\t\t\t\tmethod: "POST",\n` +
				`\t\t\t\theaders: ensureJsonHeaders(init?.headers),\n` +
				`\t\t\t\tbody: JSON.stringify(args),\n` +
				`\t\t\t});\n` +
				`\t\t\treturn parseJson<${pascal}Result>(response);\n` +
				`\t\t},`
			);
		})
		.join("\n");

	const queriesTypeLines = queries
		.map((h) => {
			const pascal = pascalCase(h.name);
			return `\t${h.name}: HandlerInvoker<${pascal}Args, ${pascal}Result>;`;
		})
		.join("\n");

	const mutationsTypeLines = mutations
		.map((h) => {
			const pascal = pascalCase(h.name);
			return `\t${h.name}: HandlerInvoker<${pascal}Args, ${pascal}Result>;`;
		})
		.join("\n");

	return `/* eslint-disable */
/**
 * This file is auto-generated by appflare/handler-build.ts.
 * Do not edit directly.
 */

import fetch from "better-fetch";

import type { AnyValidator, InferQueryArgs, MutationDefinition, QueryDefinition } from "./schema-types";

type AnyArgsShape = Record<string, AnyValidator>;

type AnyHandlerDefinition = QueryDefinition<AnyArgsShape, unknown> | MutationDefinition<AnyArgsShape, unknown>;

type HandlerArgs<THandler extends AnyHandlerDefinition> = THandler extends { args: infer TArgs }
	? InferQueryArgs<TArgs>
	: never;

type HandlerResult<THandler extends AnyHandlerDefinition> = THandler extends {
	handler: (...args: any[]) => Promise<infer TResult>;
}
	? TResult
	: never;

type HandlerInvoker<TArgs, TResult> = (args: TArgs, init?: RequestInit) => Promise<TResult>;

type RequestExecutor = (
	input: RequestInfo | URL,
	init?: RequestInit
) => Promise<Response>;

const defaultFetcher: RequestExecutor = (input, init) => fetch(input, init);

${typeBlocks.join("\n\n")}

export type QueriesClient = {
${queriesTypeLines || "\t// (none)"}
};

export type MutationsClient = {
${mutationsTypeLines || "\t// (none)"}
};

export type AppflareApiClient = {
	queries: QueriesClient;
	mutations: MutationsClient;
};

export type AppflareApiOptions = {
	baseUrl?: string;
	fetcher?: RequestExecutor;
};

export function createAppflareApi(options: AppflareApiOptions = {}): AppflareApiClient {
	const baseUrl = normalizeBaseUrl(options.baseUrl);
	const request = options.fetcher ?? defaultFetcher;
	const queries: QueriesClient = {
${queriesClientLines || "\t\t// (none)"}
	};
	const mutations: MutationsClient = {
${mutationsClientLines || "\t\t// (none)"}
	};
	return { queries, mutations };
}

function normalizeBaseUrl(baseUrl?: string): string {
	if (!baseUrl) {
		return "";
	}
	return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function buildUrl(baseUrl: string, path: string): string {
	if (!baseUrl) {
		return path;
	}
	const normalizedPath = path.startsWith("/") ? path : "/" + path;
	return baseUrl + normalizedPath;
}

function buildQueryUrl(
	baseUrl: string,
	path: string,
	params: Record<string, unknown> | undefined
): string {
	const url = buildUrl(baseUrl, path);
	const query = serializeQueryParams(params);
	return query ? url + "?" + query : url;
}

function serializeQueryParams(
	params: Record<string, unknown> | undefined
): string {
	if (!params) {
		return "";
	}
	const searchParams = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value === undefined || value === null) {
			continue;
		}
		if (Array.isArray(value)) {
			for (const entry of value) {
				searchParams.append(key, serializeQueryValue(entry));
			}
			continue;
		}
		searchParams.append(key, serializeQueryValue(value));
	}
	return searchParams.toString();
}

function serializeQueryValue(value: unknown): string {
	if (value instanceof Date) {
		return value.toISOString();
	}
	if (typeof value === "object") {
		return JSON.stringify(value);
	}
	return String(value);
}

function ensureJsonHeaders(headers?: HeadersInit): HeadersInit {
	if (!headers) {
		return { "content-type": "application/json" };
	}
	if (typeof Headers !== "undefined" && headers instanceof Headers) {
		const next = new Headers(headers);
		if (!next.has("content-type")) {
			next.set("content-type", "application/json");
		}
		return next;
	}
	if (Array.isArray(headers)) {
		const entries = headers.slice();
		const hasContentType = entries.some(
			([key]) => key.toLowerCase() === "content-type"
		);
		if (!hasContentType) {
			entries.push(["content-type", "application/json"]);
		}
		return entries;
	}
	if (typeof headers === "object") {
		const record = { ...(headers as Record<string, string>) };
		if (!hasHeader(record, "content-type")) {
			record["content-type"] = "application/json";
		}
		return record;
	}
	return { "content-type": "application/json" };
}

function hasHeader(record: Record<string, string>, name: string): boolean {
	const needle = name.toLowerCase();
	return Object.keys(record).some((key) => key.toLowerCase() === needle);
}

async function parseJson<TResult>(response: Response): Promise<TResult> {
	if (!response.ok) {
		throw new Error("Request failed with status " + response.status);
	}
	return (await response.json()) as TResult;
}
`;
}

function generateHonoServer(params: {
	handlers: DiscoveredHandler[];
	outDirAbs: string;
}): string {
	const queries = params.handlers.filter((h) => h.kind === "query");
	const mutations = params.handlers.filter((h) => h.kind === "mutation");

	const grouped = groupBy(params.handlers, (h) => h.sourceFileAbs);
	const importLines: string[] = [];
	for (const [fileAbs, list] of Array.from(grouped.entries())) {
		const specifiers = list.map((h) => h.name).sort();
		const importPath = toImportPathFromGeneratedServer(
			params.outDirAbs,
			fileAbs
		);
		importLines.push(
			`import { ${specifiers.join(", ")} } from ${JSON.stringify(importPath)};`
		);
	}

	const routeLines: string[] = [];
	for (const q of queries) {
		routeLines.push(
			`app.get(\n` +
				`\t${JSON.stringify(`/queries/${q.name}`)},\n` +
				`\tsValidator("query", z.object(${q.name}.args as any)),\n` +
				`\tasync (c) => {\n` +
				`\t\tconst query = c.req.valid("query");\n` +
				`\t\tconst result = await ${q.name}.handler(appflareContext, query);\n` +
				`\t\treturn c.json(result, 200);\n` +
				`\t}\n` +
				`);`
		);
	}
	for (const m of mutations) {
		routeLines.push(
			`app.post(\n` +
				`\t${JSON.stringify(`/mutations/${m.name}`)},\n` +
				`\tsValidator("json", z.object(${m.name}.args as any)),\n` +
				`\tasync (c) => {\n` +
				`\t\tconst body = c.req.valid("json");\n` +
				`\t\tconst result = await ${m.name}.handler(appflareContext, body);\n` +
				`\t\treturn c.json(result, 200);\n` +
				`\t}\n` +
				`);`
		);
	}

	return `/* eslint-disable */
/**
 * This file is auto-generated by appflare/handler-build.ts.
 * Do not edit directly.
 */

import { Hono } from "hono";
import { sValidator } from "@hono/standard-validator";
import { z } from "zod";
import { cors } from "hono/cors";

${importLines.join("\n")}

const appflareContext = {
	db: {
		query: (tableName: string) => ({
			collect: async () => {
				return [{ id: "1", text: "Hello World" }];
			},
		}),
	},
} as any;

const app = new Hono();
app.use(
	cors({
		origin: "*",
	})
);

${routeLines.join("\n\n")}

export default app;
`;
}

function toImportPathFromGeneratedSrc(
	outDirAbs: string,
	fileAbs: string
): string {
	const fromDir = path.join(outDirAbs, "src");
	let rel = path.relative(fromDir, fileAbs);
	rel = rel.replace(/\\/g, "/");
	rel = rel.replace(/\.ts$/, "");
	if (!rel.startsWith(".")) {
		rel = `./${rel}`;
	}
	return rel;
}

function toImportPathFromGeneratedServer(
	outDirAbs: string,
	fileAbs: string
): string {
	const fromDir = path.join(outDirAbs, "server");
	let rel = path.relative(fromDir, fileAbs);
	rel = rel.replace(/\\/g, "/");
	rel = rel.replace(/\.ts$/, "");
	if (!rel.startsWith(".")) {
		rel = `./${rel}`;
	}
	return rel;
}

function pascalCase(value: string): string {
	return value
		.replace(/(^|[^A-Za-z0-9]+)([A-Za-z0-9])/g, (_, __, c: string) =>
			c.toUpperCase()
		)
		.replace(/[^A-Za-z0-9]/g, "");
}

function isValidIdentifier(value: string): boolean {
	return /^[A-Za-z_$][\w$]*$/.test(value);
}

function groupBy<T, TKey>(
	items: T[],
	keyFn: (item: T) => TKey
): Map<TKey, T[]> {
	const map = new Map<TKey, T[]>();
	for (const item of items) {
		const key = keyFn(item);
		const list = map.get(key);
		if (list) {
			list.push(item);
		} else {
			map.set(key, [item]);
		}
	}
	return map;
}

async function runTscEmit(tsconfigPathAbs: string): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const child = spawn("bunx", ["tsc", "-p", tsconfigPathAbs], {
			stdio: "inherit",
		});
		child.on("error", reject);
		child.on("exit", (code) => {
			if (code === 0) resolve();
			reject(new Error(`tsc exited with code ${code}`));
		});
	});
}

async function assertFileExists(
	fileAbs: string,
	message: string
): Promise<void> {
	const ok = await fileExists(fileAbs);
	if (!ok) throw new Error(message);
}

async function assertDirExists(dirAbs: string, message: string): Promise<void> {
	try {
		const stat = await fs.stat(dirAbs);
		if (!stat.isDirectory()) throw new Error(message);
	} catch {
		throw new Error(message);
	}
}

async function fileExists(fileAbs: string): Promise<boolean> {
	try {
		const stat = await fs.stat(fileAbs);
		return stat.isFile();
	} catch {
		return false;
	}
}
