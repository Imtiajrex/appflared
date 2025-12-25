# Appflare Library

Docs for the shared library helpers in `lib/`

## What’s here

- Schema helpers for defining tables and schemas with Zod
- Value builders (`v.*`) for common field types and relations
- React Query hooks with realtime-friendly subscriptions

## Library (`lib/`)

**Schema builders** ([packages/appflare/lib/db.ts](packages/appflare/lib/db.ts))

- `defineTable(shape)`: wrap a Zod shape in `z.object` to define a table.
- `defineSchema(tables)`: collect a map of tables into a schema object.

**Value helpers** ([packages/appflare/lib/values.ts](packages/appflare/lib/values.ts))

- Primitives: `v.string()`, `v.number()`, `v.boolean()`, `v.date()`.
- Relations/ids: `v.id(table)` creates a string with an ObjectId regex and a `ref:<table>` description for downstream typing.
- Collections/objects: `v.array(item)`, `v.object(shape)`.
- Modifiers: `v.optional(schema)`, `v.nullable(schema)`, `v.union(...schemas)`, `v.literal(value)`.
- Misc: `v.buffer()` (string placeholder), `v.any()`, `v.unknown()`.

**Example: define a schema**

```ts
import { defineSchema, defineTable } from "appflare/lib/db";
import { v } from "appflare/lib/values";

export default defineSchema({
	users: defineTable({
		name: v.string(),
		email: v.string(),
		age: v.number().optional(),
		orgId: v.id("orgs"),
	}),
	orgs: defineTable({
		name: v.string(),
	}),
});
```
