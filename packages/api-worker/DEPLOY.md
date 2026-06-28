# api-worker — deploy & D1 operations

The worker runs on Cloudflare and uses a **D1** database (binding `DB`). Node runtimes (tests, the
seed CLI, drizzle-kit) use **libsql** via `DATABASE_URL` (a local SQLite file) — the worker never
uses libsql and the Node code never uses the D1 driver. The `DbConnection` type unifies both.

## Routine deploys (after cutover)

Push to `main` under `packages/api-worker/**` triggers `.github/workflows/api-worker-deploy.yml`:

1. `wrangler d1 migrations apply DB --remote` — applies any new migrations.
2. `wrangler deploy` — ships the worker.
3. `db:purge-cache` — purges the `transit-network` edge cache tag.

Generate a migration after a schema change with `bun run db:generate` (dialect `sqlite`), commit it,
then push — the workflow applies it.

### Required GitHub secrets

- `CLOUDFLARE_API_TOKEN` — **must include D1 edit** (plus Workers Scripts edit + Cache Purge).
- `CLOUDFLARE_ACCOUNT_ID` — `ae6f873c58d6fe369c686705f29417a4` (Freifahren).
- `CLOUDFLARE_ZONE_ID`, `REPORT_PASSWORD`.
- `DATABASE_URL` is **no longer needed** for deploys.

## Reference-data reseed (deliberate, not per-deploy)

The seed is report-preserving (upsert + orphan-remap) and uses async transactions, so it runs against
**libsql**, not D1. To refresh stations/lines/segments in prod D1 without touching reports:

1. Export current prod reports from D1 into a local libsql file (so orphan-repair sees them):
   `wrangler d1 execute DB --remote --command "..."` → load into `file:./reseed.db`.
2. `DATABASE_URL=file:./reseed.db bun run db:seed` (or `db:seed:refresh` to also refresh OSM snapshots).
3. Diff the reference tables and apply the delta to D1 (the seed re-derives ids stably). For a full
   rebuild, re-import the four reference tables parents-first via `wrangler d1 execute --remote --file`.

## One-time cutover (Postgres → D1)

> ⚠️ **Merging the PR deploys the D1-bound worker → prod is on D1.** Do the data steps below
> *before* merge. Pre-staging is idempotent and does not touch prod (prod still serves from Postgres
> until the worker is redeployed).

Pre-staged already (D1 `api-worker-db`, id `f11691e9-e6a5-4da2-a5af-d91ca782ee78`, region EEUR):
schema applied, reference data + a full reports snapshot imported and validated via `wrangler dev --remote`.

At cutover:

1. **Reconcile the delta.** Export Postgres reports with `report_id >` the max already in D1
   (timestamp → epoch ms), filter to FK-valid rows, `wrangler d1 execute DB --remote --file`.
2. **Bump the autoincrement with margin** so post-flip D1 ids can't collide with any Postgres gap
   report: `UPDATE sqlite_sequence SET seq = <postgres_max_report_id> + 100000 WHERE name='reports'`.
3. **Flip:** merge the PR → the deploy workflow ships the D1 worker. Postgres now receives no writes.
4. **Final sweep:** re-run step 1 for any reports Postgres took up to the flip (ids are below the
   bumped sequence → no collision). Lossless; no write freeze needed.
5. **Verify** via Sentry + a few `api.freifahren.org` requests.

### Rollback

`wrangler rollback` re-points `api.freifahren.org` at the previous (Postgres/Hyperdrive) worker
deployment — **instant, but cleanly lossless only in the first minutes**: once D1 has accepted
writes, rolling back needs a reverse D1→Postgres delta. Keep Postgres running read-only ~1 week,
then decommission it, the Hyperdrive config, and the public Postgres exposure.
