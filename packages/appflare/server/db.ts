import type {
	Collection,
	Db,
	Document,
	Filter,
	FindOptions,
	Sort,
} from "mongodb";
import { ObjectId } from "mongodb";

type AnyZod = any;

type TableDocBase = {
	_id: string;
	_creationTime: number;
};

type Id<TableName extends string> = string & { __table?: TableName };

type EditableDoc<TDoc extends TableDocBase> = Omit<
	TDoc,
	"_id" | "_creationTime"
>;

type SortDirection = "asc" | "desc";

type QuerySort<TKey extends string> =
	| Partial<Record<TKey, SortDirection>>
	| Array<[TKey, SortDirection]>
	| Record<string, SortDirection>
	| Array<[string, SortDirection]>;

type QueryWhere<TDoc extends Record<string, unknown>> = Partial<TDoc> &
	Record<string, unknown>;

type Keys<T> = keyof T;

type NonNil<T> = Exclude<T, null | undefined>;

type ExtractIdTableName<T> =
	NonNil<T> extends Id<infer TTable>
		? TTable
		: NonNil<T> extends Array<infer TItem>
			? ExtractIdTableName<TItem>
			: never;

type PopulateValue<T, TTableDocMap extends Record<string, TableDocBase>> =
	T extends Id<infer TTable>
		? TTable extends keyof TTableDocMap
			? TTableDocMap[TTable]
			: never
		: T extends Array<infer TItem>
			? Array<PopulateValue<TItem, TTableDocMap>>
			: T;

type PopulatableKeys<
	TDoc,
	TTableDocMap extends Record<string, TableDocBase>,
> = {
	[K in Keys<TDoc>]: ExtractIdTableName<TDoc[K]> extends keyof TTableDocMap
		? K
		: never;
}[Keys<TDoc>];

type WithPopulated<
	TDoc,
	TKey extends Keys<TDoc>,
	TTableDocMap extends Record<string, TableDocBase>,
> = {
	[K in Keys<TDoc>]: K extends TKey
		? PopulateValue<TDoc[K], TTableDocMap>
		: TDoc[K];
};

type WithPopulatedMany<
	TDoc,
	TKeys extends Keys<TDoc>,
	TTableDocMap extends Record<string, TableDocBase>,
> = {
	[K in Keys<TDoc>]: K extends TKeys
		? PopulateValue<TDoc[K], TTableDocMap>
		: TDoc[K];
};

type WithSelected<TDoc, TKeys extends Keys<TDoc>> = Pick<TDoc, TKeys>;

export type MongoDbContext<
	TTableNames extends string,
	TTableDocMap extends Record<TTableNames, TableDocBase>,
> = {
	query<TableName extends TTableNames>(
		table: TableName
	): MongoDbQuery<TableName, TTableDocMap, TTableDocMap[TableName]>;
	insert<TableName extends TTableNames>(
		table: TableName,
		value: EditableDoc<TTableDocMap[TableName]>
	): Promise<Id<TableName>>;
	update<TableName extends TTableNames>(
		table: TableName,
		id: Id<TableName>,
		partial: Partial<EditableDoc<TTableDocMap[TableName]>>
	): Promise<void>;
	patch<TableName extends TTableNames>(
		table: TableName,
		id: Id<TableName>,
		partial: Partial<EditableDoc<TTableDocMap[TableName]>>
	): Promise<void>;
	delete<TableName extends TTableNames>(
		table: TableName,
		id: Id<TableName>
	): Promise<void>;
};

export type MongoDbQuery<
	TableName extends string,
	TTableDocMap extends Record<string, TableDocBase>,
	TResultDoc,
> = {
	where(
		filter: QueryWhere<TTableDocMap[TableName]>
	): MongoDbQuery<TableName, TTableDocMap, TResultDoc>;
	sort(
		sort: QuerySort<keyof TTableDocMap[TableName] & string>
	): MongoDbQuery<TableName, TTableDocMap, TResultDoc>;
	limit(limit: number): MongoDbQuery<TableName, TTableDocMap, TResultDoc>;
	offset(offset: number): MongoDbQuery<TableName, TTableDocMap, TResultDoc>;

	select<const TKeys extends readonly Keys<TResultDoc>[]>(
		keys: TKeys
	): MongoDbQuery<
		TableName,
		TTableDocMap,
		WithSelected<TResultDoc, TKeys[number]>
	>;
	select<const TKeys extends readonly Keys<TResultDoc>[]>(
		...keys: TKeys
	): MongoDbQuery<
		TableName,
		TTableDocMap,
		WithSelected<TResultDoc, TKeys[number]>
	>;

	populate<const TKey extends PopulatableKeys<TResultDoc, TTableDocMap>>(
		key: TKey
	): MongoDbQuery<
		TableName,
		TTableDocMap,
		WithPopulated<TResultDoc, TKey, TTableDocMap>
	>;
	populate<
		const TKeys extends readonly PopulatableKeys<TResultDoc, TTableDocMap>[],
	>(
		keys: TKeys
	): MongoDbQuery<
		TableName,
		TTableDocMap,
		WithPopulatedMany<TResultDoc, TKeys[number], TTableDocMap>
	>;

	find(): Promise<Array<TResultDoc>>;
	findOne(): Promise<TResultDoc | null>;
};

