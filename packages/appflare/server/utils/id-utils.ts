import type { Id, QueryWhere, SchemaRefMap } from "../types/types";

export function isIdValue(value: unknown): value is string {
	return typeof value === "string";
}

function ensureId(value: string): string {
	return value;
}

export function toDbFilter(where: Id<any> | QueryWhere<any>): any {
	return where;
}

export function stringifyIdField(doc: Record<string, unknown>) {}

export function normalizeIdFilter(filter: any | undefined): any | undefined {
	return filter;
}

export function normalizeIdValue(value: unknown): unknown {
	return value;
}

export function normalizeRefFields(
	table: string,
	value: Record<string, unknown>,
	refs: SchemaRefMap,
): Record<string, unknown> {
	return value;
}

export function stringifyRefFields(
	table: string,
	doc: Record<string, unknown>,
	refs: SchemaRefMap,
) {}
