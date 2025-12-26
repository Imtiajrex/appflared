import { buildImportSection } from "../generate-hono-server/imports";
import type { DiscoveredHandler } from "../../utils/utils";
import {
	schemaTypesImportPath,
	serverImportPath,
	filePreamble,
} from "./constants";
import { buildHandlerEntries } from "./handler-entries";
import { buildSchedulerHandlersBlock } from "./scheduler-handlers-block";
import { buildTypeHelpersBlock } from "./type-helpers-block";
import { buildRuntimeBlock } from "./runtime-block";

export function generateSchedulerHandlers(params: {
	handlers: DiscoveredHandler[];
	outDirAbs: string;
	schemaPathAbs: string;
	configPathAbs: string;
}): string {
	const schedulerHandlers = params.handlers.filter(
		(handler) => handler.kind === "scheduler"
	);

	const imports = buildImportSection({
		handlers: schedulerHandlers,
		outDirAbs: params.outDirAbs,
		schemaPathAbs: params.schemaPathAbs,
		configPathAbs: params.configPathAbs,
	});

	const handlerImportBlock =
		imports.handlerImports.length > 0
			? `${imports.handlerImports.join("\n")}\n\n`
			: "";

	const handlerEntries = buildHandlerEntries({
		handlers: schedulerHandlers,
		localNameFor: imports.localNameFor,
	});

	const importsBlock = `import { createAppflareDbContext, type AppflareDbContext } from ${JSON.stringify(serverImportPath)};\nimport type {\n\tScheduler,\n\tSchedulerEnqueueOptions,\n\tAppflareAuthContext,\n\tAppflareAuthSession,\n\tAppflareAuthUser,\n} from ${JSON.stringify(schemaTypesImportPath)};\nimport { getDatabase } from "cloudflare-do-mongo";\nimport { Db } from "mongodb";\n${handlerImportBlock}`;

	return [
		filePreamble,
		"",
		importsBlock,
		buildSchedulerHandlersBlock(handlerEntries),
		buildTypeHelpersBlock(),
		buildRuntimeBlock(),
		"export type { SchedulerTaskName };\n",
	].join("\n");
}
