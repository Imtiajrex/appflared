import type { Sort } from "mongodb";
import type { QuerySort } from "./types";

export function buildProjection(keys: string[]): Record<string, 0 | 1> {
	const projection: Record<string, 0 | 1> = {};
	for (const k of keys) projection[k] = 1;

	// Mongo includes _id by default; keep runtime aligned with schema-types `select()`.
	if (!keys.includes("_id")) projection._id = 0;
	if (!keys.includes("_creationTime")) projection._creationTime = 0;
	return projection;
}

export function normalizeSort(sort: QuerySort<string>): Sort {
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
