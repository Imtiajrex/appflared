import type { AppflareConfig } from "../../utils/utils";

export type AuthSection = {
	imports: string;
	setupBlock: string;
	mountBlock: string;
	resolverBlock: string;
};

const indentBlock = (block: string): string =>
	block
		.split("\n")
		.map((line) => `\t${line}`)
		.join("\n");

export function buildAuthSection(config: AppflareConfig): AuthSection {
	const hasAuth = Boolean(config.auth);

	const authImports = hasAuth
		? `import { createBetterAuthRouter, getSanitizedRequest, initBetterAuth } from "appflare/server/auth";`
		: "";

	const authSetup = hasAuth
		? [
				`const __appflareAuthConfig = (appflareConfig as any).auth;`,
				`const __appflareAuthBasePath = __appflareAuthConfig?.basePath ?? "/auth";`,
				`const __appflareAuth =`,
				`\t__appflareAuthConfig &&`,
				`\t__appflareAuthConfig.enabled !== false &&`,
				`\t__appflareAuthConfig.options`,
				`\t\t? initBetterAuth(__appflareAuthConfig.options as any)`,
				`\t\t: undefined;`,
				`const __appflareAuthRouter = __appflareAuth`,
				`\t? createBetterAuthRouter({`,
				`\t\tauth: __appflareAuth,`,
				`\t})`,
				`\t: undefined;`,
			].join("\n")
		: "";

	const authMount = hasAuth
		? `\n\tif (__appflareAuthRouter) {\n\t\tapp.route(__appflareAuthBasePath, __appflareAuthRouter);\n\t}\n`
		: "";

	const authResolver = hasAuth
		? [
				`const resolveAuthContext = async (`,
				`\tc: HonoContext`,
				`): Promise<AppflareAuthContext> => {`,
				`\tif (!__appflareAuth) {`,
				`\t\tconst authContext: AppflareAuthContext = {`,
				`\t\t\tsession: null as AppflareAuthSession,`,
				`\t\t\tuser: null as AppflareAuthUser,`,
				`\t\t};`,
				`\t\tc.set("appflareSession", authContext.session);`,
				`\t\tc.set("appflareUser", authContext.user);`,
				`\t\treturn authContext;`,
				`\t}`,
				``,
				`\tconst sessionResult = await __appflareAuth.api.getSession(`,
				`\t\tc.req.raw`,
				`\t);`,
				`\tconst authContext: AppflareAuthContext = {`,
				`\t\tsession:`,
				`\t\t\t(sessionResult as any)?.session ??`,
				`\t\t\t(sessionResult as any) ??`,
				`\t\t\t(null as AppflareAuthSession),`,
				`\t\tuser: (sessionResult as any)?.user ?? (null as AppflareAuthUser),`,
				`\t};`,
				`\tc.set("appflareSession", authContext.session);`,
				`\tc.set("appflareUser", authContext.user);`,
				`\treturn authContext;`,
				`};`,
			].join("\n")
		: [
				`const resolveAuthContext = async (`,
				`\tc: HonoContext`,
				`): Promise<AppflareAuthContext> => {`,
				`\tconst authContext: AppflareAuthContext = {`,
				`\t\tsession: null as AppflareAuthSession,`,
				`\t\tuser: null as AppflareAuthUser,`,
				`\t};`,
				`\tc.set("appflareSession", authContext.session);`,
				`\tc.set("appflareUser", authContext.user);`,
				`\treturn authContext;`,
				`};`,
			].join("\n");

	return {
		imports: authImports,
		setupBlock: authSetup ? `\n${indentBlock(authSetup)}\n` : "",
		mountBlock: authMount,
		resolverBlock: `\n${indentBlock(authResolver)}\n`,
	};
}
