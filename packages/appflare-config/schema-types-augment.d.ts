import type {
	DatabaseWriter,
	EditableDoc,
	Id,
	QueryWhere,
	TableDocMap,
	TableNames,
} from "./_generated/src/schema-types";

type DeleteBuilder<TableName extends TableNames> = {
	where(where: Id<TableName> | QueryWhere<TableName>): {
		exec(): Promise<void>;
	};
};

type UpdateBuilder<TableName extends TableNames> = {
	where(where: Id<TableName> | QueryWhere<TableName>): {
		set(partial: Partial<EditableDoc<TableName>>): { exec(): Promise<void> };
		exec(partial: Partial<EditableDoc<TableName>>): Promise<void>;
	};
};

declare module "./_generated/src/schema-types" {
	interface DatabaseWriter {
		delete<TableName extends TableNames>(
			table: TableName
		): DeleteBuilder<TableName>;
		patch<TableName extends TableNames>(
			table: TableName
		): UpdateBuilder<TableName>;
		update<TableName extends TableNames>(
			table: TableName
		): UpdateBuilder<TableName>;
	}
}
