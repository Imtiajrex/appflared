import type { AppflareConfig } from "../../utils/utils";
import {
	resolveAllowedOrigins,
	sanitizeWorkerName,
	toBucketName,
} from "./helpers";

export function generateWranglerJson(params: {
	config: AppflareConfig;
	configDirAbs: string;
	allowedOrigins?: string[];
}): string {
	const allowedOrigins = resolveAllowedOrigins(params.allowedOrigins);
	const bucketBinding =
		params.config.storage?.bucketBinding ?? "APPFLARE_STORAGE";
	const r2Buckets = params.config.storage
		? [
				{
					binding: bucketBinding,
					bucket_name: toBucketName(bucketBinding),
				},
			]
		: undefined;

	const wrangler: Record<string, unknown> = {
		$schema: "node_modules/wrangler/config-schema.json",
		name: sanitizeWorkerName(params.configDirAbs),
		main: "./server/index.ts",
		compatibility_date: new Date().toISOString().slice(0, 10),
		compatibility_flags: [
			"nodejs_compat",
			"nodejs_compat_populate_process_env",
		],
		migrations: [
			{ new_sqlite_classes: ["WebSocketHibernationServer"], tag: "v1" },
			{ new_sqlite_classes: ["MONGO_DURABLE_OBJECT"], tag: "v2" },
		],
		durable_objects: {
			bindings: [
				{
					class_name: "WebSocketHibernationServer",
					name: "WEBSOCKET_HIBERNATION_SERVER",
				},
				{ class_name: "MONGO_DURABLE_OBJECT", name: "MONGO_DURABLE_OBJECT" },
			],
		},
		observability: { enabled: true },
		placement: { mode: "smart" },
		vars: {
			ALLOWED_ORIGINS: allowedOrigins.join(","),
		},
	};

	if (r2Buckets && r2Buckets.length > 0) {
		wrangler.r2_buckets = r2Buckets;
	}

	return `${JSON.stringify(wrangler, null, 2)}\n`;
}
