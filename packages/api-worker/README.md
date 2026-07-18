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

Each city has its own isolated D1 database (see the `CITY_DATABASES` registry in
`packages/cities`), and they all share the same `drizzle/` migrations. The migrate commands resolve
each city's binding from the registry — no binding is hard-coded. With no `--city`, they fan out
over every provisioned city so all databases stay on one schema; pass `--city <slug>` to target one.

After altering the schema, generate a migration and apply it:

```sh
bun run db:generate                          # generate the SQLite migration (offline)

# Every provisioned city (keeps all databases on one schema):
bun run db:migrate                           # apply to all cities' local D1
bun run db:migrate:remote                    # apply to all cities' remote (production) D1

# A single city, e.g. Leipzig:
bun run db:migrate --city leipzig            # local
bun run db:migrate:remote --city leipzig     # remote
```

Applying migrations is idempotent: wrangler tracks applied migrations in each database's
`d1_migrations` ledger, so re-running is a no-op. `bun run seed` applies migrations through the same
helper before loading reference data, and the deploy workflow runs `db:migrate:remote` across every
city in `CITY_DATABASES` (with a drift guard that fails if the databases land on different heads).

## DB Access / Drizzle Studio

`bun run db:studio` opens Drizzle Studio against the remote D1 over the Cloudflare API (set
`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_API_TOKEN`). For quick queries,
use `bunx wrangler d1 execute DB --local|--remote --command "..."`.
