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
	cronTriggers?: string[];
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
	const compatibilityDate =
		params.config.wranglerCompatibilityDate ??
		new Date().toISOString().slice(0, 10);

	const wrangler: Record<string, unknown> = {
		$schema: "node_modules/wrangler/config-schema.json",
		name:
			params.config.wrangler?.name ?? sanitizeWorkerName(params.configDirAbs),
		main: params.config.wrangler?.main ?? workerMain,
		compatibility_date:
			params.config.wrangler?.compatibilityDate ?? compatibilityDate,
		compatibility_flags: [
			"nodejs_compat",
			"nodejs_compat_populate_process_env",
		],
		migrations: [
			{ new_sqlite_classes: ["WebSocketHibernationServer"], tag: "v1" },
		],
		durable_objects: {
			bindings: [
				{
					class_name: "WebSocketHibernationServer",
					name: "WEBSOCKET_HIBERNATION_SERVER",
				},
			],
		},
		observability: { enabled: true },
		placement: { mode: "smart" },
		vars: {
			ALLOWED_ORIGINS: allowedOrigins.join(","),
		},
		...params.config.wrangler,
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

	if (params.config.storage?.kvBinding) {
		wrangler.kv_namespaces = [
			{
				binding: params.config.storage.kvBinding,
				id: params.config.storage.kvId ?? "",
			},
		];
	}

	if (params.cronTriggers && params.cronTriggers.length > 0) {
		wrangler.triggers = {
			crons: Array.from(new Set(params.cronTriggers)),
		};
	}

	return `${JSON.stringify(wrangler, null, 2)}\n`;
}
