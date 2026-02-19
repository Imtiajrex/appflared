import { Hono } from "hono";
import type { Context } from "hono";
import type { BetterAuthOptions } from "better-auth";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";
import type { AnyZod } from "./types/types";

type BetterAuthD1DatabaseLike = {
	prepare: (query: string) => unknown;
	batch: (statements: unknown[]) => Promise<unknown>;
};

function isBetterAuthD1DatabaseLike(
	value: unknown,
): value is BetterAuthD1DatabaseLike {
	if (!value || typeof value !== "object") return false;
	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.prepare === "function" &&
		typeof candidate.batch === "function"
	);
}

function normalizeBetterAuthOptions(
	options: BetterAuthOptions,
): BetterAuthOptions {
	const normalized = { ...options } as BetterAuthOptions;
	const database = (normalized as any).database;

	if (isBetterAuthD1DatabaseLike(database)) {
		(normalized as any).database = {
			type: "sqlite",
			db: new Kysely({
				dialect: new D1Dialect({
					database: database as any,
				}),
			}),
		};
	}

	return normalized;
}

export type D1PreparedStatementLike = {
	bind: (...values: unknown[]) => D1PreparedStatementLike;
	all: <T = unknown>() => Promise<{ results?: T[] }>;
	first: <T = unknown>() => Promise<T | null>;
	run: () => Promise<unknown>;
};

export type D1DatabaseLike = {
	prepare: (query: string) => D1PreparedStatementLike;
	exec?: (query: string) => Promise<unknown>;
};

export type D1DbHandler = {
	db: D1DatabaseLike;
	queryAll<T = Record<string, unknown>>(
		sql: string,
		params?: unknown[],
	): Promise<T[]>;
	queryFirst<T = Record<string, unknown>>(
		sql: string,
		params?: unknown[],
	): Promise<T | null>;
	exec(sql: string, params?: unknown[]): Promise<void>;
};

export function createD1DbHandler(db: D1DatabaseLike): D1DbHandler {
	return {
		db,
		async queryAll<T = Record<string, unknown>>(
			sql: string,
			params: unknown[] = [],
		): Promise<T[]> {
			const result = await db
				.prepare(sql)
				.bind(...params)
				.all<T>();
			return result?.results ?? [];
		},
		async queryFirst<T = Record<string, unknown>>(
			sql: string,
			params: unknown[] = [],
		): Promise<T | null> {
			return db
				.prepare(sql)
				.bind(...params)
				.first<T>();
		},
		async exec(sql: string, params: unknown[] = []): Promise<void> {
			await db
				.prepare(sql)
				.bind(...params)
				.run();
		},
	};
}

export type SchemaMigrationPlan = {
	sql: string[];
};

type FieldSpec = {
	typeName: string;
	optional: boolean;
	nullable: boolean;
	defaultValue?: unknown;
	refTable?: string;
	isArray: boolean;
	isObjectLike: boolean;
};

const SQLITE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

function quoteIdentifier(name: string): string {
	if (!SQLITE_IDENTIFIER.test(name)) {
		throw new Error(`Invalid SQL identifier: ${name}`);
	}
	return `"${name}"`;
}

function getZodObjectShape(schema: any): Record<string, any> {
	const def = schema?._def;
	if (def?.typeName === "ZodObject" || def?.type === "object") {
		const shape = def.shape;
		if (typeof shape === "function") return shape();
		if (shape && typeof shape === "object") return shape;
	}
	if (typeof schema?.shape === "function") return schema.shape();
	if (schema?.shape && typeof schema.shape === "object") return schema.shape;
	throw new Error("Schema table must be a Zod object");
}

function unwrapZod(schema: any): {
	typeName: string;
	optional: boolean;
	nullable: boolean;
	defaultValue?: unknown;
	baseSchema: any;
} {
	let current = schema;
	let optional = false;
	let nullable = false;
	let defaultValue: unknown = undefined;

	while (current?._def) {
		const def = current._def;
		const typeName: string = def?.typeName ?? def?.type;
		if (typeName === "ZodOptional" || typeName === "optional") {
			optional = true;
			current = def.innerType ?? def.schema;
			continue;
		}
		if (typeName === "ZodNullable" || typeName === "nullable") {
			nullable = true;
			current = def.innerType ?? def.schema;
			continue;
		}
		if (typeName === "ZodDefault" || typeName === "default") {
			if (defaultValue === undefined) {
				defaultValue =
					typeof def.defaultValue === "function"
						? def.defaultValue()
						: def.defaultValue;
			}
			current = def.innerType ?? def.schema;
			continue;
		}
		break;
	}

	const finalTypeName: string = current?._def?.typeName ?? current?._def?.type;
	return {
		typeName: finalTypeName,
		optional,
		nullable,
		defaultValue,
		baseSchema: current,
	};
}

