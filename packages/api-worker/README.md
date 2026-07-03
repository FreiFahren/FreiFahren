# Freifahren API (`api-worker`) — Hono + Drizzle on Cloudflare Workers

## .env

Copy [`.env.example`](./.env.example) to `.env` for local development; each variable is documented there.

## Local development

The API runs as a Cloudflare Worker backed by **D1** (SQLite). The worker uses the `DB` binding; the
seed CLI and drizzle-kit run on **libsql** (a local SQLite file) via `DATABASE_URL`. Tests run on the
Workers runtime via Vitest (`@cloudflare/vitest-pool-workers`) against a real D1 binding.

```sh
bun install
bun run test                               # Vitest on the Workers runtime; migrates + seeds a test D1
```

To serve the worker locally with data:

```sh
DATABASE_URL='file:./local.db' bun run db:seed   # seed reference data into a libsql file
bunx wrangler d1 migrations apply DB --local     # create the local D1 schema
sqlite3 local.db ".mode insert stations" "select * from stations;" > /tmp/seed.sql
for t in lines line_stations segments; do sqlite3 local.db ".mode insert $t" "select * from $t;" >> /tmp/seed.sql; done
bunx wrangler d1 execute DB --local --file=/tmp/seed.sql   # load reference data into local D1
bun run dev                                       # wrangler dev on local D1 → http://localhost:8787
```

Put local secrets/vars in `.dev.vars` (see `.dev.vars.example`).

## DB Migrations

After altering the schema, generate a migration and apply it:

```sh
bun run db:generate                          # generate the SQLite migration
bunx wrangler d1 migrations apply DB --local # apply to the local D1 (use --remote for production)
```

## DB Access / Drizzle Studio

`bun run db:studio` opens Drizzle Studio against the libsql file in `DATABASE_URL`. For production D1,
query it with `bunx wrangler d1 execute DB --remote --command "..."`.
