import { z } from "zod";

export const v = {
	string: () => z.string(),
	number: () => z.number(),
	boolean: () => z.boolean(),
	date: () => z.date(),
	id: (table: string) =>
		z
			.string()
			.regex(/^[a-f\d]{24}$/i, "Invalid ObjectId")
			.describe(`ref:${table}`),
	array: (item: z.ZodTypeAny) => z.array(item),
	object: (shape: Record<string, z.ZodTypeAny>) => z.object(shape),
	optional: (schema: z.ZodTypeAny) => schema.optional(),
	nullable: (schema: z.ZodTypeAny) => schema.nullable(),
	union: (...schemas: z.ZodTypeAny[]) => z.union(schemas),
	literal: (value: any) => z.literal(value),
	buffer: () => z.string(), // or z.instanceof(Buffer) if using Buffer
	any: () => z.any(),
	unknown: () => z.unknown(),
	// Add more as needed
};
