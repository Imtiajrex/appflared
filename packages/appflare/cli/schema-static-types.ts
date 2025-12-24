export const staticTypeDefinitions = `
type Keys<T> = keyof T;

type NonNil<T> = Exclude<T, null | undefined>;

type ExtractIdTableName<T> = NonNil<T> extends Id<infer TTable>
	? TTable
	: NonNil<T> extends Array<infer TItem>
		? ExtractIdTableName<TItem>
		: never;

type PopulateValue<T> = T extends Id<infer TTable>
	? (TTable extends TableNames ? Doc<TTable> : never)
	: T extends Array<infer TItem>
		? Array<PopulateValue<TItem>>
		: T extends null
			? null
			: T extends undefined
				? undefined
				: NonNil<T> extends Id<infer TTable2>
					? (TTable2 extends TableNames ? Doc<TTable2> : never) | Extract<T, null> | Extract<T, undefined>
					: NonNil<T> extends Array<infer TItem2>
						? (Array<PopulateValue<TItem2>> | Extract<T, null> | Extract<T, undefined>)
						: T;

type PopulatableKeys<TDoc> = {
	[K in Keys<TDoc>]: ExtractIdTableName<TDoc[K]> extends string ? K : never;
}[Keys<TDoc>];

type WithPopulated<TDoc, TKey extends Keys<TDoc>> = {
	[K in Keys<TDoc>]: K extends TKey ? PopulateValue<TDoc[K]> : TDoc[K];
};

type WithPopulatedMany<TDoc, TKeys extends Keys<TDoc>> = {
	[K in Keys<TDoc>]: K extends TKeys ? PopulateValue<TDoc[K]> : TDoc[K];
};

type WithSelected<TDoc, TKeys extends Keys<TDoc>> = Pick<TDoc, TKeys>;

export type SortDirection = "asc" | "desc";

export type QueryWhere<TableName extends TableNames> = Partial<
	TableDocMap[TableName]
> & Record<string, unknown>;

export type QuerySortKey<TableName extends TableNames> = keyof TableDocMap[TableName] &
	string;

export type QuerySort<TableName extends TableNames> =
	| Partial<Record<QuerySortKey<TableName>, SortDirection>>
	| Array<[QuerySortKey<TableName>, SortDirection]>
	| Record<string, SortDirection>
	| Array<[string, SortDirection]>;

type SelectedKeys<TDoc, TSelect> =
	TSelect extends readonly (infer TKey)[]
		? Extract<TKey, Keys<TDoc>>
		: TSelect extends Record<infer TKey, boolean>
			? Extract<TKey, Keys<TDoc>>
			: Keys<TDoc>;

type IncludedKeys<TDoc, TInclude> =
	TInclude extends readonly (infer TKey)[]
		? Extract<TKey, PopulatableKeys<TDoc>>
		: TInclude extends Record<infer TKey, boolean>
			? Extract<TKey, PopulatableKeys<TDoc>>
			: never;

export type PrismaSelect<TDoc> =
	| ReadonlyArray<Keys<TDoc>>
	| Partial<Record<Keys<TDoc>, boolean>>;

export type PrismaInclude<TDoc> =
	| ReadonlyArray<PopulatableKeys<TDoc>>
	| Partial<Record<PopulatableKeys<TDoc>, boolean>>;

type PrismaResultDoc<TDoc, TSelect, TInclude> = WithSelected<
	WithPopulatedMany<TDoc, IncludedKeys<TDoc, TInclude>>,
	SelectedKeys<TDoc, TSelect>
>;

export type PrismaFindManyArgs<TableName extends TableNames> = {
	where?: QueryWhere<TableName>;
	orderBy?: QuerySort<TableName>;
	skip?: number;
	take?: number;
	select?: PrismaSelect<TableDocMap[TableName]>;
	include?: PrismaInclude<TableDocMap[TableName]>;
};

export type PrismaFindFirstArgs<TableName extends TableNames> =
	PrismaFindManyArgs<TableName>;

export type PrismaFindUniqueArgs<TableName extends TableNames> = Omit<
	PrismaFindManyArgs<TableName>,
	"skip" | "take" | "orderBy"
> & {
	where: Id<TableName> | QueryWhere<TableName>;
};

export type PrismaCreateArgs<TableName extends TableNames> = {
	data: EditableDoc<TableName>;
	select?: PrismaSelect<TableDocMap[TableName]>;
	include?: PrismaInclude<TableDocMap[TableName]>;
};

export type PrismaUpdateArgs<TableName extends TableNames> = {
	where: Id<TableName> | QueryWhere<TableName>;
	data: Partial<EditableDoc<TableName>>;
	select?: PrismaSelect<TableDocMap[TableName]>;
	include?: PrismaInclude<TableDocMap[TableName]>;
};

export type PrismaDeleteArgs<TableName extends TableNames> = {
	where: Id<TableName> | QueryWhere<TableName>;
	select?: PrismaSelect<TableDocMap[TableName]>;
	include?: PrismaInclude<TableDocMap[TableName]>;
};

export type PrismaUpdateManyArgs<TableName extends TableNames> = {
	where?: QueryWhere<TableName>;
	data: Partial<EditableDoc<TableName>>;
};

export type PrismaDeleteManyArgs<TableName extends TableNames> = {
	where?: QueryWhere<TableName>;
};

export type PrismaCountArgs<TableName extends TableNames> = {
	where?: QueryWhere<TableName>;
};

export type PrismaTableClient<TableName extends TableNames> = {
	findMany<TSelect = PrismaSelect<TableDocMap[TableName]>, TInclude = never>(
		args?: PrismaFindManyArgs<TableName> & {
			select?: TSelect;
			include?: TInclude;
		}
	): Promise<
		Array<PrismaResultDoc<TableDocMap[TableName], TSelect, TInclude>>
	>;
	findFirst<
		TSelect = PrismaSelect<TableDocMap[TableName]>,
		TInclude = never,
	>(
		args?: PrismaFindFirstArgs<TableName> & {
			select?: TSelect;
			include?: TInclude;
		}
	): Promise<
		PrismaResultDoc<TableDocMap[TableName], TSelect, TInclude> | null
	>;
	findUnique<
		TSelect = PrismaSelect<TableDocMap[TableName]>,
		TInclude = never,
	>(
		args: PrismaFindUniqueArgs<TableName> & {
			select?: TSelect;
			include?: TInclude;
		}
	): Promise<
		PrismaResultDoc<TableDocMap[TableName], TSelect, TInclude> | null
	>;
	create<
		TSelect = PrismaSelect<TableDocMap[TableName]>,
		TInclude = never,
	>(
		args: PrismaCreateArgs<TableName> & {
			select?: TSelect;
			include?: TInclude;
		}
	): Promise<
		PrismaResultDoc<TableDocMap[TableName], TSelect, TInclude>
	>;
	update<
		TSelect = PrismaSelect<TableDocMap[TableName]>,
		TInclude = never,
	>(
		args: PrismaUpdateArgs<TableName> & {
			select?: TSelect;
			include?: TInclude;
		}
	): Promise<
		PrismaResultDoc<TableDocMap[TableName], TSelect, TInclude> | null
	>;
	updateMany(args: PrismaUpdateManyArgs<TableName>): Promise<{ count: number }>;
	delete<
		TSelect = PrismaSelect<TableDocMap[TableName]>,
		TInclude = never,
	>(
		args: PrismaDeleteArgs<TableName> & {
			select?: TSelect;
			include?: TInclude;
		}
	): Promise<
		PrismaResultDoc<TableDocMap[TableName], TSelect, TInclude> | null
	>;
	deleteMany(args?: PrismaDeleteManyArgs<TableName>): Promise<{ count: number }>;
	count(args?: PrismaCountArgs<TableName>): Promise<number>;
};

export type PrismaModelMap = {
	[K in TableNames]: PrismaTableClient<K>;
};

export type DatabaseReader = PrismaModelMap;

export interface QueryContext {
	db: DatabaseReader;
}

export type QueryArgsShape = Record<string, AnyValidator>;

type InferValidator<TValidator> =
	TValidator extends SchemaValidator<infer TValue> ? TValue : never;

export type InferQueryArgs<TArgs extends QueryArgsShape> = {
	[Key in keyof TArgs]: InferValidator<TArgs[Key]>;
};

export interface QueryDefinition<TArgs extends QueryArgsShape, TResult> {
	args: TArgs;
	handler: (ctx: QueryContext, args: InferQueryArgs<TArgs>) => Promise<TResult>;
}

export const query = <TArgs extends QueryArgsShape, TResult>(
	definition: QueryDefinition<TArgs, TResult>
): QueryDefinition<TArgs, TResult> => definition;

export type EditableDoc<TableName extends TableNames> = Omit<
	TableDocMap[TableName],
	"_id" | "_creationTime"
>;

export interface DatabaseWriter extends DatabaseReader {}

export interface MutationContext {
	db: DatabaseWriter;
}

export interface MutationDefinition<TArgs extends QueryArgsShape, TResult> {
	args: TArgs;
	handler: (
		ctx: MutationContext,
		args: InferQueryArgs<TArgs>
	) => Promise<TResult>;
}

export const mutation = <TArgs extends QueryArgsShape, TResult>(
	definition: MutationDefinition<TArgs, TResult>
): MutationDefinition<TArgs, TResult> => definition;
`;
