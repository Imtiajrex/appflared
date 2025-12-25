import type { AnyZod, SchemaRefMap } from "./types";

export function buildSchemaRefMap(
	schema: Record<string, AnyZod>
): SchemaRefMap {
	const result: SchemaRefMap = new Map();
	for (const [tableName, validator] of Object.entries(schema)) {
		const tableRefs = new Map<string, string>();
		const shape = getZodObjectShape(validator);
		for (const [field, fieldSchema] of Object.entries(shape)) {
			const ref = extractRefTableName(fieldSchema);
			if (ref) tableRefs.set(field, ref);
		}
		result.set(tableName, tableRefs);
	}
	return result;
}

function extractRefTableName(schema: AnyZod): string | null {
	if (!schema) return null;
	const def = schema?._def;
	const typeName: string | undefined = def?.typeName ?? def?.type;

	if (typeName === "ZodOptional" || typeName === "optional") {
		return extractRefTableName(
			def?.innerType ?? def?.schema ?? schema?._def?.innerType
		);
	}
	if (typeName === "ZodNullable" || typeName === "nullable") {
		return extractRefTableName(def?.innerType ?? def?.schema);
	}
	if (typeName === "ZodDefault" || typeName === "default") {
		return extractRefTableName(def?.innerType ?? def?.schema);
	}
	if (typeName === "ZodArray" || typeName === "array") {
		return extractRefTableName(def?.element ?? def?.innerType ?? def?.type);
	}
	if (typeName === "ZodString" || typeName === "string") {
		const description: string | undefined =
			schema?.description ?? def?.description;
		if (typeof description === "string" && description.startsWith("ref:")) {
			return description.slice("ref:".length);
		}
		return null;
	}

	return null;
}

function getZodObjectShape(schema: AnyZod): Record<string, AnyZod> {
	if (!schema || typeof schema !== "object") {
		throw new Error(`Schema table is not an object`);
	}

	const def = schema?._def;
	if (def?.typeName === "ZodObject" || def?.type === "object") {
		const shape = def.shape;
		if (typeof shape === "function") return shape();
		if (shape && typeof shape === "object") return shape;
	}

	if (typeof schema.shape === "function") return schema.shape();
	if (schema.shape && typeof schema.shape === "object") return schema.shape;

	throw new Error(`Table schema is not a Zod object`);
}
