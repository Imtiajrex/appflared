import type { BetterAuthOptions } from "better-auth";
import { bearer } from "better-auth/plugins";
import type { StorageRule } from "appflare/server/storage";
import type { AppflareConfig } from "appflare";

const authOptions: Partial<BetterAuthOptions> = {
	trustedOrigins: ["http://localhost:3000"],
	emailAndPassword: {
		enabled: true,
	},
	plugins: [bearer()],
};

const storageRules: StorageRule[] = [
	{
		route: "/readonly",
		methods: ["GET", "HEAD"],
		cacheControl: "public, max-age=300",
	},
	{
		route: "/readonly",
		methods: ["PUT", "POST", "DELETE"],
		authorize: () => ({
			allow: false,
			status: 405,
			message: "Read-only bucket",
		}),
	},
	{
		route: "/readonly/*",
		methods: ["GET", "HEAD"],
		cacheControl: "public, max-age=300",
	},
	{
		route: "/readonly/*",
		methods: ["PUT", "POST", "DELETE"],
		authorize: () => ({
			allow: false,
			status: 405,
			message: "Read-only bucket",
		}),
	},
	{
		route: "/json/*",
		contentType: () => "application/json",
	},
	{
		route: "/uploads/*",
		maxSizeBytes: 512 * 1024,
	},
	{
		route: "/users/:userId/*",
		authorize: ({ params, c }) => {
			const userId = params.userId;
			const headerUser = c.req.header("x-user-id");
			if (headerUser && headerUser === userId) {
				return { allow: true, principal: headerUser };
			}
			return {
				allow: false,
				status: 401,
				message: "x-user-id header required for user bucket",
			};
		},
		deriveKey: ({ params, wildcard }) =>
			`${params.userId}/${wildcard || "root"}`,
		cacheControl: "private, max-age=0, must-revalidate",
	},
	{
		// catch-all fallback must be last so more specific rules win
		route: "/*",
	},
];

const storage = {
	basePath: "/storage",
	bucketBinding: "APPFLARE_STORAGE",
	rules: storageRules,
};

export default {
	dir: "./",
	schema: "./schema.ts",
	outDir: "./_generated",
	storage,
	auth: {
		enabled: true,
		basePath: "/api/auth",
		options: authOptions,
	},
	wranglerOutPath: "../../apps/backend/wrangler.json",
	wrangler: {
		name: "testers",
		main: "./src/index.ts",
		compatibilityDate: "2025-12-10",
	},
} as AppflareConfig;
