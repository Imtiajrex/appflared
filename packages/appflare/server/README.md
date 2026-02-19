# Appflare Server Module

Appflare's server package provides a small data layer with typed helpers for querying and writing inferred from your schema. The entrypoint is `createAppflareDbContext`.

## Directory Map

- `db.ts`: Public exports for the module.
- `database/context.ts`: Builds the database context and per-table client facade.
- `database/builders.ts`: Low-level delete/update/patch builders used by the context.
- `database/query-builder.ts`: Chainable query API (`where`, `sort`, `limit`, `offset`, `select`, `populate`, `find`, `findOne`).
- `database/query-utils.ts`: Projection and sort normalization helpers.
- `database/populate.ts`: Populates referenced documents.
- `types/`: Shared TypeScript types for docs, queries, and table clients.
- `utils/id-utils.ts`: Id normalization helpers.

## R2 Storage Manager (Hono)

Use `createR2StorageManager` to mount authenticated, rule-driven storage routes on Cloudflare Workers (R2).

## Better Auth (Hono)

Use `initBetterAuth` with `createBetterAuthRouter` to forward requests to a Better Auth instance from a Hono server.

## D1 (Cloudflare Workers)

Use the D1 helpers from `appflare/server/d1`:

- `createD1DbHandler(db)`: lightweight prepared-statement wrapper.
- `buildD1SchemaMigrations({ schema })`: generates `CREATE TABLE` SQL from Appflare schema.
- `runD1SchemaMigrations({ db, schema })`: applies schema migrations safely (with deferred foreign keys).
- `runBetterAuthD1Migrations({ authOptions })`: executes Better Auth migrations using `getMigrations`.
- `createD1MigrationRouter(...)`: creates a `/migrate` endpoint for manual/boot migrations.

Minimal example:

- Build Better Auth options at runtime with `database: env.DB`.
- Call `runBetterAuthD1Migrations`.
- Call `runD1SchemaMigrations` with your Appflare schema.

## API Reference

### Context Factory

- `createAppflareDbContext(options)`:
  - `schema`: Record of Zod schemas for each table (must include `_id` and `_creationTime`).
  - `collectionName?`: Optional mapper `(tableName) => collectionName`.
  - Returns `AppflareDbContext` — a map of table names to `AppflareTableClient`.

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
