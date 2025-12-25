import { useEffect, useRef } from "react";
import { QueryKey } from "@tanstack/react-query";

export type RealtimeMessage<TResult> = {
	type?: string;
	data?: TResult[];
	[key: string]: unknown;
};

export type HandlerWebsocketOptions<TResult> = {
	baseUrl?: string;
	table?: string;
	handler?: { file: string; name: string };
	handlerFile?: string;
	handlerName?: string;
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

type RealtimeOptions<TResult> = {
	enabled: boolean;
	options: RealtimeHookOptions<TResult>;
};

type RealtimeSubscriptionParams<TArgs, TResult> = {
	handler: HandlerWithRealtime<TArgs, TResult>;
	args?: TArgs;
	realtime?: boolean | RealtimeHookOptions<TResult>;
	finalQueryKey: QueryKey;
	deps?: unknown[];
	applyIncoming: (
		data: TResult[] | undefined,
		message: RealtimeMessage<TResult> | undefined
	) => void;
};

export function stableSerialize(value: unknown): string {
	try {
		return JSON.stringify(value) ?? "";
	} catch {
		return String(value);
	}
}

export function buildQueryKey(
	queryKey: QueryKey | undefined,
	handler: { path?: string },
	argsKey: string
): QueryKey {
	return queryKey ?? [handler?.path ?? "appflare-handler", argsKey];
}

export function useRealtimeSubscription<TArgs, TResult>(
	params: RealtimeSubscriptionParams<TArgs, TResult>
): WebSocket | null {
	const { handler, args, realtime, finalQueryKey, deps, applyIncoming } =
		params;
	const depsArray = deps;
	const websocketRef = useRef<WebSocket | null>(null);

	// Track latest realtime options so callbacks stay fresh without forcing reconnects.
	const latestRealtimeOptionsRef = useRef<
		RealtimeHookOptions<TResult> | undefined
	>();
	const realtimeKey = buildRealtimeKey(realtime);
	const parsedRealtime = parseRealtimeOptions<TResult>(realtime);
	latestRealtimeOptionsRef.current = parsedRealtime.options;

	useEffect(() => {
		const hasWebsocket = typeof handler.websocket === "function";
		const { enabled, options } = parsedRealtime;

		if (!enabled || !hasWebsocket) {
			return undefined;
		}

		const socket = handler.websocket!(args, {
			...options,
			onData: (data, message) => {
				latestRealtimeOptionsRef.current?.onData?.(data, message);
				if (options.replaceData === false) return;
				applyIncoming(data, message);
			},
			onMessage: (message, raw) => {
				latestRealtimeOptionsRef.current?.onMessage?.(message, raw);
				if (
					options.replaceData === false ||
					!message ||
					message.type !== "data" ||
					!Array.isArray((message as any).data)
				) {
					return;
				}
				applyIncoming((message as any).data, message as any);
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
	}, [handler, finalQueryKey, realtimeKey, applyIncoming, ...depsArray]);

	return websocketRef.current;
}

function parseRealtimeOptions<TResult>(
	realtime?: boolean | RealtimeHookOptions<TResult>
): RealtimeOptions<TResult> {
	const options =
		typeof realtime === "object"
			? (realtime as RealtimeHookOptions<TResult>)
			: ({} as RealtimeHookOptions<TResult>);

	const enabled =
		realtime === true ||
		(typeof realtime === "object" && options.enabled !== false);

	return { enabled, options };
}

function buildRealtimeKey<TResult>(
	realtime?: boolean | RealtimeHookOptions<TResult>
): string {
	if (realtime === true) return "true";
	if (!realtime) return "false";
	const {
		onOpen,
		onClose,
		onError,
		onMessage,
		onData,
		websocketImpl,
		signal,
		...rest
	} = realtime;
	return stableSerialize(rest);
}