function inferFieldSpec(fieldSchema: any): FieldSpec {
	const unwrapped = unwrapZod(fieldSchema);
	const description: string | undefined =
		fieldSchema?.description ??
		fieldSchema?._def?.description ??
		unwrapped.baseSchema?.description ??
		unwrapped.baseSchema?._def?.description;

	let isArray =
		unwrapped.typeName === "ZodArray" || unwrapped.typeName === "array";
	let isObjectLike =
		unwrapped.typeName === "ZodObject" ||
		unwrapped.typeName === "object" ||
		isArray;

	if (
		unwrapped.typeName === "ZodDate" ||
		unwrapped.typeName === "date" ||
		unwrapped.typeName === "ZodString" ||
		unwrapped.typeName === "string" ||
		unwrapped.typeName === "ZodNumber" ||
		unwrapped.typeName === "number" ||
		unwrapped.typeName === "ZodBoolean" ||
		unwrapped.typeName === "boolean"
	) {
		isObjectLike = false;
	}

	const refTable =
		typeof description === "string" && description.startsWith("ref:")
			? description.slice(4)
			: undefined;

	return {
		typeName: unwrapped.typeName,
		optional: unwrapped.optional,
		nullable: unwrapped.nullable,
		defaultValue: unwrapped.defaultValue,
		refTable,
		isArray,
		isObjectLike,
	};
}

function sqliteTypeForField(spec: FieldSpec): string {
	if (spec.isObjectLike) return "TEXT";
	if (spec.refTable) return "TEXT";
	switch (spec.typeName) {
		case "ZodNumber":
		case "number":
			return "REAL";
		case "ZodBoolean":
		case "boolean":
			return "INTEGER";
		case "ZodDate":
		case "date":
			return "TEXT";
		default:
			return "TEXT";
	}
}

function serializeDefault(value: unknown, spec: FieldSpec): string | undefined {
	if (value === undefined) return undefined;
	if (value === null) return "NULL";
	if (spec.isObjectLike) return JSON.stringify(JSON.stringify(value));
	if (spec.typeName === "ZodBoolean" || spec.typeName === "boolean") {
		return value ? "1" : "0";
	}
	if (typeof value === "number") return String(value);
	return JSON.stringify(String(value));
}

export function buildD1SchemaMigrations<TTableNames extends string>(options: {
	schema: Record<TTableNames, AnyZod>;
	tableNamePrefix?: string;
	includeForeignKeys?: boolean;
}): SchemaMigrationPlan {
	const prefix = options.tableNamePrefix ?? "";
	const includeForeignKeys = options.includeForeignKeys !== false;
	const sql: string[] = [];

	for (const tableName of Object.keys(options.schema)) {
		const validator = options.schema[tableName as TTableNames];
		const shape = getZodObjectShape(validator);
		const physicalTableName = `${prefix}${tableName}`;

		const columns: string[] = [
			`${quoteIdentifier("_id")} TEXT PRIMARY KEY NOT NULL`,
			`${quoteIdentifier("_creationTime")} INTEGER NOT NULL`,
		];
		const fks: string[] = [];

		for (const [fieldName, fieldSchema] of Object.entries(shape)) {
			const spec = inferFieldSpec(fieldSchema);
			const sqlType = sqliteTypeForField(spec);
			const nullable = spec.optional || spec.nullable;
			let columnSql = `${quoteIdentifier(fieldName)} ${sqlType}`;
			if (!nullable) columnSql += " NOT NULL";
			const defaultSql = serializeDefault(spec.defaultValue, spec);
			if (defaultSql !== undefined) columnSql += ` DEFAULT ${defaultSql}`;
			columns.push(columnSql);

			if (includeForeignKeys && spec.refTable && !spec.isArray) {
				fks.push(
					`FOREIGN KEY (${quoteIdentifier(fieldName)}) REFERENCES ${quoteIdentifier(`${prefix}${spec.refTable}`)}(${quoteIdentifier("_id")})`,
				);
			}
		}

		sql.push(
			`CREATE TABLE IF NOT EXISTS ${quoteIdentifier(physicalTableName)} (\n${[
				...columns,
				...fks,
			]
				.map((line) => `  ${line}`)
				.join(",\n")}\n);`,
		);
	}

	return { sql };
}

