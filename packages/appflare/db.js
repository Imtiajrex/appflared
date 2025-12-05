import { z } from 'zod';
const createValidator = (schema, meta) => ({
    schema,
    meta,
    parse: (value) => schema.parse(value),
    optional: () => createValidator(schema.optional(), {
        ...meta,
        isOptional: true,
    }),
    nullable: () => createValidator(schema.nullable(), {
        ...meta,
        isNullable: true,
    }),
});
const createTableDefinition = (fields, indexes = []) => ({
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
export const defineTable = (fields) => {
    if (!fields || Object.keys(fields).length === 0) {
        throw new Error('defineTable requires at least one field');
    }
    return createTableDefinition(fields);
};
export const defineSchema = (tables) => {
    if (!tables || typeof tables !== 'object') {
        throw new Error('defineSchema expects a record of tables');
    }
    const tableNames = Object.keys(tables);
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
            return tableNames.reduce((acc, tableName) => {
                acc[tableName] = tables[tableName].describe();
                return acc;
            }, {});
        },
    };
};
export const v = {
    string: () => createValidator(z.string(), { kind: 'string' }),
    number: () => createValidator(z.number(), { kind: 'number' }),
    boolean: () => createValidator(z.boolean(), { kind: 'boolean' }),
    id: (tableName) => createValidator(z.string().min(1), { kind: 'id', references: tableName }),
    object: (shape) => createValidator(z.object(shape), { kind: 'object' }),
    array: (validator) => createValidator(z.array(validator.schema), { kind: 'array', elementMeta: validator.meta }),
    record: (validator) => createValidator(z.record(validator.schema), { kind: 'record', elementMeta: validator.meta }),
    literal: (value) => createValidator(z.literal(value), { kind: 'literal', literalValue: value }),
    any: () => createValidator(z.any(), { kind: 'unknown' }),
};
