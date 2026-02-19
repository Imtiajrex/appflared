# Appflare Package Documentation

## Purpose

`appflare` is a schema-first backend toolkit that combines:

- a **code generation CLI** (typed clients, server runtime glue, worker files),
- a **runtime server layer** (database, auth, storage, migrations), and
- **React hooks** for typed query/mutation usage with optional realtime subscriptions.

At a high level, Appflare takes user-defined schema + handler modules and produces a deployable, typed backend surface for Cloudflare-style environments.

---

## What this package delivers

### 1) Typed schema and model contract

From a user schema file, Appflare generates a strongly typed model contract (`Doc`, `Id`, query args/result helpers, table maps, aggregate types, auth context types) used consistently by generated server/client code.

Core sources:

- `cli/schema/schema.ts`
- `cli/schema/schema-static-types.ts`
- `lib/db.ts`
- `lib/values.ts`

### 2) Handler discovery and typed API boundary

Appflare scans project TypeScript source files to detect exported handler declarations and classify them by kind:

- `query`
- `mutation`
- `internalQuery`
- `internalMutation`
- `scheduler`
- `cron`
- `http`

This discovery metadata powers route generation, client typing, scheduler/cron codegen, and wrangler trigger generation.

Core source:

- `cli/core/discover-handlers.ts`

### 3) Generated runtime artifacts

The build output includes generated files under `outDir/src` and `outDir/server`:

- typed schema re-export and schema types
- generated DB CRUD handlers
- generated API client with typed query/mutation callers
- generated Hono server glue for handlers
- generated websocket Durable Object runtime
- generated scheduler handler runtime
- generated cron handler runtime
- generated Cloudflare worker entrypoint
- generated `wrangler.json`

Core orchestration:

- `cli/index.ts`

### 4) Server-side execution framework

The server module exposes runtime utilities for:

- typed D1-backed data access (`createAppflareDbContext`)
- schema-to-SQL migration planning/application
- Better Auth initialization + Hono routing adapters
- rule-driven R2 storage routing with optional auth

Core sources:

- `server/db.ts`
- `server/database/context.ts`
- `server/d1.ts`
- `server/auth.ts`
- `server/storage/*`

### 5) Frontend integration

The React package wraps TanStack Query with Appflare handler metadata and optional websocket-based realtime update wiring.

Core sources:

- `react/hooks/useQuery.ts`
- `react/hooks/useMutation.ts`
- `react/hooks/usePaginatedQuery.ts`
- `react/shared/queryShared.ts`

---

## Package boundary and exports

### Main package exports

`package.json` defines subpath exports for:

- root (`index.ts`) → schema/value/location helpers + config type
- `./db`, `./values`, `./location`
- `./react`, `./react/*`
- `./server/db`, `./server/d1`, `./server/storage`, `./server/auth`

### CLI entrypoint

`bin.appflare` points to:

- `cli/index.ts`

This file contains command parsing, config loading, build orchestration, watch mode, worker/wrangler generation, and optional TypeScript emit.

---

## Folder-by-folder responsibilities

## `cli/`

### Responsibility

Owns the full code generation lifecycle for Appflare projects.

### What it does

- parses CLI commands (`build`, `--watch`, `--emit`)
- loads and validates appflare config
- validates schema/project paths
- discovers handlers by kind
- invokes all generators
- writes generated files
- optionally runs tsc emit for generated artifacts
- regenerates in watch mode with smart path ignores

### Important subareas

- `cli/index.ts`: command + orchestration + watch mode
- `cli/core/config.ts`: config loader/validator
- `cli/core/discover-handlers.ts`: AST/regex-based handler and cron trigger detection
- `cli/core/build.ts`: secondary build orchestration helper
- `cli/schema/*`: schema introspection + static type block injection
- `cli/utils/*`: shared types/path helpers/emit helpers/zod rendering

## `cli/generators/`

### Responsibility

Contains output-specific generators used by the CLI pipeline.

### What it does

- `generate-api-client`: typed API layer (`createAppflareApi`) + metadata-rich handler wrappers + internal caller support + optional auth client config extraction
- `generate-db-handlers`: table-level generated CRUD handlers from schema table names
- `generate-hono-server`: creates route wiring for query/mutation/http handlers, auth/storage/realtime integration points
- `generate-websocket-durable-object`: creates websocket subscription and mutation-notification handling runtime
- `generate-scheduler-handlers`: queue scheduler task runtime and typed task dispatch
- `generate-cron-handlers`: cron handler runtime and cron trigger extraction output for wrangler
- `generate-cloudflare-worker`: worker `fetch`/`queue`/`scheduled` glue and wrangler configuration file generation

## `schema/` (under `cli/schema`)

### Responsibility

Generates strongly typed contract layer from the user schema.

### What it does

- loads schema module dynamically
- infers table names and document fields
- emits table doc interfaces and table map
- emits generic query/select/include/aggregate typings
- emits auth context type variants based on config presence

## `lib/`

### Responsibility

User-facing schema and value authoring primitives.

### What it does

- `lib/db.ts`: `defineTable`, `defineSchema`
- `lib/values.ts`: `v` DSL for scalar/optional/nullable/literal/array/object/id/location-like schemas
- `lib/location.ts`: geospatial point helpers and query filter builders (`near`, `withinRadius`, `withinBox`, `withinPolygon`, `intersects`)

