import type { Collection, Document } from "mongodb";
import { ObjectId } from "mongodb";
import { createPatchBuilder, createUpdateBuilder } from "./builders";
import { createQueryBuilder } from "./query-builder";
import {
	isIdValue,
	normalizeIdFilter,
	normalizeRefFields,
	toMongoFilter,
} from "../utils/id-utils";
import { buildSchemaRefMap } from "../types/schema-refs";
import type {
	CreateMongoDbContextOptions,
	MongoDbCoreContext,
	MongoDbContext,
	MongoDbQuery,
	AppflareTableClient,
	TableDocBase,
} from "../types/types";

export function createMongoDbContext<
	TTableNames extends string,
	TTableDocMap extends Record<TTableNames, TableDocBase>,
>(
	options: CreateMongoDbContextOptions<TTableNames>
): MongoDbContext<TTableNames, TTableDocMap> {
	const collectionName = options.collectionName ?? ((t) => t);
	const collections = new Map<string, Collection<Document>>();
	const refs = buildSchemaRefMap(options.schema);
	const tableNames = Object.keys(options.schema) as TTableNames[];

	const getCollection = (table: string): Collection<Document> => {
		const key = collectionName(table as any);
		const existing = collections.get(key);
		if (existing) return existing;
		const created = options.db.collection(key);
		collections.set(key, created);
		return created;
	};

	const core: MongoDbCoreContext<TTableNames, TTableDocMap> = {
		query: (table) =>
			createQueryBuilder<TTableNames, TTableDocMap, any>({
				table: table as any,
				getCollection,
				refs,
			}),
		insert: async (table, value) => {
			const coll = getCollection(table as string);
			const objectId = new ObjectId();
			const normalized = normalizeRefFields(
				table as string,
				value as Record<string, unknown>,
				refs
			);
			const doc = {
				...normalized,
				_id: objectId,
				_creationTime: Date.now(),
			} as unknown as Document;

			await coll.insertOne(doc);
			return objectId.toHexString() as any;
		},
		update: ((table: any, where?: any, partial?: any) => {
			const coll = getCollection(table as string);
			const filter = normalizeIdFilter(toMongoFilter(where));
			const update = {
				$set: normalizeRefFields(table as string, partial as any, refs) as any,
			};
			if (isIdValue(where)) {
				return coll.updateOne(filter, update).then(() => {});
			}
			return coll.updateMany(filter, update).then(() => {});
		}) as any,
		patch: ((table: any, where?: any, partial?: any) => {
			const coll = getCollection(table as string);
			const filter = normalizeIdFilter(toMongoFilter(where));
			const update = {
				$set: normalizeRefFields(table as string, partial as any, refs) as any,
			};
			if (isIdValue(where)) {
				return coll.updateOne(filter, update).then(() => {});
			}
			return coll.updateMany(filter, update).then(() => {});
		}) as any,
		delete: ((table: any, where?: any) => {
			const coll = getCollection(table as string);
			const filter = normalizeIdFilter(toMongoFilter(where));
			if (isIdValue(where)) {
				return coll.deleteOne(filter).then(() => {});
			}
			return coll.deleteMany(filter).then(() => {});
		}) as any,
	};

	const ctx = {} as MongoDbContext<TTableNames, TTableDocMap>;

	for (const table of tableNames) {
		(ctx as any)[table] = createAppflareTableClient({
			table: table as TTableNames,
			core,
			refs,
			getCollection,
		});
	}

	return ctx;
}

function toKeyList(arg: unknown): string[] | undefined {
	if (!arg) return undefined;
	if (Array.isArray(arg)) return arg.map((k) => String(k));
	if (typeof arg === "object") {
		return Object.entries(arg as Record<string, unknown>)
			.filter(([, v]) => Boolean(v))
			.map(([k]) => k);
	}
	return undefined;
}

function createAppflareTableClient<
	TTableNames extends string,
	TTableDocMap extends Record<TTableNames, TableDocBase>,
	TableName extends TTableNames,
