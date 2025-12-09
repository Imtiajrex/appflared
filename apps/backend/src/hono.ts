import { Hono } from 'hono';
import { sValidator } from '@hono/standard-validator';
import { cors } from 'hono/cors';
import { getDatabase } from 'cloudflare-do-mongo/index';
import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { buildUserFilter, userQuerySchema } from './query-utils';

const createUserSchema = z.object({
	userId: userQuerySchema.shape.userId,
	name: z.string().min(3),
	age: z.number().gt(18).lt(99),
});

const updateUserSchema = z
	.object({
		name: z.string().min(3).optional(),
		age: z.number().gt(18).lt(99).optional(),
	})
	.refine((value) => Object.keys(value).length > 0, 'At least one field is required');

const app = new Hono();
app.use(
	cors({
		origin: '*',
	}),
);

app.get('/queries/getQuery', sValidator('query', userQuerySchema), async (c) => {
	const query = c.req.valid('query');
	const db = getDatabase(env.MONGO_DB).collection('users').find(buildUserFilter(query));
	const result = await db.toArray();

	return c.json(result, 200);
});

app.post('/mutations/create', sValidator('json', createUserSchema), async (c) => {
	const body = c.req.valid('json');
	const db = getDatabase(env.MONGO_DB).collection('users');
	const result = await db.insertOne({
		userId: body.userId,
		name: body.name,
		age: body.age,
	});
	c.executionCtx.waitUntil(notifyWebSocketServer({ ...body, insertedId: result.insertedId }).catch(() => undefined));

	return c.json({ insertedId: result.insertedId }, 201);
});

app.patch('/mutations/update/:userId', sValidator('json', updateUserSchema), async (c) => {
	const { userId } = c.req.param();
	const body = c.req.valid('json');
	const db = getDatabase(env.MONGO_DB).collection('users');
	const result = await db.updateOne({ userId: userId }, { $set: body });
	c.executionCtx.waitUntil(notifyWebSocketServer({ userId, ...body }).catch(() => undefined));

	return c.json({ modifiedCount: result.modifiedCount }, 200);
});

app.delete('/mutations/delete/:userId', async (c) => {
	const { userId } = c.req.param();

	const db = getDatabase(env.MONGO_DB).collection('users');
	const result = await db.deleteOne({ userId: userId });
	c.executionCtx.waitUntil(notifyWebSocketServer({ userId }).catch(() => undefined));

	return c.json({ deletedCount: result.deletedCount }, 200);
});

export default app;

async function notifyWebSocketServer(document: Record<string, unknown>) {
	const id = env.WEBSOCKET_HIBERNATION_SERVER.idFromName('primary');
	const stub = env.WEBSOCKET_HIBERNATION_SERVER.get(id);

	await stub.fetch('https://internal/notify-mutation', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ document }),
	});
}
