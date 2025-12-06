import { watchDbBuild } from "./build-scripts/db-build";
import { resolveConfigPathFromArgs } from "./build-scripts/utils";

void (async () => {
	try {
		const configPath = resolveConfigPathFromArgs();
		await watchDbBuild(configPath);
	} catch (error) {
		console.error("[appflare db build] failed:", error);
		process.exitCode = 1;
	}
})();
