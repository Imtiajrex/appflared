# Appflare Server (MongoDB) Module

Appflare's server package provides a small MongoDB data layer with typed helpers for querying, writing, and populating referenced documents inferred from your schema. The entrypoint is `createMongoDbContext`, which builds per-table clients that expose a Prisma-like API (`findMany`, `create`, `update`, `delete`, etc.).

## Directory Map

- `db.ts`: Public exports for the module (re-exports context and types).
- `database/context.ts`: Builds the MongoDB context and per-table client facade.
- `database/builders.ts`: Low-level delete/update/patch builders used by the context.
- `database/query-builder.ts`: Chainable query API (`where`, `sort`, `limit`, `offset`, `select`, `populate`, `find`, `findOne`).
- `database/query-utils.ts`: Projection and sort normalization helpers.
- `database/populate.ts`: Populates referenced documents via forward or reverse lookups.
- `types/`: Shared TypeScript types for docs, queries, and table clients. `schema-refs.ts` derives reference metadata from Zod schemas.
- `utils/id-utils.ts`: Id normalization helpers (string/ObjectId) and ref field coercion.

## Quick Start

```ts
import { MongoClient } from "mongodb";
import { z } from "zod";
import { createMongoDbContext } from "@appflare/server/db";

const client = await MongoClient.connect(process.env.MONGO_URL!);
const db = client.db("appflare-demo");

const schema = {
	users: z.object({
		_id: z.string(),
		_creationTime: z.number(),
		email: z.string(),
		// ref:tickets tells the system this field references the tickets table
		tickets: z.array(z.string().describe("ref:tickets")).optional(),
	}),
	tickets: z.object({
		_id: z.string(),
		_creationTime: z.number(),
		title: z.string(),
		user: z.string().describe("ref:users"),
	}),
} as const;

const ctx = createMongoDbContext({ db, schema });

// typed table clients
const users = ctx.users;
const tickets = ctx.tickets;

// create
const user = await users.create({ data: { email: "a@demo.com", tickets: [] } });

// query with select + populate
const withTickets = await users.findUnique({
	where: { _id: user._id },
	select: ["_id", "email"],
	include: ["tickets"],
});

// update many
await tickets.updateMany({
	where: { user: user._id },
	data: { title: "Updated" },
});
```

## R2 Storage Manager (Hono)

Use `createR2StorageManager` to mount authenticated, rule-driven storage routes on Cloudflare Workers (R2). Each rule declares a route, allowed methods, authorization hook, and key derivation so you can map requests to bucket object keys however you like.

```ts
import { Hono } from "hono";
import { createR2StorageManager } from "@appflare/server/storage";

const app = new Hono<{ Bindings: { BUCKET: R2Bucket } }>();

app.route(
	"/storage",
	createR2StorageManager({
		basePath: "/storage", // optional prefix
		bucketBinding: "BUCKET", // or provide getBucket(c)
		rules: [
			{
				route: "/private/*",
				methods: ["GET", "PUT", "DELETE"],
				authorize: async ({ c }) => {
					const user = await verifySession(c.req); // your auth logic
					return user
						? { allow: true, principal: user }
						: { allow: false, status: 401 };
				},
				deriveKey: ({ wildcard, principal }) => `${principal!.id}/${wildcard}`,
				maxSizeBytes: 5 * 1024 * 1024,
				cacheControl: "private, max-age=60",
			},
			{
				route: "/public/*",
				methods: ["GET", "HEAD", "PUT"],
				authorize: () => ({ allow: true }),
				deriveKey: ({ wildcard }) => `public/${wildcard}`,
				cacheControl: "public, max-age=3600",
			},
		],
	})
);

export default app;
```

Key behaviors:

- `authorize` can attach a `principal` that flows into `deriveKey` for per-user folders.
- `route` supports wildcards (`*`) to capture the remainder of the path; `defaultKey` mirrors the request path under the base path when `deriveKey` is omitted.
- Supports `GET`/`HEAD` for reads, `PUT`/`POST` for writes, and `DELETE` for deletes. Size limits, cache control, and content type inference are configurable per rule.

## Better Auth (Hono)

Use `initBetterAuth` with `createBetterAuthRouter` to forward requests to a Better Auth instance from a Hono server. The generated server can also mount this automatically when `auth` is defined in `appflare.config.ts`.

```ts
import { Hono } from "hono";
import { createBetterAuthRouter, initBetterAuth } from "appflare/server/auth";

const app = new Hono();
const auth = initBetterAuth({
	// Better Auth options (adapter, providers, cookies, etc.)
});

app.route("/auth", createBetterAuthRouter({ auth }));
```

