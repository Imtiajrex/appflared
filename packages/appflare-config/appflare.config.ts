import type { BetterAuthOptions } from "better-auth";
import { bearer } from "better-auth/plugins";

const authOptions: Partial<BetterAuthOptions> = {
	trustedOrigins: ["http://localhost:3000"],
	emailAndPassword: {
		enabled: true,
	},
	plugins: [bearer()],
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