export type RunD1SchemaMigrationsOptions<TTableNames extends string> = {
	db: D1DatabaseLike;
	schema: Record<TTableNames, AnyZod>;
	tableNamePrefix?: string;
	deferForeignKeys?: boolean;
};

export async function runD1SchemaMigrations<TTableNames extends string>(
	options: RunD1SchemaMigrationsOptions<TTableNames>,
): Promise<{ applied: string[] }> {
	const dbh = createD1DbHandler(options.db);
	const plan = buildD1SchemaMigrations({
		schema: options.schema,
		tableNamePrefix: options.tableNamePrefix,
		includeForeignKeys: true,
	});

	await dbh.exec(
		`CREATE TABLE IF NOT EXISTS ${quoteIdentifier("_appflare_migrations")} (\n  ${quoteIdentifier("id")} INTEGER PRIMARY KEY AUTOINCREMENT,\n  ${quoteIdentifier("name")} TEXT NOT NULL UNIQUE,\n  ${quoteIdentifier("executed_at")} INTEGER NOT NULL\n);`,
	);

	if (options.deferForeignKeys !== false) {
		await dbh.exec("PRAGMA defer_foreign_keys = on");
	}

	const applied: string[] = [];
	for (let index = 0; index < plan.sql.length; index += 1) {
		const migrationName = `schema_${index + 1}`;
		const exists = await dbh.queryFirst<{ id: number }>(
			`SELECT id FROM ${quoteIdentifier("_appflare_migrations")} WHERE ${quoteIdentifier("name")} = ? LIMIT 1`,
			[migrationName],
		);
		if (exists) continue;

		await dbh.exec(plan.sql[index]);
		await dbh.exec(
			`INSERT INTO ${quoteIdentifier("_appflare_migrations")} (${quoteIdentifier("name")}, ${quoteIdentifier("executed_at")}) VALUES (?, ?)`,
			[migrationName, Date.now()],
		);
		applied.push(migrationName);
	}

	if (options.deferForeignKeys !== false) {
		await dbh.exec("PRAGMA defer_foreign_keys = off");
	}

	return { applied };
}

export type BetterAuthMigrationResult = {
	created: string[];
	added: string[];
	run: boolean;
};

export async function runBetterAuthD1Migrations(options: {
	authOptions: BetterAuthOptions;
}): Promise<BetterAuthMigrationResult> {
	const { getMigrations } = await import("better-auth/db");
	const normalizedAuthOptions = normalizeBetterAuthOptions(options.authOptions);
	const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(
		normalizedAuthOptions,
	);
	if (toBeCreated.length === 0 && toBeAdded.length === 0) {
		return { created: [], added: [], run: false };
	}
	await runMigrations();
	return {
		created: toBeCreated.map((t: any) => String(t.table)),
		added: toBeAdded.map((t: any) => String(t.table)),
		run: true,
	};
}

export type D1MigrationEndpointOptions<
	Env = unknown,
	TTableNames extends string = string,
> = {
	path?: string;
	schema?: Record<TTableNames, AnyZod>;
	getDb: (c: Context<Env>) => D1DatabaseLike;
	getBetterAuthOptions?: (
		c: Context<Env>,
		db: D1DatabaseLike,
	) => BetterAuthOptions | Promise<BetterAuthOptions>;
	tableNamePrefix?: string;
};

export function createD1MigrationRouter<
	Env = unknown,
	TTableNames extends string = string,
>(options: D1MigrationEndpointOptions<Env, TTableNames>): Hono<Env> {
	const app = new Hono<Env>();
	const path = options.path ?? "/migrate";

	app.post(path, async (c) => {
		try {
			const db = options.getDb(c);
			const body: Record<string, unknown> = {
				ok: true,
			};

			if (options.getBetterAuthOptions) {
				const authOptions = await options.getBetterAuthOptions(c, db);
				const authMigration = await runBetterAuthD1Migrations({ authOptions });
				body.auth = authMigration;
			}

			if (options.schema) {
				const schemaMigration = await runD1SchemaMigrations({
					db,
					schema: options.schema,
					tableNamePrefix: options.tableNamePrefix,
				});
				body.schema = schemaMigration;
			}

			return c.json(body);
		} catch (error) {
			return c.json(
				{
					ok: false,
					error:
						error instanceof Error ? error.message : String(error ?? "unknown"),
				},
				500,
			);
		}
	});

	return app;
}
