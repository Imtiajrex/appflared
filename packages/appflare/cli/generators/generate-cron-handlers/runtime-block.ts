export const buildRuntimeBlock = (): string => `
 const normalizeCronTrigger = (value: CronTriggerValue): string[] => {
 	if (!value) return [];
 	if (typeof value === "string") return [value.trim()].filter(Boolean);
 	return value.map((entry) => String(entry).trim()).filter(Boolean);
 };
 
 export async function handleCron(params: {
 	controller: { cron: string };
 	env: Env;
 	ctx: { waitUntil(promise: Promise<unknown>): void };
 }): Promise<void> {
 	const { controller, env, ctx } = params;
 	const db = createAppflareDbContext({
 		db: getDatabase(env.MONGO_DB) as unknown as Db,
 	});
 
 	const scheduler = env.APPFLARE_SCHEDULER_QUEUE
 		? createScheduler(env.APPFLARE_SCHEDULER_QUEUE)
 		: undefined;
 
 	const baseContext: CronHandlerContext = {
 		...emptyAuthContext,
 		db,
 		env,
 		scheduler,
 		controller: {
 			cron: controller.cron,
 			scheduledTime: (controller as { scheduledTime?: number }).scheduledTime,
 			nextScheduledTime: (controller as { nextScheduledTime?: number })
 				.nextScheduledTime,
 		},
 		ctx,
 	};
 
 	const handlerLookup = cronHandlers as unknown as CronHandlerLookup;
 	const cronValue = controller.cron;
 
 	for (const [task, handler] of Object.entries(handlerLookup)) {
 		const triggers = normalizeCronTrigger(handler.cronTrigger);
 		if (!triggers.includes(cronValue)) continue;
 		try {
 			await handler.run(baseContext);
 		} catch (err) {
 			console.error("Cron task failed", task, err);
 		}
 	}
 }
 `;
