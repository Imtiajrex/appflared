import type { BetterAuthOptions } from "better-auth";

const authOptions: Partial<BetterAuthOptions> = {
	trustedOrigins: ["http://localhost:3000"],
	emailAndPassword: {
		enabled: true,
	},
};

export default {
	dir: "./",
	schema: "./schema.ts",
	outDir: "./_generated",
	auth: {
		enabled: true,
		basePath: "/api/auth",
		options: authOptions,
	},
};
