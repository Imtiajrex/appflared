import path from "node:path";

export const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:3000"];

export const DEFAULT_SCHEDULER_QUEUE_BINDING = "APPFLARE_SCHEDULER_QUEUE";

export const resolveAllowedOrigins = (origins?: string[]): string[] =>
	origins && origins.length > 0 ? origins : DEFAULT_ALLOWED_ORIGINS;

export const sanitizeWorkerName = (configDirAbs: string): string => {
	const base = path.basename(configDirAbs);
	const slug = base.replace(/[^A-Za-z0-9_-]/g, "-").toLowerCase();
	return slug || "appflare-worker";
};

export const toBucketName = (binding: string): string =>
	binding.toLowerCase().replace(/_/g, "-") || "appflare-storage";

export const toQueueName = (base: string): string =>
	base
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, "-")
		.replace(/--+/g, "-")
		.replace(/^-+|-+$/g, "") || "appflare-scheduler";
