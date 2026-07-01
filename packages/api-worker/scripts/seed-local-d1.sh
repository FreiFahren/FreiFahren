#!/usr/bin/env bash
# Seed the local D1 database used by `wrangler dev`: seed the libsql file, apply D1 migrations, then
# copy the reference tables (stations/lines/line_stations/segments) into D1.
set -euo pipefail

cd "$(dirname "$0")/.."

LIBSQL_FILE="local.db"
SEED_SQL="$(mktemp -t freifahren-d1-seed).sql"
trap 'rm -f "$SEED_SQL"' EXIT

echo "→ Seeding libsql reference data ($LIBSQL_FILE)..."
DATABASE_URL="file:./$LIBSQL_FILE" bun run db:seed

echo "→ Applying D1 migrations to local D1..."
bunx wrangler d1 migrations apply DB --local

echo "→ Copying reference tables into local D1..."
# Parents before children for FK order; INSERT OR IGNORE keeps re-runs idempotent and reports intact.
: > "$SEED_SQL"
for t in stations lines line_stations segments; do
  sqlite3 "$LIBSQL_FILE" ".mode insert $t" "select * from $t;" |
    sed 's/^INSERT INTO/INSERT OR IGNORE INTO/' >> "$SEED_SQL"
done
bunx wrangler d1 execute DB --local --file="$SEED_SQL"

echo "✓ Local D1 seeded. Run 'bun run dev'."
