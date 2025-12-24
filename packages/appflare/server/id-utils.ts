import type { Document, Filter } from "mongodb";
import { ObjectId } from "mongodb";
import type { Id, QueryWhere, SchemaRefMap } from "./types";

export function isIdValue(value: unknown): value is string {
	return typeof value === "string";
}

export function toMongoFilter(
	where: Id<any> | QueryWhere<any>
): Filter<Document> {
	if (isIdValue(where)) {
		return { _id: where as any } satisfies Filter<Document> as any;
	}
	if (where && typeof where === "object") {
		return where as Filter<Document>;
	}
	throw new Error("update/delete requires an id or where filter object");
}

export function stringifyIdField(doc: Record<string, unknown>) {
	const id = doc._id;
	if (id instanceof ObjectId) {
		doc._id = id.toHexString();
	}
}

export function normalizeIdFilter(
	filter: Filter<Document> | undefined
): Filter<Document> | undefined {
	if (!filter) return filter;
	return normalizeIdFilterValue(filter) as Filter<Document>;
}

function normalizeIdFilterValue(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(normalizeIdFilterValue);
	if (value && typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(value)) {
			if (key === "_id") {
				out[key] = normalizeIdValueForFilter(val);
				continue;
			}
			if (key === "$and" || key === "$or" || key === "$nor") {
				out[key] = Array.isArray(val)
					? val.map(normalizeIdFilterValue)
					: normalizeIdFilterValue(val);
				continue;
			}
			out[key] = normalizeIdFilterValue(val);
		}
		return out;
	}
	return value;
}

function normalizeIdValueForFilter(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(normalizeIdValueForFilter);
	if (value && typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(value)) {
			if (key === "$in" || key === "$nin" || key === "$all") {
				out[key] = Array.isArray(val)
					? val.map(normalizeIdValue)
					: normalizeIdValue(val);
				continue;
			}
			out[key] = normalizeIdValueForFilter(val);
		}
		return out;
	}
	return normalizeIdValue(value);
}

export function normalizeIdValue(value: unknown): unknown {
	if (value instanceof ObjectId) return value;
	if (typeof value === "string" && ObjectId.isValid(value)) {
		return new ObjectId(value);
	}
	return value;
}

export function normalizeRefFields(
	table: string,
	value: Record<string, unknown>,
	refs: SchemaRefMap
): Record<string, unknown> {
	const tableRefs = refs.get(table);
	if (!tableRefs) return value;

	const out: Record<string, unknown> = { ...value };
	for (const key of tableRefs.keys()) {
		if (!(key in out)) continue;
		out[key] = normalizeRefFieldValue(out[key]);
	}
	return out;
}

function normalizeRefFieldValue(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(normalizeRefFieldValue);
	return normalizeIdValue(value);
}

export function stringifyRefFields(
	table: string,
	doc: Record<string, unknown>,
	refs: SchemaRefMap
) {
	const tableRefs = refs.get(table);
	if (!tableRefs) return;

	for (const key of tableRefs.keys()) {
		const value = doc[key];
		if (value === undefined) continue;
		doc[key] = stringifyRefFieldValue(value);
	}
}

function stringifyRefFieldValue(value: unknown): unknown {
	if (value instanceof ObjectId) return value.toHexString();
	if (Array.isArray(value)) return value.map(stringifyRefFieldValue);
	return value;
}
