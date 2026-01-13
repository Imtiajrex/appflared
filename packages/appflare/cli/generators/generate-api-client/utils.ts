import { isValidIdentifier } from "../../utils/utils";

export const sortedEntries = <T>(map: Map<string, T[]>): Array<[string, T[]]> =>
	Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));

export const renderObjectKey = (key: string): string =>
	isValidIdentifier(key) ? key : JSON.stringify(key);

export const handlerTypePrefix = (h: any): string => {
	const base = (h.routePath ?? h.fileName) as string;
	return (
		base
			.replace(/[^a-zA-Z0-9]/g, "")
			.replace(/^./, (c: string) => c.toUpperCase()) +
		(h.name as string)
			.replace(/[^a-zA-Z0-9]/g, "")
			.replace(/^./, (c: string) => c.toUpperCase())
	);
};

export const normalizeTableName = (fileName: string): string =>
	fileName.endsWith("s") ? fileName : `${fileName}s`;
