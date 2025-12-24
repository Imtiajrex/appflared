import { isValidIdentifier } from "../utils";

export const sortedEntries = <T>(map: Map<string, T[]>): Array<[string, T[]]> =>
	Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));

export const renderObjectKey = (key: string): string =>
	isValidIdentifier(key) ? key : JSON.stringify(key);

export const handlerTypePrefix = (h: any): string =>
	h.fileName
		.replace(/[^a-zA-Z0-9]/g, "")
		.replace(/^./, (c: string) => c.toUpperCase()) +
	h.name
		.replace(/[^a-zA-Z0-9]/g, "")
		.replace(/^./, (c: string) => c.toUpperCase());

export const normalizeTableName = (fileName: string): string =>
	fileName.endsWith("s") ? fileName : `${fileName}s`;
