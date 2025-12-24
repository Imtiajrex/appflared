import type { Collection, Document } from "mongodb";
import { ObjectId } from "mongodb";
import {
	createDeleteBuilder,
	createPatchBuilder,
	createUpdateBuilder,
} from "./builders";
import { createQueryBuilder } from "./query-builder";
import {
	isIdValue,
	normalizeIdFilter,
	normalizeRefFields,
	toMongoFilter,
} from "./id-utils";
import { buildSchemaRefMap } from "./schema-refs";
import type {
	CreateMongoDbContextOptions,
	MongoDbContext,
	TableDocBase,
} from "./types";

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
			if (arguments.length === 1) {
				return createUpdateBuilder({
					table,
					getCollection,
					normalizePartial: (p) =>
						normalizeRefFields(table as string, p as any, refs),
				});
			}
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
			if (arguments.length === 1) {
				return createPatchBuilder({
					table,
					getCollection,
					normalizePartial: (p) =>
						normalizeRefFields(table as string, p as any, refs),
				});
			}
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
			if (arguments.length === 1) {
				return createDeleteBuilder({
					table,
					getCollection,
				});
			}
			const coll = getCollection(table as string);
			const filter = normalizeIdFilter(toMongoFilter(where));
			if (isIdValue(where)) {
				return coll.deleteOne(filter).then(() => {});
			}
			return coll.deleteMany(filter).then(() => {});
		}) as any,
	};

	return ctx;
}
