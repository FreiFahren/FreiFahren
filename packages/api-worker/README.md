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

## Trust flags

Every report is scored after it is written: each flag in the set is a read-only SQL predicate run
against that report, and the ones that fire reduce its trust (`trust = 1 / (1 + Σ weights)`). A
station shows on the map once the trust of its reports in the last hour reaches `MIN_STATION_TRUST`,
so a flagged report is one that needs corroborating rather than one that has been decided about.

The definitions live in `trust-flags.enc`, encrypted, because publishing them publishes the
thresholds — `client-burst-10m` fires above four reports in ten minutes, and the evasion is to file
three. The plaintext is gitignored.

```bash
brew install age                    # once
bun run flags:decrypt               # trust-flags.enc  -> trust-flags.json, then edit it
bun run flags:encrypt               # trust-flags.json -> trust-flags.enc, commit that
```

There is no passphrase and nothing to share. The file is encrypted to every collaborator on this
repo, using the SSH keys they already publish on their GitHub profile, and decrypted with the key you
already push with — so access follows repo membership by itself. Joining means you can read the next
version; leaving means you are not a recipient of it. If you joined recently and cannot decrypt, ask
anyone with access to re-run `flags:encrypt`; if you have no SSH key on your GitHub profile, add one
under Settings → SSH and GPG keys (`flags:encrypt` names anyone it had to skip).

Changing a flag is a pull request. Review the decrypted diff — `bun run flags:decrypt` on either side
of the branch — and merge; the deploy workflow decrypts the blob with its own age identity and sets
it as the `TRUST_FLAGS` secret. A blob that will not decrypt, or a flag set the schema rejects, fails
the deploy rather than reaching production. Rolling a flag back is reverting the commit.

Two controls stay outside this loop, as Worker secrets that take effect in seconds with no deploy,
because they are what an incident actually reaches for:

```bash
wrangler secret put REPORTING_ENABLED     # true / false — the killswitch
wrangler secret put MIN_STATION_TRUST     # trust a station needs before it shows
```

Flags are unset in dev, previews and tests. Trust then stays null, which reads as _unscored_ rather
than untrusted, and the map shows everything.
