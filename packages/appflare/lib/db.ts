import { z } from "zod";

/**
 * Define a table schema by wrapping fields in z.object.
 * Automatically adds _id and _creationTime fields.
 *
 * @example
 * ```ts
 * const users = defineTable({
 *   name: v.string(),
 *   email: v.string(),
 * });
 * ```
 */
export function defineTable<T extends z.ZodRawShape>(shape: T) {
	return z.object({
		_id: z.string(),
		_creationTime: z.number(),
		...shape,
	});
}

/**
 * Define a schema from a map of table names to table definitions.
 *
 * @example
 * ```ts
 * export default defineSchema({
 *   users: defineTable({ name: v.string() }),
 *   posts: defineTable({ title: v.string() }),
 * });
 * ```
 */
export function defineSchema<
	T extends Record<string, ReturnType<typeof defineTable>>,
>(tables: T): T {
	return tables;
}
