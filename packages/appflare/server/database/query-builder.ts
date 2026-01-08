import type { Collection, Document, Filter, FindOptions, Sort } from "mongodb";
import { applyPopulate } from "./populate";
import {
	normalizeIdFilter,
	stringifyIdField,
	toMongoFilter,
} from "../utils/id-utils";
import type { MongoDbQuery, SchemaRefMap } from "../types/types";
import { buildProjection, normalizeSort } from "./query-utils";

export function createQueryBuilder<
	TTableNames extends string,
	TTableDocMap extends Record<TTableNames, any>,
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
	let populateAggregates: Record<
		string,
		{
			count?: boolean;
			sum?: string[];
			avg?: string[];
		}
	> = {};
	let populateIncludeDocs: Record<string, boolean> = {};

	const normalizeAggregate = (
		value: unknown
	): { count?: boolean; sum?: string[]; avg?: string[] } | undefined => {
		if (!value || typeof value !== "object") return undefined;
		const spec = value as Record<string, unknown>;
		const out: { count?: boolean; sum?: string[]; avg?: string[] } = {};
		if (spec.count) out.count = true;
		if (Array.isArray(spec.sum)) out.sum = spec.sum.map((k) => String(k));
		if (Array.isArray(spec.avg)) out.avg = spec.avg.map((k) => String(k));
		return Object.keys(out).length ? out : undefined;
	};

	const addPopulateKey = (
		key: string,
		opts?: {
			aggregate?: { count?: boolean; sum?: string[]; avg?: string[] };
			includeDocs?: boolean;
		}
	) => {
		const ks = String(key);
		if (!populateKeys.includes(ks)) populateKeys.push(ks);
		if (opts?.aggregate) populateAggregates[ks] = opts.aggregate;
		if (opts?.includeDocs !== undefined)
			populateIncludeDocs[ks] = opts.includeDocs;
	};

	const api: MongoDbQuery<any, any, any> = {
		where(next) {
			const nextFilter = normalizeIdFilter(
				toMongoFilter(next as unknown as Filter<Document>)
			);
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
			if (Array.isArray(arg)) {
				for (const k of arg) addPopulateKey(k as any);
				return api;
			}

			if (arg && typeof arg === "object") {
				for (const [key, value] of Object.entries(
					arg as Record<string, unknown>
				)) {
					if (!value) continue;
					const includeObj =
						typeof value === "object" && !Array.isArray(value)
							? (value as Record<string, unknown>)
							: undefined;
					const aggregate = normalizeAggregate(includeObj?.aggregate);
					const includeDocs = includeObj?.includeDocs;
					addPopulateKey(key, { aggregate, includeDocs });
				}
				return api;
			}

			if (arg !== undefined) addPopulateKey(arg as any);
			return api;
		},
		async find() {
			const coll = params.getCollection(params.table as string);
			const options: FindOptions = {};
			if (selectedKeys) {
				// Ensure referenced ids are available for populate even when the caller selected a subset.
				const projectionKeys = Array.from(
					new Set([...selectedKeys, ...populateKeys])
				);
				options.projection = buildProjection(projectionKeys);
			}
			const normalizedFilter = normalizeIdFilter(filter);
			let cursor = coll.find(normalizedFilter ?? ({} as any), options);
			if (sort) cursor = cursor.sort(sort);
			if (offset !== undefined) cursor = cursor.skip(offset);
			if (limit !== undefined) cursor = cursor.limit(limit);
			const docs = (await cursor.toArray()) as Array<Record<string, unknown>>;
			docs.forEach(stringifyIdField);

			if (populateKeys.length > 0) {
				await applyPopulate({
					docs,
					currentTable: params.table as string,
					populateKeys,
					aggregate: populateAggregates,
					includeDocs: populateIncludeDocs,
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
