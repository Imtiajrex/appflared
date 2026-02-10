import type { AppflareConfig } from "appflare";
import type { StorageRule } from "appflare/server/storage";
import type { BetterAuthOptions } from "better-auth";
import { emailOTPClient } from "better-auth/client/plugins";
import { bearer, emailOTP } from "better-auth/plugins";
import {
	sendResetEmail,
	sendVerificationEmail,
	sendVerificationOtp,
} from "./emails";

const authOptions: Partial<BetterAuthOptions> = {
	trustedOrigins: ["http://localhost:3000"],
	emailAndPassword: {
		enabled: true,
		sendResetPassword: sendResetEmail,
	},
	emailVerification: {
		sendVerificationEmail: sendVerificationEmail,
		sendOnSignIn: true,
		sendOnSignUp: true,
	},
	plugins: [
		bearer(),
		emailOTP({
			sendVerificationOTP: sendVerificationOtp,
			sendVerificationOnSignUp: true,
		}),
	],
};

const storageRules: StorageRule[] = [];

const storage = {
	basePath: "/storage",
	bucketBinding: "APPFLARE_STORAGE",
	rules: storageRules,
	kvBinding: "APPFLARE_KV",
	kvId: "51ab2d7674b5490d9a34de6c14577f7e",
} as AppflareConfig["storage"];

export default {
	dir: "./",
	schema: "./schema.ts",
	outDir: "./_generated",
	storage,
	auth: {
		enabled: true,
		basePath: "/api/auth",
		options: authOptions,
		clientOptions: {
			plugins: [emailOTPClient()],
		},
	},
	wranglerOutPath: "../../apps/backend/wrangler.json",
	wrangler: {
		name: "testers",
		main: "./src/index.ts",
		compatibilityDate: "2025-12-10",
	},
};
