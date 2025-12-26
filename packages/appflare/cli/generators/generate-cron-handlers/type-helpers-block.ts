export const buildTypeHelpersBlock = (): string => `
 type CronHandlers = typeof cronHandlers;
 
 type CronTaskName = keyof CronHandlers extends never
 	? string
 	: keyof CronHandlers;
 
 type CronTriggerValue = string | readonly string[] | undefined;
 
 type Env = {
 	MONGO_DB: unknown;
 	APPFLARE_SCHEDULER_QUEUE?: {
 		send: (body: unknown, options?: { delaySeconds?: number }) => Promise<void>;
 	};
 } & Record<string, unknown>;
 
 const emptyAuthContext: AppflareAuthContext = {
 	session: null as AppflareAuthSession,
 	user: null as AppflareAuthUser,
 };
 
 type SchedulerEnqueue = {
 	<TTask extends SchedulerTaskName>(
 		task: TTask,
 		...args: SchedulerPayload<TTask> extends undefined
 			? [payload?: SchedulerPayload<TTask>, options?: SchedulerEnqueueOptions]
 			: [payload: SchedulerPayload<TTask>, options?: SchedulerEnqueueOptions]
 	): Promise<void>;
 };
 
 type TypedScheduler = Omit<Scheduler, "enqueue"> & {
 	enqueue: SchedulerEnqueue;
 };
 
 type ScheduledController = {
 	cron: string;
 	scheduledTime?: number;
 	nextScheduledTime?: number;
 };
 
 type ExecutionContext = {
 	waitUntil(promise: Promise<unknown>): void;
 };
 
 type CronHandlerContext = AppflareAuthContext & {
 	db: AppflareDbContext;
 	env: Env;
 	scheduler?: TypedScheduler;
 	controller: ScheduledController;
 	ctx: ExecutionContext;
 };
 
 type CronHandlerLookup = Record<
 	string,
 	{
 		cronTrigger: CronTriggerValue;
 		run: (ctx: CronHandlerContext) => Promise<void>;
 	}
 >;
 `;
