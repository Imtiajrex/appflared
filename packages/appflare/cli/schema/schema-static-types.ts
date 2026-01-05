export const staticTypeDefinitions = `
type Keys<T> = keyof T;

type NonNil<T> = Exclude<T, null | undefined>;

type ExtractIdTableName<T> = NonNil<T> extends Id<infer TTable>
	? TTable
	: NonNil<T> extends Array<infer TItem>
		? ExtractIdTableName<TItem>
		: never;

type NumericKeys<T> =
	{
		[K in keyof T]: NonNil<T[K]> extends number | bigint ? K : never;
	}[keyof T] & string;

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

type GeoCoordinates = readonly [number, number];

export type GeoPoint = {
	type: "Point";
	coordinates: GeoCoordinates;
};

type GeoPointInput = GeoPoint | GeoCoordinates;

const GEO_EARTH_RADIUS_METERS = 6_378_100;

const __geoNormalizePoint = (point: GeoPointInput): GeoPoint =>
	Array.isArray(point)
		? { type: "Point", coordinates: [point[0], point[1]] }
		: point;

export const geo = {
	point(lng: number, lat: number): GeoPoint {
		return { type: "Point", coordinates: [lng, lat] };
	},
	near(
		field: string,
		point: GeoPointInput,
		options: { maxDistanceMeters?: number; minDistanceMeters?: number } = {}
	): Record<string, unknown> {
		const $near: Record<string, unknown> = {
			$geometry: __geoNormalizePoint(point),
		};
		if (options.maxDistanceMeters !== undefined)
			$near.$maxDistance = options.maxDistanceMeters;
		if (options.minDistanceMeters !== undefined)
			$near.$minDistance = options.minDistanceMeters;
		return { [field]: { $near } };
	},
	withinRadius(
		field: string,
		center: GeoPointInput,
		radiusMeters: number
	): Record<string, unknown> {
		return {
			[field]: {
				$geoWithin: {
					$centerSphere: [
						__geoNormalizePoint(center).coordinates,
						radiusMeters / GEO_EARTH_RADIUS_METERS,
					],
				},
			},
		};
	},
	withinBox(
		field: string,
		southwest: GeoPointInput,
		northeast: GeoPointInput
	): Record<string, unknown> {
		return {
			[field]: {
				$geoWithin: {
					$box: [
						__geoNormalizePoint(southwest).coordinates,
						__geoNormalizePoint(northeast).coordinates,
					],
				},
			},
		};
	},
	withinPolygon(
		field: string,
		polygon: ReadonlyArray<GeoPointInput>
	): Record<string, unknown> {
		return {
			[field]: {
				$geoWithin: {
					$polygon: polygon.map((p) =>
						__geoNormalizePoint(p).coordinates
					),
				},
			},
		};
	},
	intersects(
		field: string,
		geometry: { type: string; coordinates: unknown }
	): Record<string, unknown> {
		return {
			[field]: {
				$geoIntersects: {
					$geometry: geometry,
				},
			},
		};
	},
};

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

export type AppflareSelect<TDoc> =
	| ReadonlyArray<Keys<TDoc>>
	| Partial<Record<Keys<TDoc>, boolean>>;

type PopulatedDocForKey<TDoc, TKey extends Keys<TDoc>> =
	NonNil<PopulateValue<TDoc[TKey]>> extends Array<infer TItem>
		? NonNil<TItem>
		: NonNil<PopulateValue<TDoc[TKey]>>;

type AggregateSpec<TDoc> = {
	count?: boolean;
	sum?: ReadonlyArray<NumericKeys<TDoc>>;
	avg?: ReadonlyArray<NumericKeys<TDoc>>;
};

type AppflareIncludeRecord<TDoc> = {
	[K in PopulatableKeys<TDoc>]?:
		| boolean
		| {
			aggregate?: AggregateSpec<PopulatedDocForKey<TDoc, K>>;
			includeDocs?: boolean;
		};
};

export type AppflareInclude<TDoc> =
	| ReadonlyArray<PopulatableKeys<TDoc>>
	| AppflareIncludeRecord<TDoc>;

type ExtractAggregateSpec<T> = T extends { aggregate?: infer TSpec } ? TSpec : never;

type AggregateResultFromSpec<TDoc, TSpec> = (TSpec extends { count: true }
	? { count: number }
	: {}) &
	(TSpec extends { sum: infer TSum }
		? TSum extends ReadonlyArray<infer K>
			? { [P in Extract<K, NumericKeys<TDoc>> as \`sum_\${P}\`]: number }
			: {}
		: {}) &
	(TSpec extends { avg: infer TAvg }
		? TAvg extends ReadonlyArray<infer K>
			? { [P in Extract<K, NumericKeys<TDoc>> as \`avg_\${P}\`]: number }
			: {}
		: {});

type AggregateMapForInclude<TDoc, TInclude> = TInclude extends ReadonlyArray<any>
	? {}
	: {
		[K in keyof TInclude as ExtractAggregateSpec<TInclude[K]> extends never
			? never
			: K]: AggregateResultFromSpec<
			PopulatedDocForKey<TDoc, Extract<K, Keys<TDoc>>>,
			ExtractAggregateSpec<TInclude[K]>
		>;
	};

type WithAggregatesForInclude<TDoc, TInclude> = keyof AggregateMapForInclude<
	TDoc,
	TInclude
> extends never
	? {}
	: { _aggregates: AggregateMapForInclude<TDoc, TInclude> };

type AppflareResultDoc<TDoc, TSelect, TInclude> =
	WithSelected<
		WithPopulatedMany<TDoc, IncludedKeys<TDoc, TInclude>>,
		SelectedKeys<TDoc, TSelect>
	> &
		WithAggregatesForInclude<TDoc, TInclude>;

export type AppflareFindManyArgs<TableName extends TableNames> = {
	where?: QueryWhere<TableName>;
	orderBy?: QuerySort<TableName>;
	skip?: number;
	take?: number;
	select?: AppflareSelect<TableDocMap[TableName]>;
	include?: AppflareInclude<TableDocMap[TableName]>;
};

export type AppflareFindFirstArgs<TableName extends TableNames> =
	AppflareFindManyArgs<TableName>;

export type AppflareFindUniqueArgs<TableName extends TableNames> = Omit<
	AppflareFindManyArgs<TableName>,
	"skip" | "take" | "orderBy"
> & {
	where: Id<TableName> | QueryWhere<TableName>;
};

export type AppflareCreateArgs<TableName extends TableNames> = {
	data: EditableDoc<TableName>;
	select?: AppflareSelect<TableDocMap[TableName]>;
	include?: AppflareInclude<TableDocMap[TableName]>;
};

export type AppflareUpdateArgs<TableName extends TableNames> = {
	where: Id<TableName> | QueryWhere<TableName>;
	data: Partial<EditableDoc<TableName>>;
	select?: AppflareSelect<TableDocMap[TableName]>;
	include?: AppflareInclude<TableDocMap[TableName]>;
};

export type AppflareDeleteArgs<TableName extends TableNames> = {
	where: Id<TableName> | QueryWhere<TableName>;
	select?: AppflareSelect<TableDocMap[TableName]>;
	include?: AppflareInclude<TableDocMap[TableName]>;
};

export type AppflareUpdateManyArgs<TableName extends TableNames> = {
	where?: QueryWhere<TableName>;
	data: Partial<EditableDoc<TableName>>;
};

export type AppflareDeleteManyArgs<TableName extends TableNames> = {
	where?: QueryWhere<TableName>;
};

export type AppflareCountArgs<TableName extends TableNames> = {
	where?: QueryWhere<TableName>;
};

type AggregateGroupInput<TDoc> =
	| ReadonlyArray<keyof TDoc & string>
	| (keyof TDoc & string);

type NormalizeGroupInput<TDoc, TGroup> =
	TGroup extends readonly (infer K)[]
		? ReadonlyArray<Extract<K, keyof TDoc & string>>
		: TGroup extends string
			? ReadonlyArray<Extract<TGroup, keyof TDoc & string>>
			: ReadonlyArray<never>;

type AggregateId<TDoc, TGroup extends ReadonlyArray<keyof TDoc & string>> =
	TGroup extends readonly []
		? null
		: TGroup extends readonly [infer K]
			? TDoc[Extract<K, keyof TDoc>]
			: { [K in TGroup[number]]: TDoc[K] };

type AggregateResult<
	TDoc,
	TGroup extends ReadonlyArray<keyof TDoc & string>,
	TSum extends ReadonlyArray<NumericKeys<TDoc>>,
	TAvg extends ReadonlyArray<NumericKeys<TDoc>>,
> = {
		_id: AggregateId<TDoc, TGroup>;
	} & (TSum[number] extends never ? {} : { [K in TSum[number] as \`sum_\${K}\`]: number }) &
	(TAvg[number] extends never ? {} : { [K in TAvg[number] as \`avg_\${K}\`]: number });

export type AppflareAggregateArgs<
	TableName extends TableNames,
	TGroup = AggregateGroupInput<TableDocMap[TableName]>,
	TSum extends ReadonlyArray<NumericKeys<TableDocMap[TableName]>> = ReadonlyArray<
		NumericKeys<TableDocMap[TableName]>
	>,
	TAvg extends ReadonlyArray<NumericKeys<TableDocMap[TableName]>> = ReadonlyArray<
		NumericKeys<TableDocMap[TableName]>
	>,
> = {
	where?: QueryWhere<TableName>;
	groupBy?: TGroup;
	sum?: TSum;
	avg?: TAvg;
	/**
	 * Populate aggregated group keys that are references to other tables.
	 * Only keys present in groupBy are eligible for populate.
	 */
	populate?: AppflareInclude<TableDocMap[TableName]>;
};

export type AppflareTableClient<TableName extends TableNames> = {
	findMany<TSelect = AppflareSelect<TableDocMap[TableName]>, TInclude = never>(
		args?: AppflareFindManyArgs<TableName> & {
			select?: TSelect;
			include?: TInclude;
		}
	): Promise<
		Array<AppflareResultDoc<TableDocMap[TableName], TSelect, TInclude>>
	>;
	findFirst<
		TSelect = AppflareSelect<TableDocMap[TableName]>,
		TInclude = never,
	>(
		args?: AppflareFindFirstArgs<TableName> & {
			select?: TSelect;
			include?: TInclude;
		}
	): Promise<
		AppflareResultDoc<TableDocMap[TableName], TSelect, TInclude> | null
	>;
	findUnique<
		TSelect = AppflareSelect<TableDocMap[TableName]>,
		TInclude = never,
	>(
		args: AppflareFindUniqueArgs<TableName> & {
			select?: TSelect;
			include?: TInclude;
		}
	): Promise<
		AppflareResultDoc<TableDocMap[TableName], TSelect, TInclude> | null
	>;
	create<
		TSelect = AppflareSelect<TableDocMap[TableName]>,
		TInclude = never,
	>(
		args: AppflareCreateArgs<TableName> & {
			select?: TSelect;
			include?: TInclude;
		}
	): Promise<
		AppflareResultDoc<TableDocMap[TableName], TSelect, TInclude>
	>;
	update<
		TSelect = AppflareSelect<TableDocMap[TableName]>,
		TInclude = never,
	>(
		args: AppflareUpdateArgs<TableName> & {
			select?: TSelect;
			include?: TInclude;
		}
	): Promise<
		AppflareResultDoc<TableDocMap[TableName], TSelect, TInclude> | null
	>;
	updateMany(args: AppflareUpdateManyArgs<TableName>): Promise<{ count: number }>;
	delete<
		TSelect = AppflareSelect<TableDocMap[TableName]>,
		TInclude = never,
	>(
		args: AppflareDeleteArgs<TableName> & {
			select?: TSelect;
			include?: TInclude;
		}
	): Promise<
		AppflareResultDoc<TableDocMap[TableName], TSelect, TInclude> | null
	>;
	deleteMany(args?: AppflareDeleteManyArgs<TableName>): Promise<{ count: number }>;
	count(args?: AppflareCountArgs<TableName>): Promise<number>;
	aggregate<
		TGroup = AggregateGroupInput<TableDocMap[TableName]>,
		TSum extends ReadonlyArray<NumericKeys<TableDocMap[TableName]>> = ReadonlyArray<
			NumericKeys<TableDocMap[TableName]>
		>,
		TAvg extends ReadonlyArray<NumericKeys<TableDocMap[TableName]>> = ReadonlyArray<
			NumericKeys<TableDocMap[TableName]>
		>,
	>(
		args: AppflareAggregateArgs<TableName, TGroup, TSum, TAvg>
	): Promise<
		Array<
			AggregateResult<
				TableDocMap[TableName],
				NormalizeGroupInput<TableDocMap[TableName], TGroup>,
				TSum,
				TAvg
			>
		>
	>;
};

export type AppflareModelMap = {
	[K in TableNames]: AppflareTableClient<K>;
};

export type DatabaseReader = AppflareModelMap;

declare global {
	interface AppflareSchedulerHandlerMap {}
}

type SchedulerTaskKeys = keyof AppflareSchedulerHandlerMap;

export type SchedulerTaskName = [SchedulerTaskKeys] extends [never]
	? string
	: SchedulerTaskKeys;

export type SchedulerPayload<TTask extends SchedulerTaskName> =
	TTask extends keyof AppflareSchedulerHandlerMap
		? AppflareSchedulerHandlerMap[TTask]
		: unknown;

export type SchedulerEnqueueOptions = { delaySeconds?: number };

type SchedulerEnqueueTyped = {
	<TTask extends SchedulerTaskName>(
		task: TTask,
		...args: SchedulerPayload<TTask> extends undefined
			? [payload?: SchedulerPayload<TTask>, options?: SchedulerEnqueueOptions]
			: [payload: SchedulerPayload<TTask>, options?: SchedulerEnqueueOptions]
	): Promise<void>;
};

export type Scheduler = {
	enqueue: SchedulerEnqueueTyped;
};

export type SchedulerContext<Env = unknown> = AppflareAuthContext & {
	db: DatabaseReader;
	scheduler: Scheduler;
	env: Env;
};

export type SchedulerDefinition<
	TArgs extends QueryArgsShape | undefined = undefined,
	Env = unknown,
> = {
	args?: TArgs;
	handler: (
		ctx: SchedulerContext<Env>,
		payload: TArgs extends QueryArgsShape ? InferQueryArgs<TArgs> : undefined
	) => Promise<void>;
};

export const scheduler = <TArgs extends QueryArgsShape | undefined = undefined, Env = unknown>(
	definition: SchedulerDefinition<TArgs, Env>
): SchedulerDefinition<TArgs, Env> => definition;

type ScheduledController = {
	cron: string;
	scheduledTime?: number;
	nextScheduledTime?: number;
};

type ExecutionContext = {
	waitUntil(promise: Promise<unknown>): void;
};

type CronTriggerInput = string | readonly string[];

export type CronContext<Env = unknown> = AppflareAuthContext & {
	db: DatabaseReader;
	scheduler?: Scheduler;
	env: Env;
	controller: ScheduledController;
	ctx: ExecutionContext;
};

export type CronDefinition<Env = unknown> = {
	cronTrigger: CronTriggerInput;
	handler: (ctx: CronContext<Env>) => Promise<void>;
};

export const cron = <Env = unknown>(
	definition: CronDefinition<Env>
): CronDefinition<Env> => definition;

export interface QueryContext extends AppflareAuthContext {
	db: DatabaseReader;
	scheduler?: Scheduler;
}

export interface InternalQueryContext {
	db: DatabaseReader;
	scheduler?: Scheduler;
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

export interface MutationContext extends AppflareAuthContext {
	db: DatabaseWriter;
	scheduler?: Scheduler;
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

export interface InternalMutationContext {
	db: DatabaseWriter;
	scheduler?: Scheduler;
}

export interface InternalQueryDefinition<
	TArgs extends QueryArgsShape,
	TResult,
> {
	args: TArgs;
	handler: (
		ctx: InternalQueryContext,
		args: InferQueryArgs<TArgs>
	) => Promise<TResult>;
}

export const internalQuery = <TArgs extends QueryArgsShape, TResult>(
	definition: InternalQueryDefinition<TArgs, TResult>
): InternalQueryDefinition<TArgs, TResult> => definition;

export interface InternalMutationDefinition<
	TArgs extends QueryArgsShape,
	TResult,
> {
	args: TArgs;
	handler: (
		ctx: InternalMutationContext,
		args: InferQueryArgs<TArgs>
	) => Promise<TResult>;
}

export const internalMutation = <TArgs extends QueryArgsShape, TResult>(
	definition: InternalMutationDefinition<TArgs, TResult>
): InternalMutationDefinition<TArgs, TResult> => definition;
`;
