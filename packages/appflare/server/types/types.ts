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

export type AppflareSelect<TDoc> =
	| ReadonlyArray<Keys<TDoc>>
	| Partial<Record<Keys<TDoc>, boolean>>;

export type AppflareInclude<
	TDoc,
	TTableDocMap extends Record<string, TableDocBase>,
> =
	| ReadonlyArray<PopulatableKeys<TDoc, TTableDocMap>>
	| Partial<Record<PopulatableKeys<TDoc, TTableDocMap>, boolean>>;

export type AppflareResultDoc<
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

export type AppflareFindManyArgs<
	TableName extends string,
	TTableDocMap extends Record<TableName, TableDocBase>,
> = {
	where?: QueryWhere<TTableDocMap[TableName]>;
	orderBy?: QuerySort<keyof TTableDocMap[TableName] & string>;
	skip?: number;
	take?: number;
	select?: AppflareSelect<TTableDocMap[TableName]>;
	include?: AppflareInclude<TTableDocMap[TableName], TTableDocMap>;
};

export type AppflareFindFirstArgs<
	TableName extends string,
	TTableDocMap extends Record<TableName, TableDocBase>,
> = AppflareFindManyArgs<TableName, TTableDocMap>;

export type AppflareFindUniqueArgs<
	TableName extends string,
	TTableDocMap extends Record<TableName, TableDocBase>,
> = Omit<
	AppflareFindManyArgs<TableName, TTableDocMap>,
	"skip" | "take" | "orderBy"
> & {
	where: Id<TableName> | QueryWhere<TTableDocMap[TableName]>;
};

export type AppflareCreateArgs<
	TableName extends string,
	TTableDocMap extends Record<TableName, TableDocBase>,
> = {
	data: EditableDoc<TTableDocMap[TableName]>;
	select?: AppflareSelect<TTableDocMap[TableName]>;
	include?: AppflareInclude<TTableDocMap[TableName], TTableDocMap>;
};

export type AppflareUpdateArgs<
	TableName extends string,
	TTableDocMap extends Record<TableName, TableDocBase>,
> = {
	where: Id<TableName> | QueryWhere<TTableDocMap[TableName]>;
	data: Partial<EditableDoc<TTableDocMap[TableName]>>;
	select?: AppflareSelect<TTableDocMap[TableName]>;
	include?: AppflareInclude<TTableDocMap[TableName], TTableDocMap>;
};

export type AppflareDeleteArgs<
	TableName extends string,
	TTableDocMap extends Record<TableName, TableDocBase>,
> = {
	where: Id<TableName> | QueryWhere<TTableDocMap[TableName]>;
	select?: AppflareSelect<TTableDocMap[TableName]>;
	include?: AppflareInclude<TTableDocMap[TableName], TTableDocMap>;
};

export type AppflareUpdateManyArgs<
	TableName extends string,
	TTableDocMap extends Record<TableName, TableDocBase>,
> = {
	where?: QueryWhere<TTableDocMap[TableName]>;
	data: Partial<EditableDoc<TTableDocMap[TableName]>>;
};

export type AppflareDeleteManyArgs<
	TableName extends string,
	TTableDocMap extends Record<TableName, TableDocBase>,
> = {
	where?: QueryWhere<TTableDocMap[TableName]>;
};

export type AppflareCountArgs<
	TableName extends string,
	TTableDocMap extends Record<TableName, TableDocBase>,
> = {
	where?: QueryWhere<TTableDocMap[TableName]>;
};

export type AppflareTableClient<
	TableName extends string,
	TTableDocMap extends Record<TableName, TableDocBase>,
> = {
	findMany<TSelect = AppflareSelect<TTableDocMap[TableName]>, TInclude = never>(
		args?: AppflareFindManyArgs<TableName, TTableDocMap> & {
			select?: TSelect;
			include?: TInclude;
		}
	): Promise<
		Array<
			AppflareResultDoc<
				TTableDocMap[TableName],
				TSelect,
				TInclude,
				TTableDocMap
			>
		>
	>;
	findFirst<
		TSelect = AppflareSelect<TTableDocMap[TableName]>,
		TInclude = never,
	>(
		args?: AppflareFindFirstArgs<TableName, TTableDocMap> & {
			select?: TSelect;
			include?: TInclude;
		}
	): Promise<AppflareResultDoc<
		TTableDocMap[TableName],
		TSelect,
		TInclude,
		TTableDocMap
	> | null>;
	findUnique<
		TSelect = AppflareSelect<TTableDocMap[TableName]>,
		TInclude = never,
	>(
		args: AppflareFindUniqueArgs<TableName, TTableDocMap> & {
			select?: TSelect;
			include?: TInclude;
		}
	): Promise<AppflareResultDoc<
		TTableDocMap[TableName],
		TSelect,
		TInclude,
		TTableDocMap
	> | null>;
	create<TSelect = AppflareSelect<TTableDocMap[TableName]>, TInclude = never>(
		args: AppflareCreateArgs<TableName, TTableDocMap> & {
			select?: TSelect;
			include?: TInclude;
		}
	): Promise<
		AppflareResultDoc<TTableDocMap[TableName], TSelect, TInclude, TTableDocMap>
	>;
	update<TSelect = AppflareSelect<TTableDocMap[TableName]>, TInclude = never>(
		args: AppflareUpdateArgs<TableName, TTableDocMap> & {
			select?: TSelect;
			include?: TInclude;
		}
	): Promise<AppflareResultDoc<
		TTableDocMap[TableName],
		TSelect,
		TInclude,
		TTableDocMap
	> | null>;
	updateMany(
		args: AppflareUpdateManyArgs<TableName, TTableDocMap>
	): Promise<{ count: number }>;
	delete<TSelect = AppflareSelect<TTableDocMap[TableName]>, TInclude = never>(
		args: AppflareDeleteArgs<TableName, TTableDocMap> & {
			select?: TSelect;
			include?: TInclude;
		}
	): Promise<AppflareResultDoc<
		TTableDocMap[TableName],
		TSelect,
		TInclude,
		TTableDocMap
	> | null>;
	deleteMany(
		args?: AppflareDeleteManyArgs<TableName, TTableDocMap>
	): Promise<{ count: number }>;
	count(args?: AppflareCountArgs<TableName, TTableDocMap>): Promise<number>;
};

export type AppflareModelMap<
	TTableNames extends string,
	TTableDocMap extends Record<TTableNames, TableDocBase>,
> = {
	[K in TTableNames]: AppflareTableClient<K, TTableDocMap>;
};

export type MongoDbContext<
	TTableNames extends string,
	TTableDocMap extends Record<TTableNames, TableDocBase>,
> = AppflareModelMap<TTableNames, TTableDocMap>;

export type CreateMongoDbContextOptions<TTableNames extends string> = {
	db: Db;
	/** The same schema object you pass to defineSchema(...) */
	schema: Record<TTableNames, AnyZod>;
	/** Override collection naming if desired. Default is the table name. */
	collectionName?: (table: TTableNames) => string;
};

export type SchemaRefMap = Map<string, Map<string, string>>;
