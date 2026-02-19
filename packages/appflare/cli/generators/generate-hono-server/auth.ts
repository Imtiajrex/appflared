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
		? `import { getSanitizedRequest, initBetterAuth } from "appflare/server/auth";`
		: "";

	const authSetup = hasAuth
		? [
				`const __appflareAuthConfig = (appflareConfig as any).auth;`,
				`const __appflareAuthBasePath = __appflareAuthConfig?.basePath ?? "/auth";`,
				`const __appflareStorageConfig = (appflareConfig as any).storage;`,
				`const __appflareDatabaseConfig = (appflareConfig as any).database;`,
				`const __appflareKvBinding = __appflareStorageConfig?.kvBinding;`,
				`const __appflareD1Binding = __appflareDatabaseConfig?.d1Binding ?? "DB";`,
				`const resolveAppflareAuth = (c: HonoContext) => {`,
				`\tif (`,
				`\t\t!__appflareAuthConfig ||`,
				`\t\t__appflareAuthConfig.enabled === false ||`,
				`\t\t!__appflareAuthConfig.options`,
				`\t) {`,
				`\t\treturn undefined;`,
				`\t}`,
				`\tconst envObject = (c as any)?.env as Record<string, unknown> | undefined;`,
				`\tconst db = envObject?.[__appflareD1Binding];`,
				`\tconst options = { ...__appflareAuthConfig.options, database: db } as any;`,
				`\treturn initBetterAuth(options, {`,
				`\t\tenv: envObject,`,
				`\t\tkvBinding: __appflareKvBinding,`,
				`\t});`,
				`};`,
			].join("\n")
		: "";

	const authMount = hasAuth
		? `\n\tapp.all(__appflareAuthBasePath + "/*", async (c) => {\n\t\tconst auth = resolveAppflareAuth(c);\n\t\tif (!auth) return c.json({ error: "Authentication disabled" }, 404);\n\t\treturn auth.handler(getSanitizedRequest(c.req.raw));\n\t});\n\tapp.all(__appflareAuthBasePath, async (c) => {\n\t\tconst auth = resolveAppflareAuth(c);\n\t\tif (!auth) return c.json({ error: "Authentication disabled" }, 404);\n\t\treturn auth.handler(getSanitizedRequest(c.req.raw));\n\t});\n`
		: "";

	const authResolver = hasAuth
		? [
				`const resolveAuthContext = async (`,
				`\tc: HonoContext`,
				`): Promise<AppflareAuthContext> => {`,
				`\tconst createUnauthContext = (): AppflareAuthContext => {`,
				`\t\tconst authContext: AppflareAuthContext = {`,
				`\t\t\tsession: null as AppflareAuthSession,`,
				`\t\t\tuser: null as AppflareAuthUser,`,
				`\t\t};`,
				`\t\tc.set("appflareSession", authContext.session);`,
				`\t\tc.set("appflareUser", authContext.user);`,
				`\t\treturn authContext;`,
				`\t};`,
				`\tlet __appflareAuth: ReturnType<typeof resolveAppflareAuth>;`,
				`\ttry {`,
				`\t\t__appflareAuth = resolveAppflareAuth(c);`,
				`\t} catch (err) {`,
				`\t\tconsole.error("Appflare auth initialization failed", err);`,
				`\t\treturn createUnauthContext();`,
				`\t}`,
				`\tif (!__appflareAuth) {`,
				`\t\treturn createUnauthContext();`,
				`\t}`,
				``,
				`\ttry {`,
				`\t\tconst sessionResult = await __appflareAuth.api.getSession(`,
				`\t\t(c.req.raw)`,
				`\t\t);`,
				`\t\tconst authContext: AppflareAuthContext = {`,
				`\t\t\tsession:`,
				`\t\t\t\t(sessionResult as any)?.session ??`,
				`\t\t\t\t(sessionResult as any) ??`,
				`\t\t\t\t(null as AppflareAuthSession),`,
				`\t\t\tuser: (sessionResult as any)?.user ?? (null as AppflareAuthUser),`,
				`\t\t};`,
				`\t\tc.set("appflareSession", authContext.session);`,
				`\t\tc.set("appflareUser", authContext.user);`,
				`\t\treturn authContext;`,
				`\t} catch (err) {`,
				`\t\tconsole.error("Appflare auth session resolution failed", err);`,
				`\t\treturn createUnauthContext();`,
				`\t}`,
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
