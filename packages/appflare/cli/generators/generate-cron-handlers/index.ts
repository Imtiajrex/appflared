import { buildImportSection } from "../generate-hono-server/imports";
import type { DiscoveredHandler } from "../../utils/utils";
import {
	schemaTypesImportPath,
	serverImportPath,
	filePreamble,
} from "../generate-scheduler-handlers/constants";
import { buildCronHandlerEntries } from "./handler-entries";
import { buildCronHandlersBlock } from "./cron-handlers-block";
import { buildTypeHelpersBlock } from "./type-helpers-block";
import { buildRuntimeBlock } from "./runtime-block";

export function generateCronHandlers(params: {
	handlers: DiscoveredHandler[];
	outDirAbs: string;
	schemaPathAbs: string;
	configPathAbs: string;
}): { code: string; cronTriggers: string[] } {
	const cronHandlers = params.handlers.filter(
		(handler) => handler.kind === "cron",
	);

	const imports = buildImportSection({
		handlers: cronHandlers,
		outDirAbs: params.outDirAbs,
		schemaPathAbs: params.schemaPathAbs,
		configPathAbs: params.configPathAbs,
	});

	const handlerImportBlock =
		imports.handlerImports.length > 0
			? `${imports.handlerImports.join("\n")}\n\n`
			: "";

	const handlerEntries = buildCronHandlerEntries({
		handlers: cronHandlers,
		localNameFor: imports.localNameFor,
	});

	const importsBlock = `import { createAppflareDbContext, type AppflareDbContext } from ${JSON.stringify(serverImportPath)};\nimport type {\n\tScheduler,\n\tSchedulerEnqueueOptions,\n\tSchedulerPayload,\n\tSchedulerTaskName,\n\tAppflareAuthContext,\n\tAppflareAuthSession,\n\tAppflareAuthUser,\n} from ${JSON.stringify(schemaTypesImportPath)};\nimport { createScheduler } from "./scheduler";\n${handlerImportBlock}`;

	const code = [
		filePreamble,
		"",
		importsBlock,
		buildCronHandlersBlock(handlerEntries),
		buildTypeHelpersBlock(),
		buildRuntimeBlock(),
		"export type { CronTaskName };\n",
	].join("\n");

	const cronTriggers = Array.from(
		new Set(
			cronHandlers
				.flatMap((handler) => handler.cronTriggers ?? [])
				.filter((value): value is string => Boolean(value)),
		),
	);

	return { code, cronTriggers };
}
