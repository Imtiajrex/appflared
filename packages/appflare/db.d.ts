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
export type AnyValidator = SchemaValidator<unknown>;
type FieldValidators = Record<string, AnyValidator>;
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
export declare const defineTable: <TFields extends FieldValidators>(fields: TFields) => TableDefinition<TFields>;
export interface SchemaDefinition<TTables extends Record<string, TableDefinition<any>>> {
    tables: TTables;
    tableNames: Array<keyof TTables & string>;
    getTable<TName extends keyof TTables>(name: TName): TTables[TName];
    describe(): Record<keyof TTables & string, ReturnType<TTables[keyof TTables]['describe']>>;
}
export declare const defineSchema: <TTables extends Record<string, TableDefinition<any>>>(tables: TTables) => SchemaDefinition<TTables>;
export declare const v: {
    string: () => SchemaValidator<string>;
    number: () => SchemaValidator<number>;
    boolean: () => SchemaValidator<boolean>;
    id: <TableName extends string>(tableName: TableName) => SchemaValidator<string>;
    object: <TShape extends z.ZodRawShape>(shape: TShape) => SchemaValidator<z.core.$InferObjectOutput<{ -readonly [P in keyof TShape]: TShape[P]; }, {}>>;
    array: <TValue>(validator: SchemaValidator<TValue>) => SchemaValidator<TValue[]>;
    record: <TValue>(validator: SchemaValidator<TValue>) => SchemaValidator<Record<string | number | symbol, unknown>>;
    literal: <TValue extends LiteralValue>(value: TValue) => SchemaValidator<TValue>;
    any: () => SchemaValidator<any>;
};
export type { SchemaValidator, SchemaValidator as Validator, ValidatorMeta };
