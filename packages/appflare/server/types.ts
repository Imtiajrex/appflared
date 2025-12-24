import type { Db } from "mongodb";

export type AnyZod = any;

export type TableDocBase = {
	_id: string;
	_creationTime: number;
};

export type Id<TableName extends string> = string & { __table?: TableName };

export type EditableDoc<TDoc extends TableDocBase> = Omit<
	TDoc,
	"_id" | "_creationTime"
>;

export type SelectedKeys<TDoc, TSelect> =
	TSelect extends readonly (infer TKey)[]
		? Extract<TKey, Keys<TDoc>>
		: TSelect extends Record<infer TKey, boolean>
			? Extract<TKey, Keys<TDoc>>
			: Keys<TDoc>;

export type IncludedKeys<
	TDoc,
	TInclude,
	TTableDocMap extends Record<string, TableDocBase>,
> = TInclude extends readonly (infer TKey)[]
	? Extract<TKey, PopulatableKeys<TDoc, TTableDocMap>>
	: TInclude extends Record<infer TKey, boolean>
		? Extract<TKey, PopulatableKeys<TDoc, TTableDocMap>>
		: never;

export type PrismaSelect<TDoc> =
	| ReadonlyArray<Keys<TDoc>>
	| Partial<Record<Keys<TDoc>, boolean>>;

export type PrismaInclude<
	TDoc,
	TTableDocMap extends Record<string, TableDocBase>,
> =
	| ReadonlyArray<PopulatableKeys<TDoc, TTableDocMap>>
	| Partial<Record<PopulatableKeys<TDoc, TTableDocMap>, boolean>>;

export type PrismaResultDoc<
	TDoc,
	TSelect,
	TInclude,
	TTableDocMap extends Record<string, TableDocBase>,
> = WithSelected<
	WithPopulatedMany<
		TDoc,
		IncludedKeys<TDoc, TInclude, TTableDocMap>,
		TTableDocMap
	>,
	SelectedKeys<TDoc, TSelect>
>;

export type SortDirection = "asc" | "desc";

export type QuerySort<TKey extends string> =
	| Partial<Record<TKey, SortDirection>>
	| Array<[TKey, SortDirection]>
	| Record<string, SortDirection>
	| Array<[string, SortDirection]>;

export type QueryWhere<TDoc extends Record<string, unknown>> = Partial<TDoc> &
	Record<string, unknown>;

export type Keys<T> = keyof T;

export type NonNil<T> = Exclude<T, null | undefined>;

export type ExtractIdTableName<T> =
	NonNil<T> extends Id<infer TTable>
		? TTable
		: NonNil<T> extends Array<infer TItem>
			? ExtractIdTableName<TItem>
			: never;

export type PopulateValue<
	T,
	TTableDocMap extends Record<string, TableDocBase>,
> =
	T extends Id<infer TTable>
		? TTable extends keyof TTableDocMap
			? TTableDocMap[TTable]
			: never
		: T extends Array<infer TItem>
			? Array<PopulateValue<TItem, TTableDocMap>>
			: T;

export type PopulatableKeys<
	TDoc,
	TTableDocMap extends Record<string, TableDocBase>,
> = {
	[K in Keys<TDoc>]: ExtractIdTableName<TDoc[K]> extends keyof TTableDocMap
		? K
		: never;
}[Keys<TDoc>];

export type WithPopulated<
	TDoc,
	TKey extends Keys<TDoc>,
	TTableDocMap extends Record<string, TableDocBase>,
> = {
	[K in Keys<TDoc>]: K extends TKey
		? PopulateValue<TDoc[K], TTableDocMap>
		: TDoc[K];
};

export type WithPopulatedMany<
	TDoc,
	TKeys extends Keys<TDoc>,
	TTableDocMap extends Record<string, TableDocBase>,
> = {
	[K in Keys<TDoc>]: K extends TKeys
		? PopulateValue<TDoc[K], TTableDocMap>
		: TDoc[K];
};

export type WithSelected<TDoc, TKeys extends Keys<TDoc>> = Pick<TDoc, TKeys>;

export type MongoDbQuery<
	TableName extends string,
	TTableDocMap extends Record<string, TableDocBase>,
	TResultDoc,
