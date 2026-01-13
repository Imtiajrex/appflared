import type { DiscoveredHandler } from "../../utils/utils";

const stringifyTriggers = (triggers?: string[]): string => {
	if (!triggers || triggers.length === 0) return "[]";
	return `[${triggers.map((value) => JSON.stringify(value)).join(", ")}]`;
};

export const buildCronHandlerEntries = (params: {
	handlers: DiscoveredHandler[];
	localNameFor: (handler: DiscoveredHandler) => string;
}): string => {
	if (params.handlers.length === 0) return "";

	return params.handlers
		.map((handler) => {
			const local = params.localNameFor(handler);
			const task = `${handler.routePath}/${handler.name}`;
			const fallbackTriggers = stringifyTriggers(handler.cronTriggers);
			return (
				`\t${JSON.stringify(task)}: {\n` +
				`\t\tfile: ${JSON.stringify(handler.routePath)},\n` +
				`\t\tname: ${JSON.stringify(handler.name)},\n` +
				`\t\tcronTrigger: ${local}.cronTrigger ?? ${fallbackTriggers},\n` +
				`\t\trun: ${local}.handler,\n` +
				`\t},`
			);
		})
		.join("\n");
};
