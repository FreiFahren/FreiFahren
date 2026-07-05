# Freifahren API (`api-worker`) — Hono + Drizzle on Cloudflare Workers

## .env

Copy [`.env.example`](./.env.example) to `.env` for local development; each variable is documented there.

## Local development

The API runs as a Cloudflare Worker backed by **D1** (SQLite) — everywhere. The worker, the seed
CLI, and the Vitest suite all talk to a real D1 binding; there is no libsql (or other SQLite engine)
in the loop. The seed pipeline that runs in tests is the exact same `seedBaseData` that the CLI runs
against local/production D1, so tests build identical data on the production engine.

```sh
bun install
bun run test                               # Vitest on the Workers runtime; migrates + seeds a test D1
```

To serve the worker locally with data:

```sh
bun run seed --city berlin   # applies migrations + seeds the local D1 in .wrangler/state (via getPlatformProxy)
bun run dev                  # wrangler dev on that local D1 → http://localhost:8787
```

The seed runs the shared pipeline directly against the local Miniflare D1 (obtained through
`getPlatformProxy`); pass `--remote` to also copy the reference tables into the production D1.
Because Miniflare/workerd and `getPlatformProxy` only run under Node, the seed CLI runs under `tsx`
(the `seed` script does this for you) rather than Bun.

Put local secrets/vars in `.dev.vars` (see `.dev.vars.example`).

## DB Migrations

After altering the schema, generate a migration and apply it:

```sh
bun run db:generate                          # generate the SQLite migration (offline)
bun run db:migrate                           # apply to the local D1 (db:migrate:remote for production)
```

## DB Access / Drizzle Studio

`bun run db:studio` opens Drizzle Studio against the remote D1 over the Cloudflare API (set
`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_API_TOKEN`). For quick queries,
use `bunx wrangler d1 execute DB --local|--remote --command "..."`.