> = {
	where(
		filter: QueryWhere<TTableDocMap[TableName]>
	): MongoDbQuery<TableName, TTableDocMap, TResultDoc>;
	sort(
		sort: QuerySort<keyof TTableDocMap[TableName] & string>
	): MongoDbQuery<TableName, TTableDocMap, TResultDoc>;
	limit(limit: number): MongoDbQuery<TableName, TTableDocMap, TResultDoc>;
	offset(offset: number): MongoDbQuery<TableName, TTableDocMap, TResultDoc>;

	select<const TKeys extends readonly Keys<TResultDoc>[]>(
		keys: TKeys
	): MongoDbQuery<
		TableName,
		TTableDocMap,
		WithSelected<TResultDoc, TKeys[number]>
	>;
	select<const TKeys extends readonly Keys<TResultDoc>[]>(
		...keys: TKeys
	): MongoDbQuery<
		TableName,
		TTableDocMap,
		WithSelected<TResultDoc, TKeys[number]>
	>;

	populate<const TKey extends PopulatableKeys<TResultDoc, TTableDocMap>>(
		key: TKey
	): MongoDbQuery<
		TableName,
		TTableDocMap,
		WithPopulated<TResultDoc, TKey, TTableDocMap>
	>;
	populate<
		const TKeys extends readonly PopulatableKeys<TResultDoc, TTableDocMap>[],
	>(
		keys: TKeys
	): MongoDbQuery<
		TableName,
		TTableDocMap,
		WithPopulatedMany<TResultDoc, TKeys[number], TTableDocMap>
	>;

	find(): Promise<Array<TResultDoc>>;
	findOne(): Promise<TResultDoc | null>;
};

export type MongoDbDeleteBuilder<
	TableName extends string,
	TTableDocMap extends Record<string, TableDocBase>,
> = {
	where(where: Id<TableName> | QueryWhere<TTableDocMap[TableName]>): {
		exec(): Promise<void>;
	};
};

export type MongoDbUpdateBuilder<
	TableName extends string,
	TTableDocMap extends Record<string, TableDocBase>,
> = {
	where(where: Id<TableName> | QueryWhere<TTableDocMap[TableName]>): {
		set(partial: Partial<EditableDoc<TTableDocMap[TableName]>>): {
			exec(): Promise<void>;
		};
		exec(partial: Partial<EditableDoc<TTableDocMap[TableName]>>): Promise<void>;
	};
};

export type MongoDbPatchBuilder<
	TableName extends string,
	TTableDocMap extends Record<string, TableDocBase>,
> = MongoDbUpdateBuilder<TableName, TTableDocMap>;

export type MongoDbCoreContext<
	TTableNames extends string,
	TTableDocMap extends Record<TTableNames, TableDocBase>,
> = {
	query<TableName extends TTableNames>(
		table: TableName
	): MongoDbQuery<TableName, TTableDocMap, TTableDocMap[TableName]>;
	insert<TableName extends TTableNames>(
		table: TableName,
		value: EditableDoc<TTableDocMap[TableName]>
	): Promise<Id<TableName>>;
	update<TableName extends TTableNames>(
		table: TableName
	): MongoDbUpdateBuilder<TableName, TTableDocMap>;
	update<TableName extends TTableNames>(
		table: TableName,
		where: Id<TableName> | QueryWhere<TTableDocMap[TableName]>,
		partial: Partial<EditableDoc<TTableDocMap[TableName]>>
	): Promise<void>;
	patch<TableName extends TTableNames>(
		table: TableName
	): MongoDbPatchBuilder<TableName, TTableDocMap>;
	patch<TableName extends TTableNames>(
		table: TableName,
		where: Id<TableName> | QueryWhere<TTableDocMap[TableName]>,
		partial: Partial<EditableDoc<TTableDocMap[TableName]>>
	): Promise<void>;
	delete<TableName extends TTableNames>(
		table: TableName
	): MongoDbDeleteBuilder<TableName, TTableDocMap>;
	delete<TableName extends TTableNames>(
		table: TableName,
		where: Id<TableName> | QueryWhere<TTableDocMap[TableName]>
	): Promise<void>;
};

export type PrismaFindManyArgs<
	TableName extends string,
	TTableDocMap extends Record<TableName, TableDocBase>,
> = {
	where?: QueryWhere<TTableDocMap[TableName]>;
	orderBy?: QuerySort<keyof TTableDocMap[TableName] & string>;
	skip?: number;
	take?: number;
	select?: PrismaSelect<TTableDocMap[TableName]>;
	include?: PrismaInclude<TTableDocMap[TableName], TTableDocMap>;
};

export type PrismaFindFirstArgs<
	TableName extends string,
	TTableDocMap extends Record<TableName, TableDocBase>,
> = PrismaFindManyArgs<TableName, TTableDocMap>;

export type PrismaFindUniqueArgs<
	TableName extends string,
	TTableDocMap extends Record<TableName, TableDocBase>,
> = Omit<
	PrismaFindManyArgs<TableName, TTableDocMap>,
	"skip" | "take" | "orderBy"
> & {
	where: Id<TableName> | QueryWhere<TTableDocMap[TableName]>;
};

export type PrismaCreateArgs<
	TableName extends string,
	TTableDocMap extends Record<TableName, TableDocBase>,
> = {
	data: EditableDoc<TTableDocMap[TableName]>;
	select?: PrismaSelect<TTableDocMap[TableName]>;
	include?: PrismaInclude<TTableDocMap[TableName], TTableDocMap>;
};

export type PrismaUpdateArgs<
	TableName extends string,
	TTableDocMap extends Record<TableName, TableDocBase>,
