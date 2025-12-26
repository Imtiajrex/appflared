import { promises as fs } from "node:fs";
import path from "node:path";
import { pascalCase } from "../../utils/utils";
import {
	buildExportLine,
	buildHandlerFileContent,
	buildIndexFileContent,
} from "./templates";
import { ensureHandlersDir, removeExistingHandlerFiles } from "./prepare";

export type GenerateDbHandlersParams = {
	outDirAbs: string;
	tableNames: string[];
};

export async function generateDbHandlers(
	params: GenerateDbHandlersParams
): Promise<void> {
	const handlersDir = await ensureHandlersDir(params.outDirAbs);
	await removeExistingHandlerFiles(handlersDir);

	const exportLines: string[] = [];
	for (const tableName of params.tableNames) {
		const pascalName = pascalCase(tableName);
		const fileName = `${tableName}.ts`;
		const content = buildHandlerFileContent({ tableName, pascalName });
		await fs.writeFile(path.join(handlersDir, fileName), content);
		exportLines.push(buildExportLine({ tableName, pascalName }));
	}

	const indexTs = buildIndexFileContent(exportLines);
	await fs.writeFile(path.join(handlersDir, "index.ts"), indexTs);
}
