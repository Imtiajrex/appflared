import type { AppflareConfig, DiscoveredHandler } from "../../utils/utils";
import { buildImportSection } from "./imports";
import { buildAuthSection } from "./auth";
import { buildRouteLines } from "./routes";
import { renderServerTemplate } from "./template";

export type GenerateHonoServerParams = {
	handlers: DiscoveredHandler[];
	outDirAbs: string;
	schemaPathAbs: string;
	configPathAbs: string;
	config: AppflareConfig;
};

export function generateHonoServer(params: GenerateHonoServerParams): string {
	const queries = params.handlers.filter((handler) => handler.kind === "query");
	const mutations = params.handlers.filter(
		(handler) => handler.kind === "mutation"
	);

	const imports = buildImportSection({
		handlers: params.handlers,
		outDirAbs: params.outDirAbs,
		schemaPathAbs: params.schemaPathAbs,
		configPathAbs: params.configPathAbs,
	});
	const auth = buildAuthSection(params.config);
	const routeLines = buildRouteLines({
		queries,
		mutations,
		localNameFor: imports.localNameFor,
	});

	return renderServerTemplate({
		schemaImportPath: imports.schemaImportPath,
		configImportLine: imports.configImportLine,
		handlerImports: imports.handlerImports,
		authImports: auth.imports,
		authSetupBlock: auth.setupBlock,
		authMountBlock: auth.mountBlock,
		authResolverBlock: auth.resolverBlock,
		routeLines,
	});
}
