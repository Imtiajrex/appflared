import type {
	AnyZod,
	TableDocBase,
	Id,
	AppflareSelect,
	AppflareInclude,
	AppflareResultDoc,
	AppflareFindManyArgs,
	AppflareFindFirstArgs,
	AppflareFindUniqueArgs,
	AppflareCreateArgs,
	AppflareUpdateArgs,
	AppflareUpdateManyArgs,
	AppflareDeleteArgs,
	AppflareDeleteManyArgs,
	AppflareCountArgs,
	AppflareAggregateArgs,
	AggregateResult,
	NormalizeGroupInput,
} from "../types/types";

export type AppflareDbContext<
	TTableNames extends string,
	TTableDocMap extends Record<TTableNames, TableDocBase>,
> = {
	[K in TTableNames]: AppflareTableClient<K, TTableDocMap>;
};

export type AppflareTableClient<
	TableName extends string,
	TTableDocMap extends Record<TableName, TableDocBase>,
> = {
	findMany<TSelect = AppflareSelect<TTableDocMap[TableName]>, TInclude = never>(
		args?: AppflareFindManyArgs<TableName, TTableDocMap> & {
			select?: TSelect;
			include?: TInclude;
		},
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
		},
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
		},
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
		},
	): Promise<
		AppflareResultDoc<TTableDocMap[TableName], TSelect, TInclude, TTableDocMap>
	>;
	update<TSelect = AppflareSelect<TTableDocMap[TableName]>, TInclude = never>(
		args: AppflareUpdateArgs<TableName, TTableDocMap> & {
			select?: TSelect;
			include?: TInclude;
		},
	): Promise<AppflareResultDoc<
		TTableDocMap[TableName],
		TSelect,
		TInclude,
		TTableDocMap
	> | null>;
	updateMany(
		args: AppflareUpdateManyArgs<TableName, TTableDocMap>,
	): Promise<{ count: number }>;
	delete<TSelect = AppflareSelect<TTableDocMap[TableName]>, TInclude = never>(
		args: AppflareDeleteArgs<TableName, TTableDocMap> & {
			select?: TSelect;
			include?: TInclude;
		},
	): Promise<AppflareResultDoc<
		TTableDocMap[TableName],
		TSelect,
		TInclude,
		TTableDocMap
	> | null>;
	deleteMany(
		args?: AppflareDeleteManyArgs<TableName, TTableDocMap>,
	): Promise<{ count: number }>;
	count(args?: AppflareCountArgs<TableName, TTableDocMap>): Promise<number>;
	aggregate<
		TGroup = any,
		TSum extends ReadonlyArray<string> = ReadonlyArray<string>,
		TAvg extends ReadonlyArray<string> = ReadonlyArray<string>,
	>(
		args: AppflareAggregateArgs<TableName, TTableDocMap, TGroup, TSum, TAvg>,
	): Promise<
		Array<
			AggregateResult<
				TTableDocMap[TableName],
				NormalizeGroupInput<TTableDocMap[TableName], TGroup>,
				TSum,
				TAvg
			>
		>
	>;
};

export type AppflareCoreContext<
	TTableNames extends string,
	TTableDocMap extends Record<TTableNames, TableDocBase>,
> = {
	query<TableName extends TTableNames>(table: TableName): any;
	insert<TableName extends TTableNames>(
		table: TableName,
		value: any,
	): Promise<Id<TableName>>;
	update<TableName extends TTableNames>(
		table: TableName,
		where: any,
		partial: any,
	): Promise<void>;
	patch<TableName extends TTableNames>(
		table: TableName,
		where: any,
		partial: any,
	): Promise<void>;
	delete<TableName extends TTableNames>(
		table: TableName,
		where: any,
	): Promise<void>;
};

export type CreateAppflareDbContextOptions<TTableNames extends string> = {
	schema: Record<TTableNames, AnyZod>;
	collectionName?: (table: TTableNames) => string;
};

export function createAppflareDbContext<
	TTableNames extends string,
	TTableDocMap extends Record<TTableNames, TableDocBase>,
>(
	options: CreateAppflareDbContextOptions<TTableNames>,
): AppflareDbContext<TTableNames, TTableDocMap> {
	return {} as any;
}
