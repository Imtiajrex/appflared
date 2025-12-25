import {
	DiscoveredHandler,
	groupBy,
	pascalCase,
	AppflareConfig,
	toImportPathFromGeneratedServer,
} from "../utils/utils";

export function generateHonoServer(params: {
	handlers: DiscoveredHandler[];
	outDirAbs: string;
	schemaPathAbs: string;
	configPathAbs: string;
	config: AppflareConfig;
}): string {
	const queries = params.handlers.filter((h) => h.kind === "query");
	const mutations = params.handlers.filter((h) => h.kind === "mutation");
	const schemaImportPath = toImportPathFromGeneratedServer(
		params.outDirAbs,
		params.schemaPathAbs
	);
	const configImportPath = toImportPathFromGeneratedServer(
		params.outDirAbs,
		params.configPathAbs
	);

	const localNameFor = (h: DiscoveredHandler): string =>
		`__appflare_${pascalCase(h.fileName)}_${h.name}`;

	const grouped = groupBy(params.handlers, (h) => h.sourceFileAbs);
	const importLines: string[] = [];
	for (const [fileAbs, list] of Array.from(grouped.entries())) {
		const specifiers = list
			.slice()
			.sort((a, b) => a.name.localeCompare(b.name))
			.map((h) => `${h.name} as ${localNameFor(h)}`);
		const importPath = toImportPathFromGeneratedServer(
			params.outDirAbs,
			fileAbs
		);
		importLines.push(
			`import { ${specifiers.join(", ")} } from ${JSON.stringify(importPath)};`
		);
	}

	const authImports = params.config.auth
		? [
				`import appflareConfig from ${JSON.stringify(configImportPath)};`,
				`import { createBetterAuthRouter, getSanitizedRequest, initBetterAuth } from "appflare/server/auth";`,
			].join("\n")
		: "";

	const authSetup = params.config.auth
		? [
				`const __appflareAuthConfig = (appflareConfig as any).auth;`,
				`const __appflareAuthBasePath = __appflareAuthConfig?.basePath ?? "/auth";`,
				`const __appflareAuth =`,
				`\t__appflareAuthConfig &&`,
				`\t__appflareAuthConfig.enabled !== false &&`,
				`\t__appflareAuthConfig.options`,
				`\t\t? initBetterAuth(__appflareAuthConfig.options as any)`,
				`\t\t: undefined;`,
				`const __appflareAuthRouter = __appflareAuth`,
				`\t? createBetterAuthRouter({`,
				`\t\tauth: __appflareAuth,`,
				`\t})`,
				`\t: undefined;`,
			].join("\n")
		: "";

	const authMount = params.config.auth
		? `\n\tif (__appflareAuthRouter) {\n\t\tapp.route(__appflareAuthBasePath, __appflareAuthRouter);\n\t}\n`
		: "";

	const authResolver = params.config.auth
		? [
				`const resolveAuthContext = async (`,
				`\tc: HonoContext`,
				`): Promise<AppflareAuthContext> => {`,
				`\tif (!__appflareAuth) {`,
				`\t\tconst authContext: AppflareAuthContext = {`,
				`\t\t\tsession: null as AppflareAuthSession,`,
				`\t\t\tuser: null as AppflareAuthUser,`,
				`\t\t};`,
				`\t\tc.set("appflareSession", authContext.session);`,
				`\t\tc.set("appflareUser", authContext.user);`,
				`\t\treturn authContext;`,
				`\t}`,
				``,
				`\tconst sessionResult = await __appflareAuth.api.getSession(`,
				`\t\c.req.raw`,
				`\t);`,
				`\tconst authContext: AppflareAuthContext = {`,
				`\t\tsession:`,
				`\t\t\t(sessionResult as any)?.session ??`,
				`\t\t\t(sessionResult as any) ??`,
				`\t\t\t(null as AppflareAuthSession),`,
				`\t\tuser: (sessionResult as any)?.user ?? (null as AppflareAuthUser),`,
				`\t};`,
				`\tc.set("appflareSession", authContext.session);`,
				`\tc.set("appflareUser", authContext.user);`,
				`\treturn authContext;`,
				`};`,
			].join("\n")
		: [
				`const resolveAuthContext = async (`,
				`\tc: HonoContext`,
				`): Promise<AppflareAuthContext> => {`,
				`\tconst authContext: AppflareAuthContext = {`,
				`\t\tsession: null as AppflareAuthSession,`,
				`\t\tuser: null as AppflareAuthUser,`,
				`\t};`,
				`\tc.set("appflareSession", authContext.session);`,
				`\tc.set("appflareUser", authContext.user);`,
				`\treturn authContext;`,
				`};`,
			].join("\n");

	const indent = (block: string): string =>
		block
			.split("\n")
			.map((line) => `\t${line}`)
			.join("\n");

	const authSetupBlock = authSetup ? `\n${indent(authSetup)}\n` : "";
	const authResolverBlock = `\n${indent(authResolver)}\n`;

	const routeLines: string[] = [];
	for (const q of queries) {
		const local = localNameFor(q);
		routeLines.push(
			`app.get(\n` +
				`\t${JSON.stringify(`/queries/${q.fileName}/${q.name}`)},\n` +
				`\tsValidator("query", z.object(${local}.args as any)),\n` +
				`\tasync (c) => {\n` +
				`\t\tconst query = c.req.valid("query");\n` +
				`\t\tconst ctx = await resolveContext(c);\n` +
				`\t\tconst result = await ${local}.handler(ctx as any, query as any);\n` +
				`\t\treturn c.json(result, 200);\n` +
				`\t}\n` +
				`);`
		);
	}
	for (const m of mutations) {
		const local = localNameFor(m);
		routeLines.push(
			`app.post(\n` +
				`\t${JSON.stringify(`/mutations/${m.fileName}/${m.name}`)},\n` +
				`\tsValidator("json", z.object(${local}.args as any)),\n` +
				`\tasync (c) => {\n` +
				`\t\tconst body = c.req.valid("json");\n` +
				`\t\tconst ctx = await resolveContext(c);\n` +
				`\t\tconst result = await ${local}.handler(ctx as any, body as any);\n` +
				`\t\tif (notifyMutation) {\n` +
				`\t\t\ttry {\n` +
				`\t\t\t\tawait notifyMutation({\n` +
				`\t\t\t\t\t table: normalizeTableName(${JSON.stringify(m.fileName)}),\n` +
				`\t\t\t\t\t handler: { file: ${JSON.stringify(m.fileName)}, name: ${JSON.stringify(m.name)} },\n` +
				`\t\t\t\t\t args: body,\n` +
				`\t\t\t\t\t result,\n` +
				`\t\t\t\t});\n` +
				`\t\t\t} catch (err) {\n` +
				`\t\t\t\tconsole.error("Appflare realtime notification failed", err);\n` +
				`\t\t\t}\n` +
				`\t\t}\n` +
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
import type { Context as HonoContext } from "hono";
import { sValidator } from "@hono/standard-validator";
import { z } from "zod";
import { cors } from "hono/cors";
import schema from ${JSON.stringify(schemaImportPath)};
import {
	createMongoDbContext,
	type MongoDbContext,
} from "appflare/server/db";
${
	authImports
		? `
${authImports}
`
		: ""
}

import type {
	AppflareAuthContext,
	AppflareAuthSession,
	AppflareAuthUser,
	TableDocMap,
	TableNames,
} from "../src/schema-types";

${importLines.join("\n")}

export type AppflareDbContext = MongoDbContext<TableNames, TableDocMap>;

export type AppflareServerContext = AppflareAuthContext & {
	db: AppflareDbContext;
};

export function createAppflareDbContext(params: {
	db: import("mongodb").Db;
	collectionName?: (table: TableNames) => string;
}): AppflareDbContext {
	return createMongoDbContext<TableNames, TableDocMap>({
		db: params.db,
		schema,
		collectionName: params.collectionName,
	});
}

export type MutationNotification = {
	table: TableNames;
	handler: { file: string; name: string };
	args: unknown;
	result: unknown;
};

type DurableObjectNamespaceLike = {
	idFromName(name: string): any;
	get(id: any): { fetch(input: any, init?: RequestInit): Promise<Response> };
};

type MutationNotifier = (payload: MutationNotification) => Promise<void>;

type RealtimeOptions = {
	notify?: MutationNotifier;
	durableObject?: DurableObjectNamespaceLike;
	durableObjectName?: string;
};

export type AppflareHonoServerOptions = {
	/** Provide a static Mongo Db instance. If omitted, set getDb instead. */
	db?: import("mongodb").Db;
	/** Provide a per-request Mongo Db instance (e.g. from Cloudflare env bindings). */
	getDb?: (c: HonoContext) => import("mongodb").Db | Promise<import("mongodb").Db>;
	/** Optionally extend the context beyond the db wrapper. */
	createContext?: (
		c: HonoContext,
		db: AppflareDbContext,
		auth: AppflareAuthContext
	) => AppflareServerContext | Promise<AppflareServerContext>;
	collectionName?: (table: TableNames) => string;
	corsOrigin?: string | string[];
	realtime?: RealtimeOptions;
};

function normalizeTableName(table: string): TableNames {
	const tables = schema as Record<string, unknown>;
	if (tables[table]) return table as TableNames;
	const plural = table + "s";
	if (tables[plural]) return plural as TableNames;
	throw new Error("Unknown table: " + table);
}

export function createAppflareHonoServer(options: AppflareHonoServerOptions): Hono {
	const fixedDb =
		options.db &&
		createAppflareDbContext({
			db: options.db,
			collectionName: options.collectionName,
		});

	if (!fixedDb && !options.getDb) {
		throw new Error(
			"AppflareHonoServer requires either options.db or options.getDb to initialize the database context."
		);
	}

	const resolveDb = async (c: HonoContext): Promise<AppflareDbContext> => {
		if (fixedDb) return fixedDb;
		const db = await options.getDb!(c);
		return createAppflareDbContext({
			db,
			collectionName: options.collectionName,
		});
	};

	const createContext =
		options.createContext ??
		((_c, db, auth) => ({ db, ...auth }) as AppflareServerContext);
	const notifyMutation = createMutationNotifier(options.realtime);
	const app = new Hono();
	app.use(
		cors({
			origin: options.corsOrigin ?? "*",
		})
	);
${authSetupBlock}${authMount}${authResolverBlock}
	const resolveContext = async (
		c: HonoContext
	): Promise<AppflareServerContext> => {
		const db = await resolveDb(c);
		const auth = await resolveAuthContext(c);
		const ctx = await createContext(c, db, auth);
		return ctx ?? ({ db, ...auth } as AppflareServerContext);
	};

	${routeLines.join("\n\n\t")}

	return app;
}

function createMutationNotifier(
	options?: RealtimeOptions
): MutationNotifier | undefined {
	if (!options) return undefined;
	if (options.notify) return options.notify;
	if (options.durableObject) {
		return async (payload: MutationNotification) => {
			const id = options.durableObject!.idFromName(
				options.durableObjectName ?? "primary"
			);
			const stub = options.durableObject!.get(id);
			await stub.fetch("http://appflare-realtime/notify", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(payload),
			});
		};
	}
	return undefined;
}

`;
}