## Core Concepts

- **Context**: `createMongoDbContext` wires a MongoDB `Db`, a Zod schema map, and optional collection naming into typed table clients. Each table client wraps insert/update/delete/query logic and handles reference normalization.
- **Reference inference**: `buildSchemaRefMap` inspects Zod field descriptions that start with `ref:` to discover forward references. This enables automatic population and reference normalization.
- **Id normalization**: `normalizeIdValue` coerces valid string ids into `ObjectId` for filters and writes; `stringifyIdField` converts `_id` back to hex string on reads. Ref fields are normalized similarly via `normalizeRefFields`/`stringifyRefFields`.
- **Populate**: `populate()` on a query triggers `applyPopulate`, which performs `$lookup` pipelines. Forward populate (table stores the ref) is preferred; if absent, reverse populate finds documents that reference the current table (e.g., `tickets.user -> users._id`).
- **Typed chaining**: Query builders keep result types in sync when `select` or `populate` is used. Update/delete builders offer a fluent `where(...).set(...).exec()` style when called with one argument.

## API Reference

### Context Factory

- `createMongoDbContext(options)`:
  - `db`: MongoDB `Db` instance.
  - `schema`: Record of Zod schemas for each table (must include `_id` and `_creationTime`).
  - `collectionName?`: Optional mapper `(tableName) => collectionName`.
  - Returns `MongoDbContext` — a map of table names to `AppflareTableClient`.

### Table Client (`AppflareTableClient`)

Methods match Prisma-like signatures:

- `findMany({ where?, orderBy?, skip?, take?, select?, include? })`
- `findFirst({ ... })`
- `findUnique({ where, select?, include? })`
- `create({ data, select?, include? })`
- `update({ where, data, select?, include? })`
- `updateMany({ where?, data })`
- `delete({ where, select?, include? })`
- `deleteMany({ where? })`
- `count({ where? })`

`select` accepts an array or object of field keys; `include` accepts populatable relation keys. Both adjust the result type.

### Query Builder

Produced via `ctx.<table>.findMany()` under the hood and exposed through `core.query()`:

- `where(filter)`: chainable; multiple calls AND together.
- `sort(sortSpec)`: accepts object or tuples; `desc` maps to `-1` for Mongo.
- `limit(n)` / `offset(n)`
- `select(...keys)`
- `populate(key | keys[])`
- `find()` returns an array; `findOne()` returns first or `null`.

### Update/Patch/Delete Builders

When `update`, `patch`, or `delete` are called with only the table name, they return a builder:

```ts
await ctx.users
	.update("users")
	.where({ email: /@demo/ })
	.set({ email: "x" })
	.exec();
await ctx.users.delete("users").where("someId").exec();
```

`patch` is an alias of `update`.

### Populate Behavior

- Forward populate uses `$lookup` from the current collection to the referenced table (`localField` = ref field, `foreignField` = `_id`). Arrays are matched element-wise.
- Reverse populate triggers when the current table lacks the ref but others point to it. It looks up documents in the referencing table and groups them by current `_id`.
- Populate respects `select`: projection is expanded to include ref keys so lookups have ids even when omitted from the requested fields.

### Utilities

- `buildProjection(keys)`: builds a Mongo projection, ensuring `_id` and `_creationTime` are excluded when not selected.
- `normalizeSort(sort)`: converts sort objects/tuples to Mongo format.
- `normalizeIdFilter`, `normalizeRefFields`, `stringifyIdField`: ensure consistent id types across reads/writes.

## Usage Notes

- Always include `_id` and `_creationTime` in your Zod schema; they are used by the helpers and default projections.
- Reference discovery relies on `describe("ref:<table>")` on string fields (optionally inside arrays/optional/nullable/default wrappers).
- All writes normalize ids to `ObjectId` when valid; reads stringify `_id` for consumer-friendly output.
- `findUnique` requires a `where` clause; `findFirst` defaults `take` to `1` when unset.

## Extending

- Supply a custom `collectionName` to map logical table names to physical collections.
- Customize partial normalization by passing `normalizePartial` to `createUpdateBuilder`/`createPatchBuilder` if you wrap the builders yourself.

## Related Files

- Types: `types/types.ts`, `types/schema-refs.ts`
- Database helpers: `database/context.ts`, `database/query-builder.ts`, `database/builders.ts`, `database/populate.ts`, `database/query-utils.ts`
- Id helpers: `utils/id-utils.ts`
