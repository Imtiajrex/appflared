# Appflare CLI

This folder contains the build toolchain that turns an Appflare project (schema + query/mutation handlers) into a fully generated API surface (typed client, Hono server, websocket durable object, and optional JS/.d.ts emit). The CLI is Bun-based and is intended to run inside a project that exports `appflare.config.ts`.

## Command surface

- **build**: entrypoint defined in [packages/appflare/cli/index.ts](packages/appflare/cli/index.ts). Generates all artifacts into the configured `outDir` and optionally emits compiled output.
  - `-c, --config <path>`: path to the config file (defaults to `appflare.config.ts`).
  - `--emit`: after generation, run `bunx tsc` with a temporary tsconfig to emit JS and .d.ts into `outDir/dist`.
  - `-w, --watch`: keep the process alive, watch for file changes (excluding `outDir`/`node_modules`/build artifacts), and rerun the build. Recomputes watched paths when the config changes.

### Config shape

`appflare.config.ts` must default-export an object with:

```ts
export default {
	dir: "./app", // Root folder containing your handlers
	schema: "./schema.ts", // Path to the Zod schema file
	outDir: "./_generated", // Where generated files are written
	auth: {
		// Optional: Better Auth config forwarded to the generated server
		enabled: false,
		basePath: "/auth",
		options: {},
	},
};
```

The loader in [packages/appflare/cli/core/config.ts](packages/appflare/cli/core/config.ts) validates presence and types of `dir`, `schema`, and `outDir`, lightly checks optional `auth` (base path, enabled flag, options object), and resolves paths relative to the config file location.

## Build pipeline

The build orchestrator in [packages/appflare/cli/core/build.ts](packages/appflare/cli/core/build.ts) performs the following steps when `build` runs:

1. Resolve absolute paths for `dir`, `schema`, and `outDir`; ensure `dir` and `schema` exist.
2. Create `outDir/src` and `outDir/server` if missing.
3. Generate typed schema helpers into `outDir/src/schema-types.ts` using [packages/appflare/cli/schema/schema.ts](packages/appflare/cli/schema/schema.ts). This produces table doc interfaces, `TableNames`, `Id`, query helpers, and convenience types from [packages/appflare/cli/schema/schema-static-types.ts](packages/appflare/cli/schema/schema-static-types.ts).
4. Generate built-in CRUD handlers for every table into `outDir/src/handlers/<table>.ts` plus an index via [packages/appflare/cli/generators/generate-db-handlers.ts](packages/appflare/cli/generators/generate-db-handlers.ts). These include `find*`, `findOne*`, `insert*`, `update*`, and `delete*` operations backed by the generated schema types.
5. Discover user-defined handlers under `dir` with [packages/appflare/cli/core/discover-handlers.ts](packages/appflare/cli/core/discover-handlers.ts):
   - Recurses through `.ts` files (excluding `node_modules`, `.git`, `dist`, `build`, and the configured `outDir`).
   - Recognizes handlers declared as `export const <name> = query(` or `export const <name> = mutation(`.
   - Skips the schema file and the config file; deduplicates by kind/file/name.
6. Generate a typed client at `outDir/src/api.ts` via [packages/appflare/cli/generators/generate-api-client.ts](packages/appflare/cli/generators/generate-api-client.ts):
   - Produces `createAppflareApi()` with `queries` and `mutations` collections keyed by `<file>/<handler>`.
   - Each handler function wraps `fetch` (default `better-fetch`) and carries metadata: Zod schema, websocket helper, and route path.
   - Realtime helpers build websocket URLs for subscriptions, normalizing `ws`/`wss` bases and providing hooks (`onOpen`, `onMessage`, `onData`, etc.).
7. Generate a Hono server at `outDir/server/server.ts` with [packages/appflare/cli/generators/generate-hono-server.ts](packages/appflare/cli/generators/generate-hono-server.ts):
   - Routes: `GET /queries/<file>/<name>` and `POST /mutations/<file>/<name>`.
   - Uses `@hono/standard-validator` + Zod arg schemas and wraps Mongo via `createMongoDbContext` from `appflare/server/db`.
   - Supports optional mutation notifications for realtime (custom notifier or Durable Object hook).
8. Generate a websocket Durable Object shim at `outDir/server/websocket-hibernation-server.ts` via [packages/appflare/cli/generators/generate-websocket-durable-object.ts](packages/appflare/cli/generators/generate-websocket-durable-object.ts):
   - Implements `WebSocketHibernationServer` to handle subscriptions at `/ws` and mutation notifications at `/notify`.
   - Selects a default query handler per table (or a specific handler) and re-fetches data on mutation notifications, emitting `data` messages to subscribers.
9. If `--emit` is set, remove any previous `outDir/dist`, write a temporary tsconfig (includes generated schema types and handlers only), and run `bunx tsc` to emit JS + .d.ts into `outDir/dist` (logic in [packages/appflare/cli/utils/tsc.ts](packages/appflare/cli/utils/tsc.ts)).

## Handler authoring guidelines

- Handlers must be exported as `query({ args, handler })` or `mutation({ args, handler })` objects.
- Filenames become the first route/path segment and grouping key in the client (`<file>/<handler>`).
- Arguments are validated with Zod; the client infers optional vs required keys and provides typed `args` for both client and server.
- The discovery step ignores `.d.ts` files and anything outside the configured `dir`.

## Generated layout (relative to `outDir`)

```
src/
  schema-types.ts          # Typed schema exports, helpers, and Zod-powered validator types
  handlers/               # Auto CRUD handlers per table + index
    <table>.ts
    index.ts
  api.ts                  # Typed queries/mutations client with realtime helpers
server/
  server.ts               # Hono server that wires handlers + Mongo context
  websocket-hibernation-server.ts # Durable Object websocket bridge
```

## Realtime and Durable Object flow

- Client websockets are created via `handler.websocket(args?, options?)`, building URLs against `realtime.baseUrl` (or handler override) and defaulting the `table` and `handler` params based on the handler’s file/name.
- The Durable Object handles `/ws` upgrades, parses subscription params (`table`, `handler`, `where`, `orderBy`, `take`, `skip`, `select`, `include`, `args`), and caches subscriptions. On `/notify` payloads, it re-runs the relevant query or table fetch and pushes a `data` message to connected sockets.
- Mutation notifications can be sent by the generated Hono server (if `realtime.notify` or `realtime.durableObject` is provided) so subscriptions stay in sync.

## Error handling and safeguards

- Config, schema, and project directories are validated before generation; missing paths throw with readable errors.
- Build de-duplicates discovered handlers to avoid duplicate route generation.
- `--emit` uses a scoped tsconfig that only references generated files to prevent user code outside `rootDir` from breaking emit.
- Generated files include `/* eslint-disable */` headers to avoid lint noise.

## Typical usage

```sh
# From the repo root (config defaults to ./appflare.config.ts)
bunx appflare build

# Custom config location and emit compiled JS
bunx appflare build --config ./config/appflare.config.ts --emit
```

After running, import the generated client/server:

```ts
import { createAppflareApi } from "./_generated/src/api";
import server from "./_generated/server/server";
```

Use the client in web/React or server contexts, and deploy the generated Hono server + Durable Object to your runtime of choice (e.g., Cloudflare Workers with Mongo).
