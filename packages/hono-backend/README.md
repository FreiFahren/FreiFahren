# New Freifahren backend using Hono + Drizzle

## .env

The .env file contains the following variables:

- `DATABASE_URL`: The URL of the database to use.
- `DATABASE_URL_TEST`: The URL of the test database to use.
- `NLP_SERVICE_URL`: The URL of the NLP service to use.
- `REPORT_PASSWORD`: The password to use for the report API.
- `CORS_ORIGINS`: Comma-separated list of frontend origins allowed to call the API, for example `http://localhost:1871,https://freifahren.org`.
- `CLOUDFLARE_ZONE_ID`: (optional) Cloudflare zone ID used to purge the transit API cache after `db:seed`.
- `CLOUDFLARE_API_TOKEN`: (optional) API token with Cache Purge permission. When set together with `CLOUDFLARE_ZONE_ID`, `db:seed` purges the `transit-network` cache tag from the Cloudflare edge cache.

## Transit edge caching

Static transit data is served with HTTP cache headers so Cloudflare can cache responses at the edge. `GET /:version/transit/stations`, `/lines`, and `/segments` return `Cache-Control: public, max-age=2592000, stale-while-revalidate=86400` and `Cache-Tag: transit-network`.

`GET /:version/transit/distance` is not edge-cached (`Cache-Control: no-store`). Distances are computed at request time from the graph in the database.

All transit routes support ETag-based conditional requests (`If-None-Match` → `304`).

After `db:seed`, the origin purges cached transit responses via the `transit-network` tag when the Cloudflare env vars above are set. Production should use a Cloudflare cache rule on `api.freifahren.org` for `GET /v*/transit/*` that respects `Cache-Control` from the origin.

## Start containers

You can start the DB and bun container like so:

```sh
just up
```

Hot reloading is enabled and the API container should reload any code changes automatically.

When modifying dependencies, or when something breaks in a weird way in general, try rebuilding the containers:

```sh
just rebuild
```

On the first run, you will also have to initialize the DB with

```sh
just db-migrate
```

Once this is done, the API should be available on `localhost:80`.

You might want to populate the DB with stations and lines. Simply run

```sh
just db-seed
```

To populate it with data about Berlin's public transit system.

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

## API Documentation

The rewrite backend now exposes OpenAPI docs and an interactive Scalar UI.

- Interactive docs: `http://localhost:3000/docs`

The docs are generated from route-level metadata in the rewrite endpoint definitions.
