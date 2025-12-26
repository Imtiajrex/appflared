import { promises as fs } from "node:fs";
import path from "node:path";

const resolveHandlersDir = (outDirAbs: string): string =>
	path.join(outDirAbs, "src", "handlers");

export const ensureHandlersDir = async (outDirAbs: string): Promise<string> => {
	const handlersDir = resolveHandlersDir(outDirAbs);
	await fs.mkdir(handlersDir, { recursive: true });
	return handlersDir;
};

export const removeExistingHandlerFiles = async (
	handlersDir: string
): Promise<void> => {
	const existing = await fs.readdir(handlersDir).catch(() => [] as string[]);
	await Promise.all(
		existing
			.filter((name) => name.endsWith(".ts"))
			.map((name) =>
				fs.unlink(path.join(handlersDir, name)).catch(() => void 0)
			)
	);
};
