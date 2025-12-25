import { useCallback, useMemo } from "react";
import {
	InfiniteData,
	QueryKey,
	UseInfiniteQueryOptions,
	UseInfiniteQueryResult,
	useInfiniteQuery as useNativeInfiniteQuery,
	useQueryClient,
} from "@tanstack/react-query";
import {
	HandlerWithRealtime,
	RealtimeHookOptions,
	RealtimeMessage,
	buildQueryKey,
	stableSerialize,
	useRealtimeSubscription,
} from "../shared/queryShared";

export type PaginatedResult<TResult, TCursor = unknown> = {
	items: TResult[];
	nextCursor?: TCursor | null;
	prevCursor?: TCursor | null;
};

export type UseAppflarePaginatedQueryOptions<
	TArgs,
	TResult,
	TCursor = unknown,
	TError = unknown,
> = {
	handler: HandlerWithRealtime<TArgs, PaginatedResult<TResult, TCursor>>;
	args?: TArgs;
	queryKey?: QueryKey;
	pageParamKey?: string;
	initialPageParam?: TCursor;
	getNextPageParam?: (
		lastPage: PaginatedResult<TResult, TCursor>,
		pages: PaginatedResult<TResult, TCursor>[]
	) => TCursor | undefined;
	getPreviousPageParam?: (
		firstPage: PaginatedResult<TResult, TCursor>,
		pages: PaginatedResult<TResult, TCursor>[]
	) => TCursor | undefined;
	queryOptions?: Omit<
		UseInfiniteQueryOptions<
			PaginatedResult<TResult, TCursor>,
			TError,
			InfiniteData<PaginatedResult<TResult, TCursor>, TCursor>,
			QueryKey,
			TCursor
		>,
		| "queryKey"
		| "queryFn"
		| "initialPageParam"
		| "getNextPageParam"
		| "getPreviousPageParam"
	>;
	realtime?: boolean | RealtimeHookOptions<PaginatedResult<TResult, TCursor>>;
};

export type UseAppflarePaginatedQueryResult<
	TResult,
	TCursor = unknown,
	TError = unknown,
> = UseInfiniteQueryResult<
	InfiniteData<PaginatedResult<TResult, TCursor>, TCursor>,
	TError
> & {
	websocket: WebSocket | null;
};

export function usePaginatedQuery<
	TArgs,
	TResult,
	TCursor = unknown,
	TError = unknown,
>(
	options: UseAppflarePaginatedQueryOptions<TArgs, TResult, TCursor, TError>
): UseAppflarePaginatedQueryResult<TResult, TCursor, TError>;

export function usePaginatedQuery<
	TArgs,
	TResult,
	TCursor = unknown,
	TError = unknown,
>(
	handler: HandlerWithRealtime<TArgs, PaginatedResult<TResult, TCursor>>,
	options?: Omit<
		UseAppflarePaginatedQueryOptions<TArgs, TResult, TCursor, TError>,
		"handler"
	>
): UseAppflarePaginatedQueryResult<TResult, TCursor, TError>;

export function usePaginatedQuery<
	TArgs,
	TResult,
	TCursor = unknown,
	TError = unknown,
>(
	optionsOrHandler:
		| UseAppflarePaginatedQueryOptions<TArgs, TResult, TCursor, TError>
		| HandlerWithRealtime<TArgs, PaginatedResult<TResult, TCursor>>,
	options?: Omit<
		UseAppflarePaginatedQueryOptions<TArgs, TResult, TCursor, TError>,
		"handler"
	>
): UseAppflarePaginatedQueryResult<TResult, TCursor, TError> {
	const normalizedOptions = useMemo(
		() =>
			typeof optionsOrHandler === "function"
				? ({
						handler: optionsOrHandler,
						...(options ?? {}),
					} as UseAppflarePaginatedQueryOptions<
						TArgs,
						TResult,
						TCursor,
						TError
					>)
				: optionsOrHandler,
		[optionsOrHandler, options]
	);

	const realtime = normalizedOptions.realtime;
	const handler = normalizedOptions.handler;
	const args = normalizedOptions.args;
	const queryKey = normalizedOptions.queryKey;
	const queryOptions = normalizedOptions.queryOptions;

	const pageParamKey = normalizedOptions.pageParamKey ?? "cursor";
	const initialPageParam = normalizedOptions.initialPageParam;
	const getNextPageParam = normalizedOptions.getNextPageParam;
	const getPreviousPageParam = normalizedOptions.getPreviousPageParam;

	const queryClient = useQueryClient();
	const argsKey = useMemo(() => stableSerialize(args), [args]);
	const finalQueryKey = useMemo<QueryKey>(
		() => buildQueryKey(queryKey, handler, argsKey),
		[queryKey, handler, argsKey]
	);

	const infiniteQuery = useNativeInfiniteQuery<
		PaginatedResult<TResult, TCursor>,
		TError,
		InfiniteData<PaginatedResult<TResult, TCursor>, TCursor>,
		QueryKey,
		TCursor
	>({
		queryKey: finalQueryKey,
		initialPageParam: initialPageParam as TCursor,
		getNextPageParam:
			getNextPageParam ?? ((lastPage) => lastPage?.nextCursor ?? undefined),
		getPreviousPageParam:
			getPreviousPageParam ??
			((firstPage) => firstPage?.prevCursor ?? undefined),
		queryFn: ({ pageParam }) =>
			handler(mergeArgsWithPageParam(args, pageParam as TCursor, pageParamKey)),
		...(queryOptions ?? {}),
	});

	const handleIncomingPage = useCallback(
		(
			data?:
				| PaginatedResult<TResult, TCursor>[]
				| PaginatedResult<TResult, TCursor>
				| null,
			_message?: RealtimeMessage<PaginatedResult<TResult, TCursor>>
		) => {
			const nextFirstPage = Array.isArray(data) ? data[0] : undefined;
			if (!nextFirstPage) return;
			queryClient.setQueryData<
				InfiniteData<PaginatedResult<TResult, TCursor>, TCursor>
			>(finalQueryKey, (prev) =>
				prev
					? {
							...prev,
							pages: prev.pages.map((page, index) =>
								index === 0 ? nextFirstPage : page
							),
						}
					: prev
			);
		},
		[finalQueryKey, queryClient]
	);
	const deps = useMemo(() => [argsKey], [argsKey]);

	const websocket = useRealtimeSubscription({
		handler,
		args,
		realtime,
		finalQueryKey,
		deps,
		applyIncoming: handleIncomingPage,
	});

	return { ...infiniteQuery, websocket };
}

function mergeArgsWithPageParam<TArgs, TPageParam>(
	args: TArgs | undefined,
	pageParam: TPageParam,
	pageParamKey?: string
): TArgs {
	if (!pageParamKey) return (args ?? (pageParam as unknown as TArgs)) as TArgs;
	if (typeof args === "object" && args !== null) {
		return { ...(args as any), [pageParamKey]: pageParam } as TArgs;
	}
	if (args === undefined) {
		return { [pageParamKey]: pageParam } as unknown as TArgs;
	}
	return args as TArgs;
}
