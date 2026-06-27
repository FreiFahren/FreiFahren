# Run the API on a Cloudflare Worker backed by Hyperdrive

## Status

accepted

## Context

The backend (`packages/api-worker`, formerly `hono-backend`) ran as a Bun process in a Docker
container on a Hetzner box managed by Coolify, behind the Cloudflare proxy at `api.freifahren.org`.
That is a stateful server to run, monitor, and pay for, with cold starts and a single point of
failure. The rest of the stack has been moving onto Cloudflare's edge (ADR-0002 self-hosted Capgo
worker, ADR-0004 static tiles on R2). The app is a Hono app that already exposes `app.fetch`, so it
ports to Workers via runtime adapters rather than a rewrite.

## Decision

Run the Hono app as a **Cloudflare Worker** (`api-worker`). Reach the existing self-hosted Postgres
through a **Hyperdrive** binding — connection pooling at the edge, with `postgres.js` + Drizzle
unchanged. Build config, the db client, and services **per request** from the Worker bindings
instead of at import time (workerd has no env at import). **Sentry** is the only observability sink.
Deploys are merge-to-`main` via GitHub Actions: `drizzle-kit migrate → db:seed → wrangler deploy →
db:purge-cache`. Postgres is kept for now; **D1 is a deliberate later step**.

## Considered alternatives

- **Keep the Coolify/Docker backend:** rejected — a stateful server, ops cost, and a SPOF, against
  the kill-stateful-servers direction of ADR-0004.
- **Cloudflare D1 now (instead of Hyperdrive):** rejected for now. D1 is SQLite, so adopting it is a
  dialect migration (schema port, regenerated migrations, timestamp/JSON/boolean reshaping, a seed
  pipeline rework since D1 has no connection string and no interactive transactions, and a
  test-runtime change), not an adapter swap. Coupling it with the runtime migration would balloon
  risk. Staged as its own follow-up; the `createDb` / `DbConnection` factory is the seam that
  localizes the eventual swap.
- **Managed Postgres (Neon/Supabase):** rejected for now — a data migration off the existing DB,
  unnecessary once Hyperdrive fronts the current Postgres.
- **Workers Logs (or another observability stack):** rejected — standardize on Sentry, already used
  by `telegram-worker`, as the single sink.

## Consequences

- The Worker is stateless: env/db/services are built per request from `c.env` (the db client is
  memoized per isolate). No import-time env access, and no in-process caches — the 1-minute reports
  cache was dropped.
- **Hyperdrive TLS constraint:** Hyperdrive's TLS stack (BoringSSL) will not negotiate Coolify's
  default ECDSA **P-521** Postgres certificate (`SSLV3_ALERT_HANDSHAKE_FAILURE`). The database must
  serve an **RSA** certificate. Coolify's "Regenerate SSL Certificates" button or a DB re-deploy
  reverts it to P-521 and must be re-fixed. Postgres must stay publicly reachable over TLS (or move
  behind a Cloudflare Tunnel); optionally firewall-allowlist Cloudflare's published IP ranges.
- Hyperdrive query caching is **disabled** so report reads stay fresh; transit data is edge-cached
  at the HTTP layer (a Cache Rule plus the `transit-network` `Cache-Tag`).
- Sentry is the only observability sink — logs via `consoleLoggingIntegration` and error capture via
  `withSentry`. There is no filesystem or log-file output.
- Cutover is strangler-style: the Worker deploys to `api-worker.freifahren.workers.dev` for testing;
  production is flipped by adding the `api.freifahren.org/*` route in `wrangler.jsonc` (instant
  rollback by removing it). `telegram-worker`'s `BACKEND_URL` and the frontend API URL are
  unchanged — they point at the host.
- Integration tests stay on Bun (docker Postgres, env injected per request); runtime fidelity comes
  from the staging deploy. Revisit `@cloudflare/vitest-pool-workers` at the D1 step.
- Migrations and seed run in CI against the DB directly, so the Worker holds no Cloudflare write
  credentials (the cache-purge token lives only in CI secrets). `seedBaseData` is report-preserving,
  so it is safe to run on every deploy.
- Provisioning (Hyperdrive config, Sentry project, GitHub secrets) currently lives in the
  Cloudflare/Sentry APIs, not Terraform; import into the `infra` repo when it lands.
