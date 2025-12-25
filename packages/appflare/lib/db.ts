import { z } from "zod";

export function defineTable(shape: Record<string, z.ZodTypeAny>) {
	return z.object(shape);
}

export function defineSchema(tables: Record<string, z.ZodTypeAny>) {
	return tables;
}