export type CreateMongoDbContextOptions<TTableNames extends string> = {
	db: Db;
	/** The same schema object you pass to defineSchema(...) */
	schema: Record<TTableNames, AnyZod>;
	/** Override collection naming if desired. Default is the table name. */
	collectionName?: (table: TTableNames) => string;
};

/**
 * Creates an Appflare-compatible DB context backed by the MongoDB native driver.
 *
 * - Tables map 1:1 to MongoDB collections
 * - `_id` is stored as a 24-char ObjectId hex string
 * - `populate()` uses `v.id("table")` / `.describe("ref:table")` info from the schema
 */
export function createMongoDbContext<
	TTableNames extends string,
	TTableDocMap extends Record<TTableNames, TableDocBase>,
>(
	options: CreateMongoDbContextOptions<TTableNames>
): MongoDbContext<TTableNames, TTableDocMap> {
	const collectionName = options.collectionName ?? ((t) => t);
	const collections = new Map<string, Collection<Document>>();
	const refs = buildSchemaRefMap(options.schema);

	const getCollection = (table: string): Collection<Document> => {
		const key = collectionName(table as any);
		const existing = collections.get(key);
		if (existing) return existing;
		const created = options.db.collection(key);
		collections.set(key, created);
		return created;
	};

	const ctx: MongoDbContext<TTableNames, TTableDocMap> = {
		query: (table) =>
			createQueryBuilder<TTableNames, TTableDocMap, any>({
				table: table as any,
				getCollection,
				refs,
			}),
		insert: async (table, value) => {
			const coll = getCollection(table as string);
			const id = new ObjectId().toHexString() as Id<any>;
			const doc = {
				...(value as Record<string, unknown>),
				_id: id,
				_creationTime: Date.now(),
			} as unknown as Document;

			await coll.insertOne(doc);
			return id as any;
		},
		update: async (table, id, partial) => {
			const coll = getCollection(table as string);
			await coll.updateOne(
				{ _id: id as any } satisfies Filter<Document> as any,
				{ $set: partial as any }
			);
		},
		patch: async (table, id, partial) => {
			const coll = getCollection(table as string);
			await coll.updateOne(
				{ _id: id as any } satisfies Filter<Document> as any,
				{ $set: partial as any }
			);
		},
		delete: async (table, id) => {
			const coll = getCollection(table as string);
			await coll.deleteOne({
				_id: id as any,
			} satisfies Filter<Document> as any);
		},
	};

	return ctx;
}

function createQueryBuilder<
	TTableNames extends string,
	TTableDocMap extends Record<TTableNames, TableDocBase>,
	TableName extends TTableNames,
>(params: {
	table: TableName;
	getCollection: (table: string) => Collection<Document>;
	refs: SchemaRefMap;
}): MongoDbQuery<TableName, TTableDocMap, TTableDocMap[TableName]> {
	let filter: Filter<Document> | undefined;
	let sort: Sort | undefined;
	let limit: number | undefined;
	let offset: number | undefined;
	let selectedKeys: string[] | undefined;
	let populateKeys: string[] = [];

	const api: MongoDbQuery<any, any, any> = {
		where(next) {
			const nextFilter = next as unknown as Filter<Document>;
			if (!filter) {
				filter = nextFilter;
			} else {
				filter = { $and: [filter as any, nextFilter as any] } as any;
			}
			return api;
		},
		sort(next) {
			sort = normalizeSort(next as any);
			return api;
		},
		limit(n) {
			limit = n;
			return api;
		},
		offset(n) {
			offset = n;
			return api;
		},
		select(...args) {
			const keys = Array.isArray(args[0])
				? (args[0] as any[])
				: (args as any[]);
			selectedKeys = keys.map(String);
			return api;
		},
		populate(arg: any) {
			const keys = Array.isArray(arg) ? arg : [arg];
			for (const k of keys) {
				const ks = String(k);
				if (!populateKeys.includes(ks)) populateKeys.push(ks);
			}
			return api;
		},
		async find() {
			const coll = params.getCollection(params.table as string);
			const options: FindOptions = {};
			if (selectedKeys) {
				options.projection = buildProjection(selectedKeys);
			}
			let cursor = coll.find(filter ?? ({} as any), options);
			if (sort) cursor = cursor.sort(sort);
			if (offset !== undefined) cursor = cursor.skip(offset);
			if (limit !== undefined) cursor = cursor.limit(limit);
			const docs = (await cursor.toArray()) as Array<Record<string, unknown>>;

			if (populateKeys.length > 0) {
				await applyPopulate({
					docs,
					currentTable: params.table as string,
					populateKeys,
					selectedKeys,
					refs: params.refs,
					getCollection: params.getCollection,
				});
			}

			return docs as any;
		},
		async findOne() {
			if (limit === undefined || limit > 1) {
				limit = 1;
			}
			const result = await api.find();
			return (result[0] ?? null) as any;
		},
	};

	return api as any;
}

