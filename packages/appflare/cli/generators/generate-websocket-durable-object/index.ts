import type { AppflareConfig, DiscoveredHandler } from "../../utils/utils";
import { buildAuthSection } from "./auth";
import { buildImportSection } from "./imports";
import { buildQueryHandlerEntries } from "./query-handlers";
import { renderWebsocketDurableObjectTemplate } from "./template";

export type GenerateWebsocketDurableObjectParams = {
	handlers: DiscoveredHandler[];
	outDirAbs: string;
	schemaPathAbs: string;
	configPathAbs: string;
	config: AppflareConfig;
};

export function generateWebsocketDurableObject(
	params: GenerateWebsocketDurableObjectParams
): string {
	const queries = params.handlers.filter((handler) => handler.kind === "query");

	const imports = buildImportSection({
		queries,
		outDirAbs: params.outDirAbs,
		schemaPathAbs: params.schemaPathAbs,
		configPathAbs: params.configPathAbs,
	});

	const auth = buildAuthSection(params.config);
	const queryHandlerEntries = buildQueryHandlerEntries({
		queries,
		localNameFor: imports.localNameFor,
	});

	return renderWebsocketDurableObjectTemplate({
		schemaImportPath: imports.schemaImportPath,
		configImportPath: imports.configImportPath,
		handlerImports: imports.handlerImports,
		authImportLine: auth.importLine,
		authSetupBlock: auth.setupBlock,
		queryHandlerEntries,
	});
}
