import type { Collection, Document } from "mongodb";
import { ObjectId } from "mongodb";
import { normalizeIdValue, stringifyIdField } from "../utils/id-utils";
import type { SchemaRefMap } from "../types/types";

export async function applyPopulate(params: {
	docs: Array<Record<string, unknown>>;
	currentTable: string;
	populateKeys: string[];
	selectedKeys: string[] | undefined;
	refs: SchemaRefMap;
	getCollection: (table: string) => Collection<Document>;
}) {
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

	const docIds = params.docs
		.map((doc) => {
			const id = ensureStringId(doc._id);
			return id ? normalizeIdValue(id) : null;
		})
		.filter((v): v is string | ObjectId => Boolean(v));

	if (docIds.length === 0) return;

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

	const buildLookupMap = (rows: Array<Record<string, unknown>>) => {
		const byId = new Map<string, Record<string, unknown>[]>();
		for (const row of rows) {
			const id = ensureStringId(row._id);
			if (!id) continue;
			const items = Array.isArray((row as any).__pop)
				? ((row as any).__pop as Array<Record<string, unknown>>)
				: [];
			items.forEach(stringifyIdField);
			byId.set(id, items);
		}
		return byId;
	};

	for (const key of params.populateKeys) {
		const forwardTarget = tableRefs.get(key);
		const backwardCandidates = reverseRefs.get(params.currentTable) ?? [];
		const backward = backwardCandidates.find((c) => c.table === key);

		// Prefer forward populate via $lookup when the table carries the ref.
		if (forwardTarget) {
			const hasForwardValues = params.docs.some((doc) => {
				const value = doc[key];
				return Array.isArray(value)
					? value.length > 0
					: value !== undefined && value !== null;
			});

			if (hasForwardValues) {
				const coll = params.getCollection(params.currentTable);
				const pipeline = [
					{ $match: { _id: { $in: docIds } } },
					{
						$lookup: {
							from: forwardTarget,
							localField: key,
							foreignField: "_id",
							as: "__pop",
						},
					},
					{ $project: { _id: 1, __pop: 1 } },
				];

				const populated = (await coll
					.aggregate(pipeline as any)
					.toArray()) as Array<Record<string, unknown>>;

				const byId = buildLookupMap(populated);

				for (const doc of params.docs) {
					const docId = ensureStringId(doc._id);
					if (!docId) continue;
					const populatedDocs = byId.get(docId) ?? [];
					const currentValue = doc[key];

					if (Array.isArray(currentValue)) {
						const byRelId = new Map<string, Record<string, unknown>>();
						for (const rel of populatedDocs) {
							const relId = ensureStringId(rel._id);
							if (relId) byRelId.set(relId, rel);
						}
						doc[key] = currentValue
							.map((v) => {
								const relId = ensureStringId(v);
								return relId ? (byRelId.get(relId) ?? null) : null;
							})
							.filter((v): v is Record<string, unknown> => Boolean(v));
						continue;
					}

					const relId = ensureStringId(currentValue);
					doc[key] = relId
						? (populatedDocs.find((v) => ensureStringId(v._id) === relId) ??
							currentValue)
						: (populatedDocs[0] ?? currentValue);
				}

				continue;
			}

			if (!backward) continue;
		}

		// Backward populate: find docs in another table that reference this table's _id.
		if (backward) {
			const coll = params.getCollection(params.currentTable);
			const pipeline = [
				{ $match: { _id: { $in: docIds } } },
				{
					$lookup: {
						from: backward.table,
						localField: "_id",
						foreignField: backward.field,
						as: "__pop",
					},
				},
				{ $project: { _id: 1, __pop: 1 } },
			];

			const populated = (await coll
				.aggregate(pipeline as any)
				.toArray()) as Array<Record<string, unknown>>;

			const grouped = buildLookupMap(populated);
			for (const doc of params.docs) {
				const id = ensureStringId(doc._id);
				if (!id) continue;
				doc[key] = grouped.get(id) ?? [];
			}
		}
	}
}
