# warehouse-export

Cron Worker that snapshots every table in the api-worker D1 database to the `freifahren-warehouse`
R2 bucket as CSV (`d1/<table>.csv`), so PostHog's data warehouse can link them (PostHog has no D1
connector). Tables and columns are auto-discovered, so schema changes need no edits here — the only
manual follow-up is registering a brand-new table's CSV as a PostHog source.
