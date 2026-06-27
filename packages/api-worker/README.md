# Freifahren API (`api-worker`) — Hono + Drizzle on Cloudflare Workers

## .env

Copy [`.env.example`](./.env.example) to `.env` for local development; each variable is documented there.

## Local development

The API runs as a Cloudflare Worker. Locally you serve it with `wrangler dev`, backed by a Postgres
container. The `compose-hono.test.yaml` stack is a **CLI/test harness** — a Postgres instance plus a
Bun container that `just db-*` and CI `exec` into to run migrations, seed, and tests. It does **not**
serve the API.

```sh
just up                  # start Postgres + the harness container
just db-migrate          # initialize the schema (first run)
just db-seed             # populate Berlin stations/lines/segments
bun run dev              # serve the Worker locally (wrangler dev) on http://localhost:8787
```

`bun run dev` uses the Hyperdrive `localConnectionString` from `wrangler.jsonc` to reach the local
Postgres. Put any local secrets/vars in `.dev.vars` (see `.env.example`). If dependencies change or
the harness misbehaves, rebuild it with `just rebuild`.

## DB Migrations

After altering the DB schema, you need to align the actual DB state with the drizzle schema. You first create the migration:

```sh
just db-generate # Generate migration
```

And then apply it to the DB:

```sh
just db-migrate
```

## DB Access / Drizzle Studio

Drizzle provides it's own UI to interact with the DB. Simply run `just db-studio` and open the link you get in your browser.

If you want to access the DB with something like Postico, use the following connection string: `postgres://postgres:postgres@localhost:5432/freifahren`
