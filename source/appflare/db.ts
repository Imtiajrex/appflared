import { z } from 'zod';

type LiteralValue = string | number | boolean;

type ValidatorMeta = {
	kind: 'string' | 'number' | 'boolean' | 'id' | 'object' | 'array' | 'record' | 'literal' | 'unknown';
	references?: string;
	literalValue?: LiteralValue;
	isOptional?: boolean;
	isNullable?: boolean;
	elementMeta?: ValidatorMeta;
};

export interface SchemaValidator<TValue> {
	schema: z.ZodType<TValue>;
	meta: ValidatorMeta;
	parse(value: unknown): TValue;
	optional(): SchemaValidator<TValue | undefined>;
	nullable(): SchemaValidator<TValue | null>;
}

const createValidator = <TValue>(schema: z.ZodType<TValue>, meta: ValidatorMeta): SchemaValidator<TValue> => ({
	schema,
	meta,
	parse: (value: unknown) => schema.parse(value),
	optional: () =>
		createValidator(schema.optional(), {
			...meta,
			isOptional: true,
		}),
	nullable: () =>
		createValidator(schema.nullable(), {
			...meta,
			isNullable: true,
		}),
});

export type AnyValidator = SchemaValidator<unknown>;
type FieldValidators = Record<string, AnyValidator>;
type TableDescription = ReturnType<TableDefinition<FieldValidators>['describe']>;

export interface IndexDefinition<TField extends string> {
	name: string;
	fields: TField[];
}

export interface TableDefinition<TFields extends FieldValidators = FieldValidators> {
	fields: TFields;
	indexes: IndexDefinition<keyof TFields & string>[];
	index(name: string, columns: (keyof TFields & string)[]): TableDefinition<TFields>;
	describe(): {
		fields: Array<{
			name: string;
			kind: ValidatorMeta['kind'];
			references?: string;
		}>;
		indexes: IndexDefinition<keyof TFields & string>[];
	};
}

const createTableDefinition = <TFields extends FieldValidators>(
	fields: TFields,
	indexes: IndexDefinition<keyof TFields & string>[] = [],
): TableDefinition<TFields> => ({
	fields,
	indexes,
	index: (name, columns) => {
		if (!name) {
			throw new Error('Index name must be provided');
		}
		columns.forEach((column) => {
			if (!(column in fields)) {
				throw new Error(`Field "${String(column)}" does not exist on table`);
			}
		});
		return createTableDefinition(fields, [...indexes, { name, fields: columns }]);
	},
	describe: () => ({
		fields: Object.entries(fields).map(([name, validator]) => ({
			name,
			kind: validator.meta.kind,
			references: validator.meta.references,
		})),
		indexes,
	}),
});

export const defineTable = <TFields extends FieldValidators>(fields: TFields): TableDefinition<TFields> => {
	if (!fields || Object.keys(fields).length === 0) {
		throw new Error('defineTable requires at least one field');
	}
	return createTableDefinition(fields);
};

export interface SchemaDefinition<TTables extends Record<string, TableDefinition<any>>> {
	tables: TTables;
	tableNames: Array<keyof TTables & string>;
	getTable<TName extends keyof TTables>(name: TName): TTables[TName];
	describe(): Record<keyof TTables & string, TableDescription>;
}

export const defineSchema = <TTables extends Record<string, TableDefinition<any>>>(tables: TTables): SchemaDefinition<TTables> => {
	if (!tables || typeof tables !== 'object') {
		throw new Error('defineSchema expects a record of tables');
	}
	const tableNames = Object.keys(tables) as Array<keyof TTables & string>;
	if (tableNames.length === 0) {
		throw new Error('defineSchema requires at least one table');
	}
	return {
		tables,
		tableNames,
		getTable: (name) => {
			const table = tables[name];
			if (!table) {
				throw new Error(`Table "${String(name)}" was not registered in this schema`);
			}
			return table;
		},
		describe: () => {
			return tableNames.reduce(
				(acc, tableName) => {
					acc[tableName] = tables[tableName].describe() as TableDescription;
					return acc;
				},
				{} as Record<keyof TTables & string, TableDescription>,
			);
		},
	};
};

export const v = {
	string: () => createValidator(z.string(), { kind: 'string' }),
	number: () => createValidator(z.number(), { kind: 'number' }),
	boolean: () => createValidator(z.boolean(), { kind: 'boolean' }),
	id: <TableName extends string>(tableName: TableName) => createValidator(z.string().min(1), { kind: 'id', references: tableName }),
	object: <TShape extends z.ZodRawShape>(shape: TShape) => createValidator(z.object(shape), { kind: 'object' }),
	array: <TValue>(validator: SchemaValidator<TValue>) =>
		createValidator(z.array(validator.schema), { kind: 'array', elementMeta: validator.meta }),
	record: <TValue>(validator: SchemaValidator<TValue>) =>
		createValidator(z.record(z.string(), validator.schema), { kind: 'record', elementMeta: validator.meta }),
	literal: <TValue extends LiteralValue>(value: TValue) => createValidator(z.literal(value), { kind: 'literal', literalValue: value }),
	any: () => createValidator(z.any(), { kind: 'unknown' }),
};

export type { SchemaValidator as Validator, ValidatorMeta };
