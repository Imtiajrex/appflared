import type { Collection, Document } from "mongodb";
import { normalizeIdValue, stringifyIdField } from "./id-utils";
import type { SchemaRefMap } from "./types";

export async function applyPopulate(params: {
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
			.find({ _id: { $in: uniqueIds.map(normalizeIdValue) } } as any)
			.toArray()) as Array<Record<string, unknown>>;
		related.forEach(stringifyIdField);
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
