import type { Collection, Document } from "mongodb";
import { isIdValue, normalizeIdFilter, toMongoFilter } from "../utils/id-utils";
import type {
	MongoDbDeleteBuilder,
	MongoDbPatchBuilder,
	MongoDbUpdateBuilder,
} from "../types/types";

export function createDeleteBuilder(params: {
	table: string;
	getCollection: (table: string) => Collection<Document>;
}): MongoDbDeleteBuilder<any, any> {
	return {
		where(where) {
			const filter = normalizeIdFilter(toMongoFilter(where));
			return {
				exec: async () => {
					const coll = params.getCollection(params.table);
					if (isIdValue(where)) {
						await coll.deleteOne(filter as any);
					} else {
						await coll.deleteMany(filter as any);
					}
				},
			};
		},
	};
}

export function createUpdateBuilder(params: {
	table: string;
	getCollection: (table: string) => Collection<Document>;
	normalizePartial?: (
		partial: Record<string, unknown>
	) => Record<string, unknown>;
}): MongoDbUpdateBuilder<any, any> {
	return {
		where(where) {
			const filter = normalizeIdFilter(toMongoFilter(where));
			return {
				set(partial) {
					const normalized = params.normalizePartial
						? params.normalizePartial(partial as any)
						: partial;
					return {
						exec: async () => {
							const coll = params.getCollection(params.table);
							const update = { $set: normalized as any };
							if (isIdValue(where)) {
								await coll.updateOne(filter as any, update);
							} else {
								await coll.updateMany(filter as any, update);
							}
						},
					};
				},
				exec: async (partial) => {
					if (!partial) throw new Error("update requires a partial to set");
					const normalized = params.normalizePartial
						? params.normalizePartial(partial as any)
						: partial;
					const coll = params.getCollection(params.table);
					const update = { $set: normalized as any };
					if (isIdValue(where)) {
						await coll.updateOne(filter as any, update);
					} else {
						await coll.updateMany(filter as any, update);
					}
				},
			};
		},
	};
}

export function createPatchBuilder(params: {
	table: string;
	getCollection: (table: string) => Collection<Document>;
	normalizePartial?: (
		partial: Record<string, unknown>
	) => Record<string, unknown>;
}): MongoDbPatchBuilder<any, any> {
	return createUpdateBuilder(params) as MongoDbPatchBuilder<any, any>;
}
