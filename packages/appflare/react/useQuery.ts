import { useEffect, useMemo, useRef } from "react";
import {
	QueryKey,
	UseQueryOptions,
	UseQueryResult,
	useQuery as useNativeQuery,
	useQueryClient,
} from "@tanstack/react-query";

export type RealtimeMessage<TResult> = {
	type?: string;
	data?: TResult[];
	[key: string]: unknown;
};

export type HandlerWebsocketOptions<TResult> = {
	baseUrl?: string;
	table?: string;
	where?: Record<string, unknown>;
	orderBy?: Record<string, unknown>;
	take?: number;
	skip?: number;
	path?: string;
	protocols?: string | string[];
	signal?: AbortSignal;
	websocketImpl?: (url: string, protocols?: string | string[]) => WebSocket;
	onOpen?: (event: any) => void;
	onClose?: (event: any) => void;
	onError?: (event: any) => void;
	onMessage?: (message: RealtimeMessage<TResult>, raw: any) => void;
	onData?: (data: TResult[], message: RealtimeMessage<TResult>) => void;
};

export type HandlerWithRealtime<TArgs, TResult> = {
	(args: TArgs, init?: RequestInit): Promise<TResult>;
	websocket?: (
		args?: TArgs,
		options?: HandlerWebsocketOptions<TResult>
	) => WebSocket;
	schema?: unknown;
	path?: string;
};

export type RealtimeHookOptions<TResult> = HandlerWebsocketOptions<TResult> & {
	enabled?: boolean;
	replaceData?: boolean;
};

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
	const normalizedOptions =
		typeof optionsOrHandler === "function"
			? ({
					handler: optionsOrHandler,
					...(options ?? {}),
				} as UseAppflareQueryOptions<TArgs, TResult, TError>)
			: optionsOrHandler;

	const { handler, args, queryOptions, realtime, queryKey } = normalizedOptions;
	const queryClient = useQueryClient();
	const argsKey = useMemo(() => stableSerialize(args), [args]);
	const finalQueryKey = useMemo<QueryKey>(
		() => queryKey ?? [handler?.path ?? "appflare-handler", argsKey],
		[queryKey, handler, argsKey]
	);

	const websocketRef = useRef<WebSocket | null>(null);

	const query = useNativeQuery<TResult, TError>({
		queryKey: finalQueryKey,
		queryFn: () => handler(args),
		...(queryOptions ?? {}),
	});

	useEffect(() => {
		const hasWebsocket = typeof handler.websocket === "function";
		const realtimeOptions =
			typeof realtime === "object"
				? (realtime as RealtimeHookOptions<TResult>)
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
				queryClient.setQueryData(
					finalQueryKey,
					() => data as unknown as TResult
				);
			},
			onMessage: (message, raw) => {
				realtimeOptions.onMessage?.(message, raw);
				if (
					realtimeOptions.replaceData === false ||
					!message ||
					message.type !== "data" ||
					!Array.isArray((message as any).data)
				) {
					return;
				}
				queryClient.setQueryData(
					finalQueryKey,
					() => (message as any).data as unknown as TResult
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

	return { ...query, websocket: websocketRef.current };
}

function stableSerialize(value: unknown): string {
	try {
		return JSON.stringify(value) ?? "";
	} catch {
		return String(value);
	}
}
