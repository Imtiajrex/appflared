import type { AppflareConfig } from "../../utils/utils";
import {
	DEFAULT_SCHEDULER_QUEUE_BINDING,
	resolveAllowedOrigins,
	sanitizeWorkerName,
	toBucketName,
	toQueueName,
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

	const schedulerEnabled = params.config.scheduler?.enabled !== false;
	const schedulerQueueBinding =
		params.config.scheduler?.queueBinding ?? DEFAULT_SCHEDULER_QUEUE_BINDING;
	const schedulerQueueName = params.config.scheduler?.queueName
		? toQueueName(params.config.scheduler.queueName)
		: `${toQueueName(sanitizeWorkerName(params.configDirAbs))}-scheduler`;

	const workerMain = params.config.wranglerMain ?? "./server/index.ts";

	const wrangler: Record<string, unknown> = {
		$schema: "node_modules/wrangler/config-schema.json",
		name: sanitizeWorkerName(params.configDirAbs),
		main: workerMain,
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

	if (schedulerEnabled) {
		wrangler.queues = {
			producers: [
				{
					binding: schedulerQueueBinding,
					queue: schedulerQueueName,
				},
			],
			consumers: [
				{
					queue: schedulerQueueName,
				},
			],
		};
	}

	return `${JSON.stringify(wrangler, null, 2)}\n`;
}
