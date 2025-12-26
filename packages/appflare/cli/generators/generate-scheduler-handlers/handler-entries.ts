import type { DiscoveredHandler } from "../../utils/utils";

export const buildHandlerEntries = (params: {
	handlers: DiscoveredHandler[];
	localNameFor: (handler: DiscoveredHandler) => string;
}): string => {
	if (params.handlers.length === 0) return "";

	return params.handlers
		.map((handler) => {
			const local = params.localNameFor(handler);
			const task = `${handler.fileName}/${handler.name}`;
			return (
				`\t${JSON.stringify(task)}: {\n` +
				`\t\tfile: ${JSON.stringify(handler.fileName)},\n` +
				`\t\tname: ${JSON.stringify(handler.name)},\n` +
				`\t\trun: ${local}.handler,\n` +
				`\t},`
			);
		})
		.join("\n");
};