## `react/`

### Responsibility

Frontend typed data hooks and realtime synchronization helpers.

### What it does

- `useQuery`: typed query call + optional realtime cache replacement
- `usePaginatedQuery`: infinite pagination + realtime updates for first page
- `useMutation`: typed mutation wrapper with key defaults
- `queryShared`: deterministic key serialization + websocket subscription lifecycle helper

## `server/`

### Responsibility

Runtime primitives used directly or by generated server code.

### What it does

- `server/db.ts`: exports database context surface
- `server/database/context.ts`: D1-backed table client implementation (`findMany`, `findUnique`, `create`, `update`, `delete`, `aggregate`, etc.)
- `server/d1.ts`: D1 handler, Appflare schema migration planner/runner, Better Auth migration bridge, migration router helper
- `server/auth.ts`: Better Auth initialization and Hono router/handler wrappers, request sanitization helpers
- `server/storage/*`: R2 storage manager with configurable rules, route handlers, method constraints, auth hook, key derivation, cache control handling
- `server/types/*`: type-level contracts for query args/results/select/include/populate/aggregate
- `server/utils/id-utils.ts`: ID/ref normalization helpers

---

## Architecture overview

Appflare is organized around a **single source of truth** model:

1. User-defined schema + handlers are the authored input.
2. CLI discovery and schema typing derive a typed runtime contract.
3. Generators produce server/client/worker artifacts that all reference the same contract.
4. Runtime modules (`server/*`) provide operational execution primitives.
5. React hooks consume generated handler metadata for typed requests and realtime updates.

This design keeps handler signatures, route paths, and data models aligned across build-time and runtime surfaces.

---

## Generated output model

Typical generated structure in `outDir`:

- `src/schema.ts`
- `src/schema-types.ts`
- `src/api.ts`
- `src/client.config.ts` (optional)
- `src/handlers/*` (generated DB handlers)
- `server/server.ts`
- `server/websocket-hibernation-server.ts`
- `server/scheduler.ts`
- `server/cron.ts`
- `server/index.ts` (worker entry)
- `wrangler.json` (path configurable)

These artifacts represent the full runtime boundary for requests, realtime streams, queue/scheduler processing, and optional cron scheduling.

---

## Runtime behavior provided by generated artifacts

### HTTP API surface

- Query handlers map to `GET` endpoints.
- Mutation handlers map to `POST` endpoints.
- Optional custom `http` handlers are mounted as generated routes.

### Realtime channel

- Websocket Durable Object receives subscriptions (`/ws`) and mutation notifications (`/notify`).
- Subscription payloads can include handler/table/filter/sort/select/include context.
- Mutation notifications trigger re-fetch and broadcast to subscribers.

### Queue + scheduler

- Scheduler handlers map to typed queue task execution with payload contracts.
- Worker queue consumer routes batch messages into scheduler runtime.

### Cron

- Cron handlers can declare `cronTrigger`/`cronTriggers` metadata.
- Trigger values are collected and injected into generated wrangler `triggers.crons`.

### Worker configuration

Generated wrangler config can include:

- Durable Object binding
- R2 bucket binding
- optional KV namespace binding
- optional D1 database binding
- optional queue producer/consumer configuration
- CORS/environment vars defaults

---

## Integration points and extension surfaces

### Config-driven features (`AppflareConfig`)

Feature flags and settings include:

- auth (`enabled`, `basePath`, `options`, `clientOptions`)
- storage (rules, base path, bucket binding, cache defaults, KV options)
- database (D1 binding/id/name)
- scheduler (enabled, queue binding/name)
- wrangler path/main/compatibility customization
- CORS origin settings

### Handler-level extensibility

Handler kinds beyond query/mutation (`internal*`, `scheduler`, `cron`, `http`) expand generated runtime capabilities without changing generator architecture.

### Runtime adapters

- Better Auth wrappers accept custom options and optional KV-backed secondary storage.
- Storage manager allows custom auth, key derivation, and route-level behavior through rule objects.
- D1 helpers support direct migration operations and optional migration endpoint wiring.

---

## Notable implementation characteristics

- Build is deterministic around discovered handlers + schema.
- Generated files are marked auto-generated and meant to be source-of-truth outputs.
- Watch mode recalculates targets and ignores to avoid generated-output loops.
- Emit mode intentionally scopes `tsc` to generated files to avoid unrelated rootDir conflicts.
- The package supports both generation-time and runtime type alignment through shared schema contracts.

---

## Maturity notes

Some modules in `server/database/*` and utility areas include placeholder-oriented functions alongside fully implemented context logic. The current primary path is centered on the D1-backed `createAppflareDbContext` flow and generated server/client artifacts.

---

## Quick module map

- Root exports: `index.ts`
- CLI: `cli/index.ts`
- Build/discovery: `cli/core/*`
- Generators: `cli/generators/*`
- Schema typing: `cli/schema/*`
- Library DSL: `lib/*`
- React hooks: `react/*`
- Server runtime: `server/*`

This map reflects the full package intent: author schema and handlers once, generate strongly typed runtime artifacts, and run them with integrated Cloudflare-compatible server primitives.
