import { z } from "zod";
import { geoPointSchema } from "./location";

export const v = {
	string: () => z.string(),
	number: () => z.number(),
	boolean: () => z.boolean(),
	date: () => z.date(),
	point: () => geoPointSchema,
	location: () => geoPointSchema,
	id: (table: string) =>
		z
			.string()
			.regex(/^[a-f\d]{24}$/i, "Invalid ObjectId")
			.describe(`ref:${table}`) as z.ZodString,
	array: <T extends z.ZodTypeAny>(item: T) => z.array(item),
	object: (shape: Record<string, z.ZodTypeAny>) => z.object(shape),
	optional: <T extends z.ZodTypeAny>(schema: T) => schema.optional(),
	nullable: <T extends z.ZodTypeAny>(schema: T) => schema.nullable(),
	union: <T extends [z.ZodTypeAny, ...z.ZodTypeAny[]]>(...schemas: T) =>
		z.union(schemas),
	literal: (value: any) => z.literal(value),
	buffer: () => z.string(), // or z.instanceof(Buffer) if using Buffer
	any: () => z.any(),
	unknown: () => z.unknown(),
	// Add more as needed
};
