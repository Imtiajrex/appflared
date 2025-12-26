export const buildRuntimeBlock = (): string => `
export const createScheduler = (
	queue?: Env["APPFLARE_SCHEDULER_QUEUE"]
): TypedScheduler => {
	const enqueue: SchedulerEnqueue = async (task, ...args) => {
		const [payload, options] = args;
		if (!queue) {
			throw new Error("Scheduler queue binding is not configured");
		}

		await queue.send({ task, payload }, options);
	};

	return { enqueue };
};

export async function handleSchedulerBatch(params: {
	batch: { messages: Array<{ body: unknown }> };
	env: Env;
}): Promise<void> {
	const { env, batch } = params;
	if (!env.APPFLARE_SCHEDULER_QUEUE) {
		console.warn("Scheduler queue binding missing; skipping batch");
		return;
	}

	const db = createAppflareDbContext({
		db: getDatabase(env.MONGO_DB) as unknown as Db,
	});
	const scheduler = createScheduler(env.APPFLARE_SCHEDULER_QUEUE);
	const baseContext: SchedulerHandlerContext = {
		...emptyAuthContext,
		db,
		scheduler,
		env,
	};

	const handlerLookup =
		schedulerHandlers as unknown as SchedulerHandlerLookup;

	for (const message of batch.messages ?? []) {
		const body = (message ?? {}).body as Partial<
			SchedulerQueueMessage
		>;
		const task = body?.task;
		if (!task || !(task in schedulerHandlers)) {
			console.warn("Skipping scheduler task", task);
			continue;
		}

		const schedulerTask = task as SchedulerTaskName;
		const handler = handlerLookup[schedulerTask as string];
		if (!handler) {
			console.warn("Skipping scheduler task", schedulerTask);
			continue;
		}

		try {
			await handler.run(
				baseContext,
				body?.payload as SchedulerPayload<SchedulerTaskName>
			);
		} catch (err) {
			console.error("Scheduler task failed", schedulerTask, err);
		}
	}
}
`;
