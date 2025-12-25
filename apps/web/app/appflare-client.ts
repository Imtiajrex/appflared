"use client";

import { createAppflareApi } from "appflare-config/_generated/src/api";

const BASE_URL =
	process.env.NEXT_PUBLIC_APPFLARE_BASE_URL ?? "http://localhost:8787";
const REALTIME_URL =
	process.env.NEXT_PUBLIC_APPFLARE_REALTIME_URL ?? "ws://localhost:8787";
const AUTH_URL = process.env.NEXT_PUBLIC_APPFLARE_AUTH_URL ?? BASE_URL;

export const api = createAppflareApi({
	baseUrl: BASE_URL,
	realtime: {
		baseUrl: REALTIME_URL,
	},
	auth: {
		baseURL: AUTH_URL,
		fetchOptions: {
			onSuccess: async (ctx) => {
				const authToken = ctx.response.headers.get("set-auth-token"); // get the token from the response headers
				// Store the token securely (e.g., in localStorage)
				if (authToken) {
					localStorage.setItem("bearer_token", authToken);
				}
			},
			onRequest: async (ctx) => {
				// Retrieve the token from secure storage
				const authToken = localStorage.getItem("bearer_token");
				if (authToken) {
					ctx.headers.set("Authorization", `Bearer ${authToken}`);
				}
			},
		},
	},
});

export const appflareEndpoints = {
	baseUrl: BASE_URL,
	realtimeUrl: REALTIME_URL,
	authUrl: AUTH_URL,
};
