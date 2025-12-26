export const buildCronHandlersBlock = (handlerEntries: string): string =>
	`const cronHandlers = {\n${handlerEntries}\n} as const;`;
