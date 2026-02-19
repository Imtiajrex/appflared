import type {
	AnyZod,
	TableDocBase,
	Id,
	AppflareSelect,
	AppflareInclude,
	AppflareResultDoc,
	AppflareFindManyArgs,
	AppflareFindFirstArgs,
	AppflareFindUniqueArgs,
	AppflareCreateArgs,
	AppflareUpdateArgs,
	AppflareUpdateManyArgs,
	AppflareDeleteArgs,
	AppflareDeleteManyArgs,
	AppflareCountArgs,
	AppflareAggregateArgs,
	AggregateResult,
	NormalizeGroupInput,
} from "../types/types";
import { buildSchemaRefMap } from "../types/schema-refs";

type D1PreparedStatementLike = {
	bind: (...values: unknown[]) => D1PreparedStatementLike;
	all: <T = unknown>() => Promise<{ results?: T[] }>;
	first: <T = unknown>() => Promise<T | null>;
	run: () => Promise<unknown>;
};

type D1DatabaseLike = {
	prepare: (query: string) => D1PreparedStatementLike;
	exec?: (query: string) => Promise<unknown>;
};

type TableSpec = {
	name: string;
	fields: Record<string, FieldSpec>;
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

type TableState<TTableNames extends string> = {
	db: D1DatabaseLike;
	tableSpecs: Map<TTableNames, TableSpec>;
	refs: Map<string, Map<string, string>>;
	initialized?: Promise<void>;
};

type IncludeRecord = Record<string, unknown>;

const SQLITE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

function quoteIdentifier(name: string): string {
	if (!SQLITE_IDENTIFIER.test(name)) {
		throw new Error(`Invalid SQL identifier: ${name}`);
	}
	return `"${name}"`;
}

function ensureD1<TTableNames extends string>(
	state: TableState<TTableNames> | undefined,
): TableState<TTableNames> {
	if (!state?.db) {
		throw new Error(
			"Appflare D1 context is not configured. Pass { d1 } into createAppflareDbContext(...).",
		);
	}
	return state;
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

function serializeFieldValue(value: unknown, spec: FieldSpec): unknown {
	if (value === undefined) return undefined;
	if (value === null) return null;
	if (spec.isObjectLike) return JSON.stringify(value);
	if (spec.typeName === "ZodBoolean" || spec.typeName === "boolean") {
		return value ? 1 : 0;
	}
	if (spec.typeName === "ZodDate" || spec.typeName === "date") {
		const dt = value instanceof Date ? value : new Date(value as any);
		return dt.toISOString();
	}
	return value;
}

function parseFieldValue(value: unknown, spec: FieldSpec): unknown {
	if (value === undefined || value === null) return value;
	if (spec.isObjectLike && typeof value === "string") {
		try {
			return JSON.parse(value);
		} catch {
			return value;
		}
	}
	if (spec.typeName === "ZodBoolean" || spec.typeName === "boolean") {
		if (typeof value === "number") return value !== 0;
		if (typeof value === "string") return value === "1" || value === "true";
	}
	if (
		(spec.typeName === "ZodNumber" || spec.typeName === "number") &&
		typeof value === "string" &&
		value.length > 0
	) {
		const n = Number(value);
		return Number.isNaN(n) ? value : n;
	}
	if (spec.typeName === "ZodDate" || spec.typeName === "date") {
		const dt = new Date(value as any);
		return Number.isNaN(dt.getTime()) ? value : dt;
	}
	return value;
}

function make24HexId(): string {
	if (globalThis.crypto?.getRandomValues) {
		const arr = new Uint8Array(12);
		globalThis.crypto.getRandomValues(arr);
		return Array.from(arr)
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
	}
	let out = "";
	for (let i = 0; i < 24; i++) {
		out += Math.floor(Math.random() * 16).toString(16);
	}
	return out;
}

async function d1All<T>(
	db: D1DatabaseLike,
	query: string,
	params: unknown[] = [],
): Promise<T[]> {
	const stmt = db.prepare(query).bind(...params);
	const result = await stmt.all<T>();
	return result?.results ?? [];
}

async function d1First<T>(
	db: D1DatabaseLike,
	query: string,
	params: unknown[] = [],
): Promise<T | null> {
	const stmt = db.prepare(query).bind(...params);
	return stmt.first<T>();
}

async function d1Run(
	db: D1DatabaseLike,
	query: string,
	params: unknown[] = [],
): Promise<void> {
	const stmt = db.prepare(query).bind(...params);
	await stmt.run();
}

function buildTableSpecs<TTableNames extends string>(
	schema: Record<TTableNames, AnyZod>,
): Map<TTableNames, TableSpec> {
	const out = new Map<TTableNames, TableSpec>();
	for (const tableName of Object.keys(schema) as TTableNames[]) {
		const validator = schema[tableName];
		const shape = getZodObjectShape(validator);
		const fields: Record<string, FieldSpec> = {};
		for (const [fieldName, fieldSchema] of Object.entries(shape)) {
			fields[fieldName] = inferFieldSpec(fieldSchema);
		}
		out.set(tableName, { name: tableName, fields });
	}
	return out;
}

async function ensureSchema<TTableNames extends string>(
	state: TableState<TTableNames>,
): Promise<void> {
	if (state.initialized) {
		await state.initialized;
		return;
	}
	state.initialized = (async () => {
		await d1Run(state.db, "PRAGMA defer_foreign_keys = on");
		for (const [tableName, tableSpec] of state.tableSpecs.entries()) {
			const columns: string[] = [
				`${quoteIdentifier("_id")} TEXT PRIMARY KEY NOT NULL`,
				`${quoteIdentifier("_creationTime")} INTEGER NOT NULL`,
			];
			const fks: string[] = [];

			for (const [fieldName, fieldSpec] of Object.entries(tableSpec.fields)) {
				const col = quoteIdentifier(fieldName);
				const sqlType = sqliteTypeForField(fieldSpec);
				const nullable = fieldSpec.optional || fieldSpec.nullable;
				let columnSql = `${col} ${sqlType}`;
				if (!nullable) columnSql += " NOT NULL";

				if (fieldSpec.defaultValue !== undefined) {
					const serializedDefault = serializeFieldValue(
						fieldSpec.defaultValue,
						fieldSpec,
					);
					if (serializedDefault === null) {
						columnSql += " DEFAULT NULL";
					} else if (typeof serializedDefault === "number") {
						columnSql += ` DEFAULT ${serializedDefault}`;
					} else {
						columnSql += ` DEFAULT ${JSON.stringify(String(serializedDefault))}`;
					}
				}

				columns.push(columnSql);

				if (fieldSpec.refTable && !fieldSpec.isArray) {
					fks.push(
						`FOREIGN KEY (${col}) REFERENCES ${quoteIdentifier(fieldSpec.refTable)}(${quoteIdentifier("_id")})`,
					);
				}
			}

			const createSql = `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(tableName)} (\n${[
				...columns,
				...fks,
			]
				.map((line) => `  ${line}`)
				.join(",\n")}\n)`;
			await d1Run(state.db, createSql);
		}
		await d1Run(state.db, "PRAGMA defer_foreign_keys = off");
	})();
	await state.initialized;
}

function normalizeSortInput(orderBy: any): Array<[string, "asc" | "desc"]> {
	if (!orderBy) return [];
	if (Array.isArray(orderBy)) {
		return orderBy
			.filter((x) => Array.isArray(x) && x.length >= 2)
			.map(([field, dir]) => [String(field), dir === "desc" ? "desc" : "asc"]);
	}
	if (typeof orderBy === "object") {
		return Object.entries(orderBy as Record<string, unknown>).map(([k, v]) => [
			k,
			v === "desc" ? "desc" : "asc",
		]);
	}
	return [];
}

function normalizeWhereToSql(
	where: any,
	params: unknown[],
	allowedFields?: Set<string>,
): string {
	if (!where || typeof where !== "object") return "";

	const parts: string[] = [];
	const entries = Object.entries(where);

	for (const [key, value] of entries) {
		if (key === "$and" || key === "and") {
			const arr = Array.isArray(value) ? value : [];
			const child = arr
				.map((v) => normalizeWhereToSql(v, params, allowedFields))
				.filter(Boolean);
			if (child.length) parts.push(`(${child.join(" AND ")})`);
			continue;
		}
		if (key === "$or" || key === "or") {
			const arr = Array.isArray(value) ? value : [];
			const child = arr
				.map((v) => normalizeWhereToSql(v, params, allowedFields))
				.filter(Boolean);
			if (child.length) parts.push(`(${child.join(" OR ")})`);
			continue;
		}
		if (key === "$not" || key === "not") {
			const child = normalizeWhereToSql(value, params, allowedFields);
			if (child) parts.push(`NOT (${child})`);
			continue;
		}

		if (allowedFields && !allowedFields.has(key)) continue;

		const col = quoteIdentifier(key);
		if (value && typeof value === "object" && !Array.isArray(value)) {
			const opEntries = Object.entries(value as Record<string, unknown>);
			for (const [opRaw, operand] of opEntries) {
				const op = opRaw.startsWith("$") ? opRaw.slice(1) : opRaw;
				switch (op) {
					case "eq":
						params.push(operand);
						parts.push(`${col} = ?`);
						break;
					case "ne":
						params.push(operand);
						parts.push(`${col} != ?`);
						break;
					case "gt":
						params.push(operand);
						parts.push(`${col} > ?`);
						break;
					case "gte":
						params.push(operand);
						parts.push(`${col} >= ?`);
						break;
					case "lt":
						params.push(operand);
						parts.push(`${col} < ?`);
						break;
					case "lte":
						params.push(operand);
						parts.push(`${col} <= ?`);
						break;
					case "in": {
						const arr = Array.isArray(operand) ? operand : [];
						if (!arr.length) {
							parts.push("1 = 0");
							break;
						}
						parts.push(`${col} IN (${arr.map(() => "?").join(",")})`);
						params.push(...arr);
						break;
					}
					case "nin": {
						const arr = Array.isArray(operand) ? operand : [];
						if (!arr.length) break;
						parts.push(`${col} NOT IN (${arr.map(() => "?").join(",")})`);
						params.push(...arr);
						break;
					}
					case "exists":
						parts.push(operand ? `${col} IS NOT NULL` : `${col} IS NULL`);
						break;
					case "regex": {
						const pat =
							typeof operand === "string"
								? operand
								: typeof (operand as any)?.pattern === "string"
									? (operand as any).pattern
									: undefined;
						if (pat) {
							params.push(`%${pat}%`);
							parts.push(`${col} LIKE ?`);
						}
						break;
					}
					default:
						break;
				}
			}
			continue;
		}

		if (value === null) {
			parts.push(`${col} IS NULL`);
			continue;
		}

		params.push(value);
		parts.push(`${col} = ?`);
	}

	return parts.join(" AND ");
}

function normalizeDocFromRow<TDoc extends Record<string, unknown>>(
	row: Record<string, unknown>,
	tableSpec: TableSpec,
): TDoc {
	const out: Record<string, unknown> = {
		_id: row._id,
		_creationTime: row._creationTime,
	};
	for (const [fieldName, fieldSpec] of Object.entries(tableSpec.fields)) {
		out[fieldName] = parseFieldValue(row[fieldName], fieldSpec);
	}
	return out as TDoc;
}

function applySelect<TDoc extends Record<string, unknown>>(
	doc: TDoc,
	select: unknown,
): Record<string, unknown> {
	if (!select) return doc;
	const result: Record<string, unknown> = {};
	if (Array.isArray(select)) {
		for (const key of select as string[]) result[key] = (doc as any)[key];
		return result;
	}
	if (typeof select === "object") {
		for (const [k, v] of Object.entries(select as Record<string, unknown>)) {
			if (v) result[k] = (doc as any)[k];
		}
		return result;
	}
	return doc;
}

async function populateDocs<TTableNames extends string>(
	state: TableState<TTableNames>,
	table: TTableNames,
	docs: Array<Record<string, unknown>>,
	include: unknown,
): Promise<void> {
	if (!include || !docs.length) return;
	const tableRefs = state.refs.get(table as string);
	if (!tableRefs || tableRefs.size === 0) return;

	const includeRecord: IncludeRecord = Array.isArray(include)
		? Object.fromEntries((include as string[]).map((key) => [key, true]))
		: ((include as IncludeRecord) ?? {});

	for (const [field, includeValue] of Object.entries(includeRecord)) {
		const refTable = tableRefs.get(field);
		if (!refTable) continue;

		const targetSpec = state.tableSpecs.get(refTable as TTableNames);
		if (!targetSpec) continue;

		const ids = new Set<string>();
		for (const doc of docs) {
			const raw = doc[field];
			if (Array.isArray(raw)) {
				for (const id of raw) if (typeof id === "string") ids.add(id);
			} else if (typeof raw === "string") {
				ids.add(raw);
			}
		}

		if (ids.size === 0) continue;
		const idList = Array.from(ids);
		const rows = await d1All<Record<string, unknown>>(
			state.db,
			`SELECT * FROM ${quoteIdentifier(refTable)} WHERE ${quoteIdentifier("_id")} IN (${idList
				.map(() => "?")
				.join(",")})`,
			idList,
		);
		const byId = new Map<string, Record<string, unknown>>();
		for (const row of rows) {
			const parsed = normalizeDocFromRow(row, targetSpec);
			if (typeof parsed._id === "string") byId.set(parsed._id, parsed);
		}

		for (const doc of docs) {
			const raw = doc[field];
			if (Array.isArray(raw)) {
				doc[field] = raw
					.map((id) => byId.get(String(id)))
					.filter(Boolean) as unknown[];
			} else if (typeof raw === "string") {
				doc[field] = byId.get(raw) ?? null;
			}
		}

		const aggregate =
			includeValue && typeof includeValue === "object"
				? (includeValue as any).aggregate
				: undefined;
		const includeDocs =
			includeValue && typeof includeValue === "object"
				? (includeValue as any).includeDocs !== false
				: true;

		if (!includeDocs) {
			for (const doc of docs) {
				if (Array.isArray(doc[field])) doc[field] = [];
				else doc[field] = null;
			}
		}

		if (aggregate) {
			for (const doc of docs) {
				const items = Array.isArray(doc[field])
					? (doc[field] as Array<Record<string, unknown>>)
					: doc[field]
						? [doc[field] as Record<string, unknown>]
						: [];
				const aggResult: Record<string, number> = {};
				if (aggregate.count) aggResult.count = items.length;
				for (const key of aggregate.sum ?? []) {
					const total = items.reduce((acc, item) => {
						const n = Number((item as any)[key]);
						return Number.isFinite(n) ? acc + n : acc;
					}, 0);
					aggResult[`sum_${key}`] = total;
				}
				for (const key of aggregate.avg ?? []) {
					const nums = items
						.map((item) => Number((item as any)[key]))
						.filter((n) => Number.isFinite(n));
					aggResult[`avg_${key}`] = nums.length
						? nums.reduce((a, b) => a + b, 0) / nums.length
						: 0;
				}
				(doc as any)._aggregates = {
					...((doc as any)._aggregates ?? {}),
					[field]: aggResult,
				};
			}
		}
	}
}

async function runAggregate<TDoc extends Record<string, unknown>>(
	docs: TDoc[],
	args: AppflareAggregateArgs<any, any, any, any, any>,
): Promise<any[]> {
	const groupInput = args.groupBy;
	const groupFields =
		typeof groupInput === "string"
			? [groupInput]
			: Array.isArray(groupInput)
				? (groupInput as string[])
				: [];

	const groups = new Map<string, { key: unknown; docs: TDoc[] }>();
	for (const doc of docs) {
		const idValue =
			groupFields.length === 0
				? null
				: groupFields.length === 1
					? (doc as any)[groupFields[0]]
					: Object.fromEntries(groupFields.map((k) => [k, (doc as any)[k]]));
		const key = JSON.stringify(idValue);
		const existing = groups.get(key);
		if (existing) {
			existing.docs.push(doc);
		} else {
			groups.set(key, { key: idValue, docs: [doc] });
		}
	}

	const out: Array<Record<string, unknown>> = [];
	for (const group of groups.values()) {
		const row: Record<string, unknown> = { _id: group.key };
		for (const field of (args.sum ?? []) as string[]) {
			row[`sum_${field}`] = group.docs.reduce((acc, item) => {
				const n = Number((item as any)[field]);
				return Number.isFinite(n) ? acc + n : acc;
			}, 0);
		}
		for (const field of (args.avg ?? []) as string[]) {
			const nums = group.docs
				.map((item) => Number((item as any)[field]))
				.filter((n) => Number.isFinite(n));
			row[`avg_${field}`] = nums.length
				? nums.reduce((a, b) => a + b, 0) / nums.length
				: 0;
		}
		out.push(row);
	}
	return out;
}

export type AppflareDbContext<
	TTableNames extends string,
	TTableDocMap extends Record<TTableNames, TableDocBase>,
> = {
	[K in TTableNames]: AppflareTableClient<K, TTableDocMap>;
};

export type AppflareTableClient<
	TableName extends string,
	TTableDocMap extends Record<TableName, TableDocBase>,
> = {
	findMany<TSelect = AppflareSelect<TTableDocMap[TableName]>, TInclude = never>(
		args?: AppflareFindManyArgs<TableName, TTableDocMap> & {
			select?: TSelect;
			include?: TInclude;
		},
	): Promise<
		Array<
			AppflareResultDoc<
				TTableDocMap[TableName],
				TSelect,
				TInclude,
				TTableDocMap
			>
		>
	>;
	findFirst<
		TSelect = AppflareSelect<TTableDocMap[TableName]>,
		TInclude = never,
	>(
		args?: AppflareFindFirstArgs<TableName, TTableDocMap> & {
			select?: TSelect;
			include?: TInclude;
		},
	): Promise<AppflareResultDoc<
		TTableDocMap[TableName],
		TSelect,
		TInclude,
		TTableDocMap
	> | null>;
	findUnique<
		TSelect = AppflareSelect<TTableDocMap[TableName]>,
		TInclude = never,
	>(
		args: AppflareFindUniqueArgs<TableName, TTableDocMap> & {
			select?: TSelect;
			include?: TInclude;
		},
	): Promise<AppflareResultDoc<
		TTableDocMap[TableName],
		TSelect,
		TInclude,
		TTableDocMap
	> | null>;
	create<TSelect = AppflareSelect<TTableDocMap[TableName]>, TInclude = never>(
		args: AppflareCreateArgs<TableName, TTableDocMap> & {
			select?: TSelect;
			include?: TInclude;
		},
	): Promise<
		AppflareResultDoc<TTableDocMap[TableName], TSelect, TInclude, TTableDocMap>
	>;
	update<TSelect = AppflareSelect<TTableDocMap[TableName]>, TInclude = never>(
		args: AppflareUpdateArgs<TableName, TTableDocMap> & {
			select?: TSelect;
			include?: TInclude;
		},
	): Promise<AppflareResultDoc<
		TTableDocMap[TableName],
		TSelect,
		TInclude,
		TTableDocMap
	> | null>;
	updateMany(
		args: AppflareUpdateManyArgs<TableName, TTableDocMap>,
	): Promise<{ count: number }>;
	delete<TSelect = AppflareSelect<TTableDocMap[TableName]>, TInclude = never>(
		args: AppflareDeleteArgs<TableName, TTableDocMap> & {
			select?: TSelect;
			include?: TInclude;
		},
	): Promise<AppflareResultDoc<
		TTableDocMap[TableName],
		TSelect,
		TInclude,
		TTableDocMap
	> | null>;
	deleteMany(
		args?: AppflareDeleteManyArgs<TableName, TTableDocMap>,
	): Promise<{ count: number }>;
	count(args?: AppflareCountArgs<TableName, TTableDocMap>): Promise<number>;
	aggregate<
		TGroup = any,
		TSum extends ReadonlyArray<any> = ReadonlyArray<any>,
		TAvg extends ReadonlyArray<any> = ReadonlyArray<any>,
	>(
		args: AppflareAggregateArgs<TableName, TTableDocMap, TGroup, any, any>,
	): Promise<Array<any>>;
};

export type AppflareCoreContext<
	TTableNames extends string,
	TTableDocMap extends Record<TTableNames, TableDocBase>,
> = {
	query<TableName extends TTableNames>(table: TableName): any;
	insert<TableName extends TTableNames>(
		table: TableName,
		value: any,
	): Promise<Id<TableName>>;
	update<TableName extends TTableNames>(
		table: TableName,
		where: any,
		partial: any,
	): Promise<void>;
	patch<TableName extends TTableNames>(
		table: TableName,
		where: any,
		partial: any,
	): Promise<void>;
	delete<TableName extends TTableNames>(
		table: TableName,
		where: any,
	): Promise<void>;
};

export type CreateAppflareDbContextOptions<TTableNames extends string> = {
	schema: Record<TTableNames, AnyZod>;
	collectionName?: (table: TTableNames) => string;
	d1?: D1DatabaseLike;
};

export function createAppflareDbContext<
	TTableNames extends string,
	TTableDocMap extends Record<TTableNames, TableDocBase>,
>(
	options: CreateAppflareDbContextOptions<TTableNames>,
): AppflareDbContext<TTableNames, TTableDocMap> {
	const tableSpecs = buildTableSpecs(options.schema);
	const refs = buildSchemaRefMap(options.schema as Record<string, AnyZod>);
	const state: TableState<TTableNames> | undefined = options.d1
		? {
				db: options.d1,
				tableSpecs,
				refs,
			}
		: undefined;

	const tableClients = {} as any;

	for (const tableName of Object.keys(options.schema) as TTableNames[]) {
		tableClients[tableName] = {
			findMany: async (args?: any) => {
				const s = ensureD1(state);
				await ensureSchema(s);
				const spec = s.tableSpecs.get(tableName)!;
				const params: unknown[] = [];
				const allowedFields = new Set([
					"_id",
					"_creationTime",
					...Object.keys(spec.fields),
				]);
				const whereSql = normalizeWhereToSql(
					args?.where,
					params,
					allowedFields,
				);
				const sortSql = normalizeSortInput(args?.orderBy)
					.filter(([k]) => allowedFields.has(k))
					.map(([k, dir]) => `${quoteIdentifier(k)} ${dir.toUpperCase()}`)
					.join(", ");

				const sql = [
					`SELECT * FROM ${quoteIdentifier(tableName)}`,
					whereSql ? `WHERE ${whereSql}` : "",
					sortSql ? `ORDER BY ${sortSql}` : "",
					typeof args?.take === "number"
						? `LIMIT ${Math.max(0, args.take)}`
						: "",
					typeof args?.skip === "number"
						? `OFFSET ${Math.max(0, args.skip)}`
						: "",
				]
					.filter(Boolean)
					.join(" ");

				const rows = await d1All<Record<string, unknown>>(s.db, sql, params);
				const docs = rows.map((row) => normalizeDocFromRow(row, spec));
				const out = docs.map((doc) => applySelect(doc, args?.select));
				await populateDocs(s, tableName, out, args?.include);
				return out;
			},

			findFirst: async (args?: any) => {
				const rows = await tableClients[tableName].findMany({
					...(args ?? {}),
					take: 1,
				});
				return rows[0] ?? null;
			},

			findUnique: async (args: any) => {
				const where =
					typeof args?.where === "string"
						? { _id: args.where }
						: (args?.where ?? {});
				const rows = await tableClients[tableName].findMany({
					...(args ?? {}),
					where,
					take: 1,
				});
				return rows[0] ?? null;
			},

			create: async (args: any) => {
				const s = ensureD1(state);
				await ensureSchema(s);
				const spec = s.tableSpecs.get(tableName)!;
				const validator = options.schema[tableName];
				const parsed = (validator as any).parse(args.data ?? {});
				const now = Date.now();
				const id = make24HexId();

				const columns = ["_id", "_creationTime", ...Object.keys(spec.fields)];
				const values: unknown[] = [id, now];
				for (const fieldName of Object.keys(spec.fields)) {
					const fieldSpec = spec.fields[fieldName];
					const value = (parsed as any)[fieldName];
					values.push(serializeFieldValue(value, fieldSpec));
				}

				const sql = `INSERT INTO ${quoteIdentifier(tableName)} (${columns
					.map(quoteIdentifier)
					.join(",")}) VALUES (${columns.map(() => "?").join(",")})`;
				await d1Run(s.db, sql, values);

				const created = await tableClients[tableName].findUnique({
					where: { _id: id } as any,
					select: args?.select,
					include: args?.include,
				});
				return created as any;
			},

			update: async (args: any) => {
				const s = ensureD1(state);
				await ensureSchema(s);
				const spec = s.tableSpecs.get(tableName)!;
				const existing = await tableClients[tableName].findUnique({
					where: args.where,
				});
				if (!existing) return null;

				const sets: string[] = [];
				const params: unknown[] = [];
				for (const [field, value] of Object.entries(args.data ?? {})) {
					if (!spec.fields[field]) continue;
					sets.push(`${quoteIdentifier(field)} = ?`);
					params.push(serializeFieldValue(value, spec.fields[field]));
				}
				if (sets.length === 0) {
					return tableClients[tableName].findUnique({
						where: { _id: (existing as any)._id },
						select: args?.select,
						include: args?.include,
					});
				}

				params.push((existing as any)._id);
				await d1Run(
					s.db,
					`UPDATE ${quoteIdentifier(tableName)} SET ${sets.join(", ")} WHERE ${quoteIdentifier("_id")} = ?`,
					params,
				);

				return tableClients[tableName].findUnique({
					where: { _id: (existing as any)._id },
					select: args?.select,
					include: args?.include,
				});
			},

			updateMany: async (args: any) => {
				const items = await tableClients[tableName].findMany({
					where: args?.where,
				});
				let count = 0;
				for (const item of items) {
					await tableClients[tableName].update({
						where: { _id: (item as any)._id },
						data: args?.data,
					});
					count += 1;
				}
				return { count };
			},

			delete: async (args: any) => {
				const s = ensureD1(state);
				await ensureSchema(s);
				const existing = await tableClients[tableName].findUnique({
					where: args.where,
					select: args.select,
					include: args.include,
				});
				if (!existing) return null;
				await d1Run(
					s.db,
					`DELETE FROM ${quoteIdentifier(tableName)} WHERE ${quoteIdentifier("_id")} = ?`,
					[(existing as any)._id],
				);
				return existing;
			},

			deleteMany: async (args?: any) => {
				const items = await tableClients[tableName].findMany({
					where: args?.where,
				});
				for (const item of items) {
					await tableClients[tableName].delete({
						where: { _id: (item as any)._id },
					});
				}
				return { count: items.length };
			},

			count: async (args?: any) => {
				const s = ensureD1(state);
				await ensureSchema(s);
				const spec = s.tableSpecs.get(tableName)!;
				const params: unknown[] = [];
				const allowedFields = new Set([
					"_id",
					"_creationTime",
					...Object.keys(spec.fields),
				]);
				const whereSql = normalizeWhereToSql(
					args?.where,
					params,
					allowedFields,
				);
				const row = await d1First<{ value: number }>(
					s.db,
					`SELECT COUNT(*) as value FROM ${quoteIdentifier(tableName)} ${whereSql ? `WHERE ${whereSql}` : ""}`,
					params,
				);
				return Number(row?.value ?? 0);
			},

			aggregate: async (args: any) => {
				const docs = await tableClients[tableName].findMany({
					where: args?.where,
					include: args?.populate,
				});
				return runAggregate(docs as any, args);
			},
		};
	}

	return tableClients as AppflareDbContext<TTableNames, TTableDocMap>;
}