>(params: {
	table: TableName;
	core: MongoDbCoreContext<TTableNames, TTableDocMap>;
	refs: ReturnType<typeof buildSchemaRefMap>;
	getCollection: (table: string) => Collection<Document>;
}): AppflareTableClient<TableName, TTableDocMap> {
	const selectKeys = (select: unknown) => toKeyList(select);
	const includeKeys = (include: unknown) => toKeyList(include);

	const toArray = <T>(value: T | T[] | undefined): T[] => {
		if (value === undefined) return [];
		return Array.isArray(value) ? value : [value];
	};

	const stringifyAggregateValue = (value: unknown): unknown => {
		if (value instanceof ObjectId) return value.toHexString();
		if (Array.isArray(value)) return value.map(stringifyAggregateValue);
		if (value && typeof value === "object") {
			const out: Record<string, unknown> = {};
			for (const [key, val] of Object.entries(
				value as Record<string, unknown>
			)) {
				out[key] = stringifyAggregateValue(val);
			}
			return out;
		}
		return value;
	};

	const buildQuery = (args?: {
		where?: any;
		orderBy?: any;
		skip?: number;
		take?: number;
		select?: unknown;
		include?: unknown;
	}) => {
		let q: MongoDbQuery<TableName, TTableDocMap, any> = params.core.query(
			params.table as any
		) as any;
		if (args?.where) q = q.where(args.where as any);
		if (args?.orderBy) q = q.sort(args.orderBy as any);
		if (args?.skip !== undefined) q = q.offset(args.skip);
		if (args?.take !== undefined) q = q.limit(args.take);
		const s = selectKeys(args?.select);
		if (s?.length) q = q.select(s as any);
		const i = includeKeys(args?.include);
		if (i?.length) q = q.populate(i as any);
		return q;
	};

	const fetchOne = async (args: {
		where: any;
		select?: unknown;
		include?: unknown;
	}) => {
		const q = buildQuery({ ...args, take: 1 });
		return q.findOne();
	};

	return {
		findMany: async (args) => buildQuery(args as any).find() as any,
		findFirst: async (args) =>
			buildQuery({
				...(args as any),
				take: (args as any)?.take ?? 1,
			}).findOne() as any,
		findUnique: async (args) => {
			if (!args?.where) throw new Error("findUnique requires a where clause");
			return fetchOne(args as any) as any;
		},
		create: async (args) => {
			const id = await params.core.insert(
				params.table as any,
				args.data as any
			);
			const created = await fetchOne({
				where: { _id: id } as any,
				select: (args as any)?.select,
				include: (args as any)?.include,
			});
			return (created ?? {
				_id: id,
				_creationTime: Date.now(),
				...args.data,
			}) as any;
		},
		update: async (args) => {
			await params.core.update(
				params.table as any,
				args.where as any,
				args.data as any
			);
			return fetchOne({
				where: args.where as any,
				select: (args as any)?.select,
				include: (args as any)?.include,
			}) as any;
		},
		updateMany: async (args) => {
			const coll = params.getCollection(params.table as string);
			const filter = normalizeIdFilter(toMongoFilter(args.where ?? {}));
			const normalized = normalizeRefFields(
				params.table as string,
				args.data as any,
				params.refs
			);
			const result = await coll.updateMany(filter as any, {
				$set: normalized as any,
			});
			return { count: result.modifiedCount ?? 0 };
		},
		delete: async (args) => {
			const existing = await fetchOne({
				where: args.where as any,
				select: (args as any)?.select,
				include: (args as any)?.include,
			});
			await params.core.delete(params.table as any, args.where as any);
			return existing as any;
		},
		deleteMany: async (args) => {
			const coll = params.getCollection(params.table as string);
			const filter = normalizeIdFilter(toMongoFilter(args?.where ?? {}));
			const result = await coll.deleteMany(filter as any);
			return { count: result.deletedCount ?? 0 };
		},
		count: async (args) => {
			const coll = params.getCollection(params.table as string);
			const filter = normalizeIdFilter(toMongoFilter(args?.where ?? {}));
			return coll.countDocuments(filter ?? {});
		},
		aggregate: async (args) => {
			const coll = params.getCollection(params.table as string);
			const pipeline: Document[] = [];

			const normalizedWhere = args.where
				? normalizeIdFilter(
						normalizeRefFields(
							params.table as string,
							args.where as Record<string, unknown>,
							params.refs
						) as any
					)
				: undefined;
			if (normalizedWhere && Object.keys(normalizedWhere).length > 0) {
				pipeline.push({ $match: normalizedWhere });
			}

			const sumFields = toArray(args.sum).filter(Boolean) as string[];
			const avgFields = toArray(args.avg).filter(Boolean) as string[];
			if (sumFields.length === 0 && avgFields.length === 0) {
				throw new Error("aggregate requires at least one sum or avg field");
			}

			const groupKeys = toArray(args.groupBy).filter(Boolean) as string[];
			const groupId =
				groupKeys.length === 0
					? null
					: groupKeys.length === 1
						? `$${groupKeys[0]}`
						: Object.fromEntries(groupKeys.map((k) => [k, `$${k}`]));

			const groupStage: Record<string, unknown> = { _id: groupId };
			for (const field of sumFields) {
				groupStage[`sum_${field}`] = { $sum: `$${field}` };
			}
			for (const field of avgFields) {
				groupStage[`avg_${field}`] = { $avg: `$${field}` };
			}
			pipeline.push({ $group: groupStage });

			const tableRefs = params.refs.get(params.table as string) ?? new Map();
			const populateKeys = toArray(args.populate).filter(Boolean) as string[];
			for (const key of populateKeys) {
				if (!groupKeys.includes(key)) continue;
				const target = tableRefs.get(key);
				if (!target) continue;
				const useRootId = groupKeys.length === 1 && groupKeys[0] === key;
				const localField = useRootId ? "_id" : `_id.${key}`;
				pipeline.push({
					$lookup: {
						from: target,
						localField,
						foreignField: "_id",
						as: key,
					},
				});
				pipeline.push({
					$unwind: {
						path: `$${key}`,
						preserveNullAndEmptyArrays: true,
					},
				});
			}

			const results = await coll.aggregate(pipeline as any).toArray();
			return results.map((doc) => stringifyAggregateValue(doc)) as any;
		},
	};
}
