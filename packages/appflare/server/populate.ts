import type { Collection, Document } from "mongodb";
import { ObjectId } from "mongodb";
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
	console.log("[populate] start", {
		table: params.currentTable,
		populateKeys: params.populateKeys,
		docCount: params.docs.length,
		selectedKeys: params.selectedKeys,
	});
	const tableRefs = params.refs.get(params.currentTable) ?? new Map();

	const ensureStringId = (val: unknown): string | null => {
		if (!val) return null;
		if (typeof val === "string") return val;
		if (val instanceof ObjectId) return val.toHexString();
		if (typeof val === "object" && "_id" in (val as any)) {
			const maybeId = (val as any)._id;
			if (typeof maybeId === "string") return maybeId;
			if (maybeId instanceof ObjectId) return maybeId.toHexString();
		}
		return null;
	};

	const pushId = (val: unknown, ids: string[]) => {
		if (!val) return;
		if (typeof val === "string") {
			ids.push(val);
			return;
		}
		if (val instanceof ObjectId) {
			ids.push(val.toHexString());
			return;
		}
		if (typeof val === "object" && "_id" in (val as any)) {
			const maybeId = (val as any)._id;
			if (typeof maybeId === "string") ids.push(maybeId);
			if (maybeId instanceof ObjectId) ids.push(maybeId.toHexString());
		}
	};

	// Build reverse ref lookup so populate can work even when the current table
	// doesn't store the forward reference (e.g., populate tickets on users by
	// matching tickets.user -> users._id).
	const reverseRefs = new Map<string, { table: string; field: string }[]>();
	for (const [table, refs] of params.refs.entries()) {
		for (const [field, refTable] of refs.entries()) {
			const list = reverseRefs.get(refTable) ?? [];
			list.push({ table, field });
			reverseRefs.set(refTable, list);
		}
	}

	for (const key of params.populateKeys) {
		const forwardTarget = tableRefs.get(key);
		const backwardCandidates = reverseRefs.get(params.currentTable) ?? [];
		const backward = backwardCandidates.find((c) => c.table === key);

		console.log("[populate] key", {
			key,
			strategy: forwardTarget ? "forward" : backward ? "backward" : "skip",
			forwardTarget,
			backward,
		});

		// Decide strategy: forward (from field values) or backward (lookup by current _id).
		if (forwardTarget) {
			const ids: string[] = [];
			for (const doc of params.docs) {
				const value = doc[key];
				if (Array.isArray(value)) {
					for (const v of value) pushId(v, ids);
					continue;
				}
				pushId(value, ids);
			}
			const uniqueIds = Array.from(new Set(ids));
			if (uniqueIds.length === 0) {
				console.log(
					"[populate] forward ids empty, attempting backward if available",
					{ key }
				);
				if (!backward) continue;
			} else {
				console.log("[populate] forward ids", {
					key,
					count: uniqueIds.length,
					ids: uniqueIds,
				});

				const coll = params.getCollection(forwardTarget);
				const related = (await coll
					.find({ _id: { $in: uniqueIds.map(normalizeIdValue) } } as any)
					.toArray()) as Array<Record<string, unknown>>;
				related.forEach(stringifyIdField);
				const byId = new Map<string, Record<string, unknown>>();
				for (const r of related) {
					const id = ensureStringId(r._id);
					if (id) byId.set(id, r);
				}
				console.log("[populate] forward fetched", {
					key,
					count: related.length,
				});

				for (const doc of params.docs) {
					const value = doc[key];
					if (Array.isArray(value)) {
						doc[key] = value
							.map((v) => {
								const id = ensureStringId(v);
								return id ? (byId.get(id) ?? null) : null;
							})
							.filter((v): v is Record<string, unknown> => Boolean(v));
						continue;
					}
					const id = ensureStringId(value);
					if (!id) continue;
					doc[key] = byId.get(id) ?? value;
				}
				continue;
			}
		}

		// Backward populate: find docs in another table that reference this table's _id.
		if (backward) {
			const parentIds = params.docs
				.map((d) => ensureStringId(d._id))
				.filter((v): v is string => Boolean(v));
			if (parentIds.length === 0) continue;
			console.log("[populate] backward parents", {
				key,
				count: parentIds.length,
				parentIds,
			});

			const coll = params.getCollection(backward.table);
			const related = (await coll
				.find({
					[backward.field]: { $in: parentIds.map(normalizeIdValue) },
				} as any)
				.toArray()) as Array<Record<string, unknown>>;
			related.forEach(stringifyIdField);
			console.log("[populate] backward fetched", {
				key,
				count: related.length,
				table: backward.table,
			});

			const grouped = new Map<string, Record<string, unknown>[]>();
			for (const r of related) {
				const fk = ensureStringId((r as any)[backward.field]);
				if (!fk) continue;
				const list = grouped.get(fk) ?? [];
				list.push(r);
				grouped.set(fk, list);
			}
			console.log("[populate] backward grouped", { key, groups: grouped.size });

			for (const doc of params.docs) {
				const id = ensureStringId(doc._id);
				if (!id) continue;
				doc[key] = grouped.get(id) ?? [];
			}
		}
	}
	console.log("[populate] done", {
		table: params.currentTable,
		keys: params.populateKeys,
	});
}