> = {
	where: Id<TableName> | QueryWhere<TTableDocMap[TableName]>;
	data: Partial<EditableDoc<TTableDocMap[TableName]>>;
	select?: PrismaSelect<TTableDocMap[TableName]>;
	include?: PrismaInclude<TTableDocMap[TableName], TTableDocMap>;
};

export type PrismaDeleteArgs<
	TableName extends string,
	TTableDocMap extends Record<TableName, TableDocBase>,
> = {
	where: Id<TableName> | QueryWhere<TTableDocMap[TableName]>;
	select?: PrismaSelect<TTableDocMap[TableName]>;
	include?: PrismaInclude<TTableDocMap[TableName], TTableDocMap>;
};

export type PrismaUpdateManyArgs<
	TableName extends string,
	TTableDocMap extends Record<TableName, TableDocBase>,
> = {
	where?: QueryWhere<TTableDocMap[TableName]>;
	data: Partial<EditableDoc<TTableDocMap[TableName]>>;
};

export type PrismaDeleteManyArgs<
	TableName extends string,
	TTableDocMap extends Record<TableName, TableDocBase>,
> = {
	where?: QueryWhere<TTableDocMap[TableName]>;
};

export type PrismaCountArgs<
	TableName extends string,
	TTableDocMap extends Record<TableName, TableDocBase>,
> = {
	where?: QueryWhere<TTableDocMap[TableName]>;
};

export type PrismaTableClient<
	TableName extends string,
	TTableDocMap extends Record<TableName, TableDocBase>,
> = {
	findMany<TSelect = PrismaSelect<TTableDocMap[TableName]>, TInclude = never>(
		args?: PrismaFindManyArgs<TableName, TTableDocMap> & {
			select?: TSelect;
			include?: TInclude;
		}
	): Promise<
		Array<
			PrismaResultDoc<TTableDocMap[TableName], TSelect, TInclude, TTableDocMap>
		>
	>;
	findFirst<TSelect = PrismaSelect<TTableDocMap[TableName]>, TInclude = never>(
		args?: PrismaFindFirstArgs<TableName, TTableDocMap> & {
			select?: TSelect;
			include?: TInclude;
		}
	): Promise<PrismaResultDoc<
		TTableDocMap[TableName],
		TSelect,
		TInclude,
		TTableDocMap
	> | null>;
	findUnique<TSelect = PrismaSelect<TTableDocMap[TableName]>, TInclude = never>(
		args: PrismaFindUniqueArgs<TableName, TTableDocMap> & {
			select?: TSelect;
			include?: TInclude;
		}
	): Promise<PrismaResultDoc<
		TTableDocMap[TableName],
		TSelect,
		TInclude,
		TTableDocMap
	> | null>;
	create<TSelect = PrismaSelect<TTableDocMap[TableName]>, TInclude = never>(
		args: PrismaCreateArgs<TableName, TTableDocMap> & {
			select?: TSelect;
			include?: TInclude;
		}
	): Promise<
		PrismaResultDoc<TTableDocMap[TableName], TSelect, TInclude, TTableDocMap>
	>;
	update<TSelect = PrismaSelect<TTableDocMap[TableName]>, TInclude = never>(
		args: PrismaUpdateArgs<TableName, TTableDocMap> & {
			select?: TSelect;
			include?: TInclude;
		}
	): Promise<PrismaResultDoc<
		TTableDocMap[TableName],
		TSelect,
		TInclude,
		TTableDocMap
	> | null>;
	updateMany(
		args: PrismaUpdateManyArgs<TableName, TTableDocMap>
	): Promise<{ count: number }>;
	delete<TSelect = PrismaSelect<TTableDocMap[TableName]>, TInclude = never>(
		args: PrismaDeleteArgs<TableName, TTableDocMap> & {
			select?: TSelect;
			include?: TInclude;
		}
	): Promise<PrismaResultDoc<
		TTableDocMap[TableName],
		TSelect,
		TInclude,
		TTableDocMap
	> | null>;
	deleteMany(
		args?: PrismaDeleteManyArgs<TableName, TTableDocMap>
	): Promise<{ count: number }>;
	count(args?: PrismaCountArgs<TableName, TTableDocMap>): Promise<number>;
};

export type PrismaModelMap<
	TTableNames extends string,
	TTableDocMap extends Record<TTableNames, TableDocBase>,
> = {
	[K in TTableNames]: PrismaTableClient<K, TTableDocMap>;
};

export type MongoDbContext<
	TTableNames extends string,
	TTableDocMap extends Record<TTableNames, TableDocBase>,
> = PrismaModelMap<TTableNames, TTableDocMap>;

export type CreateMongoDbContextOptions<TTableNames extends string> = {
	db: Db;
	/** The same schema object you pass to defineSchema(...) */
	schema: Record<TTableNames, AnyZod>;
	/** Override collection naming if desired. Default is the table name. */
	collectionName?: (table: TTableNames) => string;
};

export type SchemaRefMap = Map<string, Map<string, string>>;
