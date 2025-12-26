import type { AppflareConfig } from "../../utils/utils";

export type WebsocketDoAuthSection = {
	importLine: string;
	setupBlock: string;
};

export function buildAuthSection(
	config: AppflareConfig
): WebsocketDoAuthSection {
	const hasAuth = Boolean(config.auth && config.auth.enabled !== false);

	const importLine = hasAuth
		? 'import { initBetterAuth } from "appflare/server/auth";'
		: "";

	const setupBlock = hasAuth
		? [
				"const __appflareAuthConfig = (appflareConfig as any).auth;",
				"const __appflareAuth =",
				"\t__appflareAuthConfig &&",
				"\t__appflareAuthConfig.enabled !== false &&",
				"\t__appflareAuthConfig.options",
				"\t\t? initBetterAuth(__appflareAuthConfig.options as any)",
				"\t\t: undefined;",
			].join("\n")
		: "const __appflareAuth = undefined;";

	return { importLine, setupBlock };
}
