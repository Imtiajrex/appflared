export const buildTypeHelpersBlock = (): string => `
type SchedulerHandlers = typeof schedulerHandlers;

type SchedulerTaskName = keyof SchedulerHandlers extends never
	? string
	: keyof SchedulerHandlers;

type SchedulerPayload<TTask extends SchedulerTaskName> = TTask extends keyof SchedulerHandlers
	? SchedulerHandlers[TTask] extends {
		run: (ctx: unknown, payload: infer TPayload) => Promise<void>;
	}
		? TPayload
		: unknown
	: unknown;

type SchedulerQueueMessage<TTask extends SchedulerTaskName = SchedulerTaskName> = {
	task: TTask;
	payload?: SchedulerPayload<TTask>;
};

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

type SchedulerHandlerContext = AppflareAuthContext & {
	db: AppflareDbContext;
	scheduler: TypedScheduler;
	env: Env;
};

type SchedulerEnqueue = {
	<TTask extends SchedulerTaskName>(
		task: TTask,
		...args: SchedulerPayload<TTask> extends undefined
			? [payload?: SchedulerPayload<TTask>, options?: SchedulerEnqueueOptions]
			: [payload: SchedulerPayload<TTask>, options?: SchedulerEnqueueOptions]
	): Promise<void>;
	(task: string, payload?: unknown, options?: SchedulerEnqueueOptions): Promise<void>;
};

type TypedScheduler = Omit<Scheduler, "enqueue"> & {
	enqueue: SchedulerEnqueue;
};

type SchedulerHandlerLookup = Record<
	string,
	{ run: (ctx: SchedulerHandlerContext, payload: unknown) => Promise<void> }
>;
`;
