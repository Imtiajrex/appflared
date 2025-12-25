"use client";

import { createAppflareApi } from "appflare-config/_generated/src/api";

const BASE_URL =
	process.env.NEXT_PUBLIC_APPFLARE_BASE_URL ?? "http://localhost:8787";
const REALTIME_URL =
	process.env.NEXT_PUBLIC_APPFLARE_REALTIME_URL ?? "ws://localhost:8787";
const AUTH_URL = process.env.NEXT_PUBLIC_APPFLARE_AUTH_URL ?? BASE_URL;
const AUTH_TOKEN_STORAGE_KEY = "bearer_token";
const isBrowser = typeof window !== "undefined";

let cachedAuthToken: string | null = null;

const getStoredAuthToken = (): string | null => {
	if (cachedAuthToken) return cachedAuthToken;
	if (!isBrowser) return null;
	const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
	cachedAuthToken = token;
	return token;
};

const setStoredAuthToken = (token: string | null) => {
	cachedAuthToken = token;
	if (!isBrowser) return;
	if (token) {
		localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
		return;
	}
	localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
};

const ENV_AUTH_TOKEN = process.env.NEXT_PUBLIC_APPFLARE_AUTH_TOKEN;
if (ENV_AUTH_TOKEN) setStoredAuthToken(ENV_AUTH_TOKEN);

const withAuthHeaders = (init?: RequestInit): RequestInit => {
	const headers = new Headers(init?.headers ?? {});
	const authToken = getStoredAuthToken();
	if (authToken) headers.set("Authorization", `Bearer ${authToken}`);
	return { ...(init ?? {}), headers };
};

export const api = createAppflareApi({
	baseUrl: BASE_URL,
	fetcher: (input, init) => fetch(input, withAuthHeaders(init)),
	realtime: {
		baseUrl: REALTIME_URL,
	},
	auth: {
		baseURL: AUTH_URL,
		fetchOptions: {
			onSuccess: async (ctx) => {
				const authToken = ctx.response.headers.get("set-auth-token");
				if (authToken) setStoredAuthToken(authToken);
			},
			onRequest: async (ctx) => {
				const authToken = getStoredAuthToken();
				if (authToken) ctx.headers.set("Authorization", `Bearer ${authToken}`);
				return ctx;
			},
		},
	},
});

export const appflareEndpoints = {
	baseUrl: BASE_URL,
	realtimeUrl: REALTIME_URL,
	authUrl: AUTH_URL,
};

export const setAuthToken = (token: string | null) => setStoredAuthToken(token);
export const getAuthToken = () => getStoredAuthToken();
