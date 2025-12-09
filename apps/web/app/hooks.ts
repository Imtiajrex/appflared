"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Status = "active" | "inactive";

export type UserQueryParams = {
	userId?: string;
	minAge?: number;
	maxAge?: number;
	status?: Status;
};

export type UseUserQueryResult<T = unknown[]> = {
	data: T | null;
	loading: boolean;
	error?: string;
};

const DEFAULT_API_BASE =
	process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787";

export function useUserQuery(
	query: UserQueryParams,
	options?: { apiBase?: string }
): UseUserQueryResult {
	const apiBase = options?.apiBase ?? DEFAULT_API_BASE;
	const [data, setData] = useState<unknown[] | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | undefined>();
	const socketRef = useRef<WebSocket | null>(null);

	const searchParams = useMemo(() => {
		const params = new URLSearchParams();
		if (query.userId) params.set("userId", query.userId);
		if (query.minAge !== undefined) params.set("minAge", String(query.minAge));
		if (query.maxAge !== undefined) params.set("maxAge", String(query.maxAge));
		if (query.status) params.set("status", query.status);
		return params;
	}, [query.userId, query.minAge, query.maxAge, query.status]);

	useEffect(() => {
		let cancelled = false;

		const fetchInitial = async () => {
			setLoading(true);
			try {
				const url = new URL("/queries/getQuery", apiBase);
				url.search = searchParams.toString();

				const res = await fetch(url.toString());
				if (!res.ok) {
					throw new Error(`HTTP ${res.status}`);
				}

				const json = (await res.json()) as unknown[];
				if (!cancelled) {
					setData(json);
				}
			} catch (err) {
				if (!cancelled) {
					setError(err instanceof Error ? err.message : "Unknown error");
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		};

		const connectWebSocket = () => {
			const wsBase = apiBase.replace(/^http/, "ws");
			const wsUrl = new URL("/ws", wsBase);
			wsUrl.search = searchParams.toString();

			const socket = new WebSocket(wsUrl);
			socketRef.current = socket;

			socket.addEventListener("message", (event) => {
				try {
					const payload = JSON.parse(event.data as string);
					if (payload?.type === "data" && Array.isArray(payload.data)) {
						setData(payload.data);
					}
				} catch (parseErr) {
					console.error("Failed to parse websocket payload", parseErr);
				}
			});

			socket.addEventListener("error", () => {
				setError("WebSocket error");
			});

			socket.addEventListener("close", () => {
				socketRef.current = null;
			});
		};

		fetchInitial();
		connectWebSocket();

		return () => {
			cancelled = true;
			socketRef.current?.close();
		};
	}, [apiBase, searchParams]);

	return { data, loading, error };
}
