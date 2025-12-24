import { useEffect, useMemo, useRef } from "react";
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
} from "./useQuery";

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
	const normalizedOptions =
		typeof optionsOrHandler === "function"
			? ({
					handler: optionsOrHandler,
					...(options ?? {}),
				} as UseAppflarePaginatedQueryOptions<TArgs, TResult, TCursor, TError>)
			: optionsOrHandler;

	const {
		handler,
		args,
		queryKey,
		pageParamKey = "cursor",
		initialPageParam,
		getNextPageParam,
		getPreviousPageParam,
		queryOptions,
		realtime,
	} = normalizedOptions;

	const queryClient = useQueryClient();
	const websocketRef = useRef<WebSocket | null>(null);
	const argsKey = useMemo(() => stableSerialize(args), [args]);
	const finalQueryKey = useMemo<QueryKey>(
		() => queryKey ?? [handler?.path ?? "appflare-handler", argsKey],
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

	useEffect(() => {
		const hasWebsocket = typeof handler.websocket === "function";
		const realtimeOptions =
			typeof realtime === "object"
				? (realtime as RealtimeHookOptions<PaginatedResult<TResult, TCursor>>)
				: {};
		const enabled =
			realtime === true ||
			(typeof realtime === "object" && realtimeOptions.enabled !== false);

		if (!enabled || !hasWebsocket) {
			return undefined;
		}

		const socket = handler.websocket!(args, {
			...realtimeOptions,
			onData: (data, message) => {
				realtimeOptions.onData?.(data, message);
				if (realtimeOptions.replaceData === false) return;
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
			onMessage: (
				message: RealtimeMessage<PaginatedResult<TResult, TCursor>>,
				raw: any
			) => {
				realtimeOptions.onMessage?.(message, raw);
				if (
					realtimeOptions.replaceData === false ||
					!message ||
					message.type !== "data" ||
					!Array.isArray((message as any).data)
				) {
					return;
				}
				const nextFirstPage = (message as any).data[0] as
					| PaginatedResult<TResult, TCursor>
					| undefined;
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
		});

		websocketRef.current = socket;

		return () => {
			try {
				socket.close(1000, "cleanup");
			} catch {
				// ignore
			}
		};
	}, [args, finalQueryKey, handler, queryClient, realtime]);

	return { ...infiniteQuery, websocket: websocketRef.current };
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

function stableSerialize(value: unknown): string {
	try {
		return JSON.stringify(value) ?? "";
	} catch {
		return String(value);
	}
}
