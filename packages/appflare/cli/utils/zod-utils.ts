import { isValidIdentifier } from "./utils";

function getZodObjectShape(schema: any): Record<string, any> {
	if (!schema || typeof schema !== "object") {
		throw new Error(`Schema table is not an object`);
	}

	const def = (schema as any)._def;
	if (def?.typeName === "ZodObject" || def?.type === "object") {
		const shape = def.shape;
		if (typeof shape === "function") {
			return shape();
		}
		if (shape && typeof shape === "object") {
			return shape;
		}
	}

	if (typeof (schema as any).shape === "function") {
		return (schema as any).shape;
	}
	if ((schema as any).shape && typeof (schema as any).shape === "object") {
		return (schema as any).shape;
	}

	throw new Error(`Table schema is not a Zod object`);
}

function renderField(fieldName: string, schema: any): string {
	const { tsType, optional } = renderType(schema);
	const safeKey = isValidIdentifier(fieldName)
		? fieldName
		: JSON.stringify(fieldName);
	return `${safeKey}${optional ? "?" : ""}: ${tsType};`;
}

function renderType(schema: any): { tsType: string; optional: boolean } {
	const def = schema?._def;
	const typeName: string | undefined = def?.typeName ?? def?.type;

	if (typeName === "ZodOptional" || typeName === "optional") {
		const inner = def?.innerType ?? def?.schema ?? schema?._def?.innerType;
		const rendered = renderType(inner);
		return { tsType: rendered.tsType, optional: true };
	}
	if (typeName === "ZodNullable" || typeName === "nullable") {
		const inner = def?.innerType ?? def?.schema;
		const rendered = renderType(inner);
		return { tsType: `${rendered.tsType} | null`, optional: false };
	}
	if (typeName === "ZodDefault" || typeName === "default") {
		const inner = def?.innerType ?? def?.schema;
		return renderType(inner);
	}

	if (typeName === "ZodString" || typeName === "string") {
		const description: string | undefined =
			schema?.description ?? def?.description;
		if (typeof description === "string" && description.startsWith("ref:")) {
			const table = description.slice("ref:".length);
			return { tsType: `Id<${JSON.stringify(table)}>`, optional: false };
		}
		return { tsType: "string", optional: false };
	}
	if (typeName === "ZodNumber" || typeName === "number") {
		return { tsType: "number", optional: false };
	}
	if (typeName === "ZodBoolean" || typeName === "boolean") {
		return { tsType: "boolean", optional: false };
	}
	if (typeName === "ZodDate" || typeName === "date") {
		return { tsType: "Date", optional: false };
	}
	if (typeName === "ZodArray" || typeName === "array") {
		const inner = def?.element ?? def?.innerType ?? def?.type;
		const rendered = renderType(inner);
		return { tsType: `Array<${rendered.tsType}>`, optional: false };
	}
	if (typeName === "ZodObject" || typeName === "object") {
		const shape = getZodObjectShape(schema);
		const entries = Object.entries(shape);
		if (entries.length === 0) {
			return { tsType: "Record<string, unknown>", optional: false };
		}
		const props = entries
			.map(([key, value]) => {
				const { tsType, optional } = renderType(value);
				const safeKey = isValidIdentifier(key) ? key : JSON.stringify(key);
				return `\t${safeKey}${optional ? "?" : ""}: ${tsType};`;
			})
			.join("\n");
		return { tsType: `{\n${props}\n}`, optional: false };
	}
	if (typeName === "ZodUnion" || typeName === "union") {
		const options: any[] = def?.options ?? def?.optionsMap ?? [];
		const parts = Array.isArray(options)
			? options.map((o) => renderType(o).tsType)
			: ["unknown"];
		return { tsType: parts.join(" | ") || "unknown", optional: false };
	}
	if (typeName === "ZodLiteral" || typeName === "literal") {
		const value = def?.value;
		return { tsType: JSON.stringify(value), optional: false };
	}
	if (typeName === "ZodAny" || typeName === "any") {
		return { tsType: "any", optional: false };
	}
	if (typeName === "ZodUnknown" || typeName === "unknown") {
		return { tsType: "unknown", optional: false };
	}

	return { tsType: "unknown", optional: false };
}

export { getZodObjectShape, renderField, renderType };
