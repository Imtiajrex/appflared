import type { BetterAuthOptions } from "better-auth";

const authOptions: Partial<BetterAuthOptions> = {
	// Supply your Better Auth adapter, providers, and session settings here.
};

export default {
	dir: "./",
	schema: "./schema.ts",
	outDir: "./_generated",
	auth: {
		enabled: false,
		basePath: "/auth",
		options: authOptions,
	},
};
