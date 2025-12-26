export const buildSchedulerHandlersBlock = (handlerEntries: string): string =>
	`const schedulerHandlers = {\n${handlerEntries}\n} as const;`;
