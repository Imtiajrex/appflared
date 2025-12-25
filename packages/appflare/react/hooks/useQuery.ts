import { useCallback, useMemo } from "react";
import {
	QueryKey,
	UseQueryOptions,
	UseQueryResult,
	useQuery as useNativeQuery,
	useQueryClient,
} from "@tanstack/react-query";
import {
	RealtimeHookOptions,
	RealtimeMessage,
	HandlerWithRealtime,
	HandlerWebsocketOptions,
	buildQueryKey,
	stableSerialize,
	useRealtimeSubscription,
} from "../shared/queryShared";

export type UseAppflareQueryOptions<TArgs, TResult, TError = unknown> = {
	handler: HandlerWithRealtime<TArgs, TResult>;
	args?: TArgs;
	queryKey?: QueryKey;
	queryOptions?: Omit<UseQueryOptions<TResult, TError>, "queryFn" | "queryKey">;
	realtime?: boolean | RealtimeHookOptions<TResult>;
};

export type UseAppflareQueryResult<TResult, TError = unknown> = UseQueryResult<
	TResult,
	TError
> & { websocket: WebSocket | null };

export function useQuery<TArgs, TResult, TError = unknown>(
	options: UseAppflareQueryOptions<TArgs, TResult, TError>
): UseAppflareQueryResult<TResult, TError>;

export function useQuery<TArgs, TResult, TError = unknown>(
	handler: HandlerWithRealtime<TArgs, TResult>,
	options?: Omit<UseAppflareQueryOptions<TArgs, TResult, TError>, "handler">
): UseAppflareQueryResult<TResult, TError>;

export function useQuery<TArgs, TResult, TError = unknown>(
	optionsOrHandler:
		| UseAppflareQueryOptions<TArgs, TResult, TError>
		| HandlerWithRealtime<TArgs, TResult>,
	options?: Omit<UseAppflareQueryOptions<TArgs, TResult, TError>, "handler">
): UseAppflareQueryResult<TResult, TError> {
	const normalizedOptions = useMemo(
		() =>
			typeof optionsOrHandler === "function"
				? ({
						handler: optionsOrHandler,
						...(options ?? {}),
					} as UseAppflareQueryOptions<TArgs, TResult, TError>)
				: optionsOrHandler,
		[optionsOrHandler, options]
	);

	const realtime = normalizedOptions.realtime;
	const handler = normalizedOptions.handler;
	const args = normalizedOptions.args;
	const queryKey = normalizedOptions.queryKey;
	const queryOptions = normalizedOptions.queryOptions;

	const queryClient = useQueryClient();
	const argsKey = useMemo(() => stableSerialize(args), [args]);
	const finalQueryKey = useMemo<QueryKey>(
		() => buildQueryKey(queryKey, handler, argsKey),
		[queryKey, handler, argsKey]
	);

	const query = useNativeQuery<TResult, TError>({
		queryKey: finalQueryKey,
		queryFn: () => handler(args),
		...(queryOptions ?? {}),
	});

	const handleIncomingData = useCallback(
		(
			data?: TResult[] | TResult | null,
			_message?: RealtimeMessage<TResult>
		) => {
			if (!Array.isArray(data)) return;
			queryClient.setQueryData(finalQueryKey, () => data as unknown as TResult);
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
		applyIncoming: handleIncomingData,
	});

	return { ...query, websocket };
}

export {
	RealtimeMessage,
	HandlerWebsocketOptions,
	HandlerWithRealtime,
	RealtimeHookOptions,
} from "../shared/queryShared";