function buildProjection(keys: string[]): Record<string, 0 | 1> {
	const projection: Record<string, 0 | 1> = {};
	for (const k of keys) projection[k] = 1;

	// Mongo includes _id by default; keep runtime aligned with schema-types `select()`.
	if (!keys.includes("_id")) projection._id = 0;
	if (!keys.includes("_creationTime")) projection._creationTime = 0;
	return projection;
}

function normalizeSort(sort: QuerySort<string>): Sort {
	if (Array.isArray(sort)) {
		return Object.fromEntries(
			sort.map(([k, dir]) => [k, dir === "desc" ? -1 : 1])
		);
	}
	const out: Record<string, 1 | -1> = {};
	for (const [k, v] of Object.entries(sort ?? {})) {
		out[k] = v === "desc" ? -1 : 1;
	}
	return out;
}

type SchemaRefMap = Map<string, Map<string, string>>;

function buildSchemaRefMap(schema: Record<string, AnyZod>): SchemaRefMap {
	const result: SchemaRefMap = new Map();
	for (const [tableName, validator] of Object.entries(schema)) {
		const tableRefs = new Map<string, string>();
		const shape = getZodObjectShape(validator);
		for (const [field, fieldSchema] of Object.entries(shape)) {
			const ref = extractRefTableName(fieldSchema);
			if (ref) tableRefs.set(field, ref);
		}
		result.set(tableName, tableRefs);
	}
	return result;
}

function extractRefTableName(schema: AnyZod): string | null {
	if (!schema) return null;
	const def = schema?._def;
	const typeName: string | undefined = def?.typeName ?? def?.type;

	if (typeName === "ZodOptional" || typeName === "optional") {
		return extractRefTableName(
			def?.innerType ?? def?.schema ?? schema?._def?.innerType
		);
	}
	if (typeName === "ZodNullable" || typeName === "nullable") {
		return extractRefTableName(def?.innerType ?? def?.schema);
	}
	if (typeName === "ZodDefault" || typeName === "default") {
		return extractRefTableName(def?.innerType ?? def?.schema);
	}
	if (typeName === "ZodArray" || typeName === "array") {
		return extractRefTableName(def?.element ?? def?.innerType ?? def?.type);
	}
	if (typeName === "ZodString" || typeName === "string") {
		const description: string | undefined =
			schema?.description ?? def?.description;
		if (typeof description === "string" && description.startsWith("ref:")) {
			return description.slice("ref:".length);
		}
		return null;
	}

	return null;
}

function getZodObjectShape(schema: AnyZod): Record<string, AnyZod> {
	if (!schema || typeof schema !== "object") {
		throw new Error(`Schema table is not an object`);
	}

	const def = schema?._def;
	if (def?.typeName === "ZodObject" || def?.type === "object") {
		const shape = def.shape;
		if (typeof shape === "function") return shape();
		if (shape && typeof shape === "object") return shape;
	}

	if (typeof schema.shape === "function") return schema.shape();
	if (schema.shape && typeof schema.shape === "object") return schema.shape;

	throw new Error(`Table schema is not a Zod object`);
}

async function applyPopulate(params: {
	docs: Array<Record<string, unknown>>;
	currentTable: string;
	populateKeys: string[];
	selectedKeys: string[] | undefined;
	refs: SchemaRefMap;
	getCollection: (table: string) => Collection<Document>;
}) {
	const tableRefs = params.refs.get(params.currentTable);
	if (!tableRefs) return;

	for (const key of params.populateKeys) {
		if (params.selectedKeys && !params.selectedKeys.includes(key)) {
			// Field isn't in the projection, so nothing to populate.
			continue;
		}
		const targetTable = tableRefs.get(key);
		if (!targetTable) continue;

		const ids: string[] = [];
		for (const doc of params.docs) {
			const value = doc[key];
			if (typeof value === "string") {
				ids.push(value);
				continue;
			}
			if (Array.isArray(value)) {
				for (const v of value) {
					if (typeof v === "string") ids.push(v);
				}
			}
		}
		const uniqueIds = Array.from(new Set(ids));
		if (uniqueIds.length === 0) continue;

		const coll = params.getCollection(targetTable);
		const related = (await coll
			.find({ _id: { $in: uniqueIds } } as any)
			.toArray()) as Array<Record<string, unknown>>;
		const byId = new Map<string, Record<string, unknown>>();
		for (const r of related) {
			const id = r._id;
			if (typeof id === "string") byId.set(id, r);
		}

		for (const doc of params.docs) {
			const value = doc[key];
			if (typeof value === "string") {
				doc[key] = byId.get(value) ?? null;
				continue;
			}
			if (Array.isArray(value)) {
				doc[key] = value
					.map((v) => (typeof v === "string" ? (byId.get(v) ?? null) : null))
					.filter((v) => v !== null);
			}
		}
	}
}
