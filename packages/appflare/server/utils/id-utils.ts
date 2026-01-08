import type { Document, Filter } from "mongodb";
import { ObjectId } from "mongodb";
import type { Id, QueryWhere, SchemaRefMap } from "../types/types";

export function isIdValue(value: unknown): value is string | ObjectId {
	return typeof value === "string" || value instanceof ObjectId;
}

function ensureObjectId(value: string | ObjectId): ObjectId {
	if (value instanceof ObjectId) return value;
	if (!ObjectId.isValid(value)) {
		throw new Error("Invalid id format; expected a 24-char hex ObjectId");
	}
	return new ObjectId(value);
}

const OPERATOR_ALIAS_MAP: Record<string, string> = {
	eq: "$eq",
	ne: "$ne",
	gt: "$gt",
	gte: "$gte",
	lt: "$lt",
	lte: "$lte",
	in: "$in",
	nin: "$nin",
	regex: "$regex",
	exists: "$exists",
};

const LOGICAL_ALIAS_MAP: Record<string, string> = {
	and: "$and",
	or: "$or",
	nor: "$nor",
	not: "$not",
};

type NormalizedRegex =
	| { $regex: string | RegExp; $options?: string }
	| RegExp
	| string;

function normalizeRegexOperand(value: unknown): NormalizedRegex | undefined {
	if (value instanceof RegExp) return value;
	if (typeof value === "string") return value;
	if (value && typeof value === "object") {
		const obj = value as Record<string, unknown>;
		const pattern = obj.pattern ?? obj.regex ?? obj.$regex;
		const options = obj.options ?? obj.$options;
		if (pattern instanceof RegExp) return pattern;
		if (typeof pattern === "string") {
			const normalized: { $regex: string; $options?: string } = {
				$regex: pattern,
			};
			if (typeof options === "string" && options.length > 0) {
				normalized.$options = options;
			}
			return normalized;
		}
	}
	return undefined;
}

function normalizeWhereOperators(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(normalizeWhereOperators);
	if (value instanceof RegExp || value instanceof Date) return value;
	if (value && typeof value === "object") {
		const obj = value as Record<string, unknown>;
		const out: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(obj)) {
			const logicalKey = LOGICAL_ALIAS_MAP[key];
			if (logicalKey) {
				const normalizedLogical = Array.isArray(val)
					? (val as unknown[]).map(normalizeWhereOperators)
					: normalizeWhereOperators(val);
				out[logicalKey] = normalizedLogical;
				continue;
			}

			if (key.startsWith("$")) {
				out[key] = normalizeWhereOperators(val);
				continue;
			}

			const opKey = OPERATOR_ALIAS_MAP[key];
			if (opKey) {
				if (opKey === "$regex") {
					const normalizedRegex = normalizeRegexOperand(val);
					if (normalizedRegex === undefined) continue;
					if (
						normalizedRegex &&
						typeof normalizedRegex === "object" &&
						!Array.isArray(normalizedRegex) &&
						!(normalizedRegex instanceof RegExp)
					) {
						out.$regex = normalizedRegex.$regex;
						if (normalizedRegex.$options) {
							out.$options = normalizedRegex.$options;
						}
					} else {
						out[opKey] = normalizeWhereOperators(normalizedRegex);
					}
					continue;
				}
				out[opKey] = normalizeWhereOperators(val);
				continue;
			}

			out[key] = normalizeWhereOperators(val);
		}
		return out;
	}
	return value;
}

export function toMongoFilter(
	where: Id<any> | QueryWhere<any>
): Filter<Document> {
	if (isIdValue(where)) {
		return { _id: ensureObjectId(where) } satisfies Filter<Document> as any;
	}
	if (where && typeof where === "object") {
		const normalized = normalizeWhereOperators(where);
		return normalized as Filter<Document>;
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
