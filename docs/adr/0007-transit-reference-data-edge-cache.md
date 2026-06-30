# Cache transit reference data at the edge for in-process callers

## Status

accepted

## Context

D1 bills on **rows read**, counted across every query execution — not rows stored. The transit
reference tables (`stations`, `lines`, `segments`, `line_stations`) are tiny (~3.5k rows total) but
read in full on every request that needs them, because the getters scan the whole table (and the
`stations ⋈ line_stations` join amplifies reads, ~4.2k rows/call at ~35% efficiency). Over a day
that was ~5.3M rows read — **78% of all D1 reads** — against a DB that holds ~107k rows.

The HTTP endpoints `/transit/{stations,lines,segments}` are already edge-cached (the
`transit-network` `Cache-Tag` + `transitEdgeCacheMiddleware`, see ADR-0006), so they only miss
occasionally. But the heavy consumers are **in-process**: `RiskService` calls `getStations()` and
the segment getter on every `/risk` request, and `/risk` is deliberately uncached so its output
stays live. ~73% of the stations reads came from `/risk` alone, completely bypassing the HTTP cache.
At current volume the dollar cost is ~zero (well inside the Workers Paid included rows), so this is a
**latency and scaling-headroom** decision, not a cost cut: reads were scaling with `users × table
size` instead of `users`.

## Decision

Add a read-through cache (`cachedReference(key, loader, ctx)`) for the static reference getters
(`getStations`, `getLines`, `getSegments`), backed by the **same Workers Cache API + `transit-network`
`Cache-Tag`** that already fronts the HTTP responses. The in-process callers (risk, reports) consume
the cached read-model instead of re-querying D1. D1 stays the source of truth — the tables are
untouched and remain available for live joins and heavy server-side computation.

**No TTL, no new purge code:** because the cache entry carries the `transit-network` tag, the existing
`db:purge-cache` (run after a reseed) invalidates it alongside the HTTP responses. The cache falls
through to a direct D1 read whenever the Cache API is absent (Bun tests, the Node seed CLI), so those
paths are unchanged.

The general rule this establishes — **cache in `caches.default` only when all hold:** the data changes
only on an explicit infrequent event, one value serves every caller, a clean invalidation trigger
exists, the re-read is genuinely expensive, and bounded staleness is acceptable. Otherwise keep it a
plain D1 read (per-user/high-cardinality data, constantly-changing or strongly-consistent data,
already-cheap indexed lookups, and live joins/aggregations).

## Considered alternatives

- **Workers KV:** rejected — global replication is unneeded (users are concentrated in Berlin, so one
  or two colos), and it adds a binding, per-read cost, and a separate purge path. The Cache API reuses
  the purge we already have.
- **In-process module-level memo:** rejected — it cannot be invalidated from `purge-transit-cache.ts`,
  which runs as a separate Bun CLI in the deploy pipeline with no handle into running isolates. Without
  a TTL a long-lived isolate would serve stale topology until recycled (minutes–hours), the exact
  "silently breaks the risk map after a reseed" failure ADR-0006's cache notes warn about.
- **In-memory memo with a short TTL:** rejected — it works without external invalidation but trades a
  bounded-staleness window for the precise purge-on-reseed we already get for free via the tag.
- **Keep bespoke `getSegmentSummaries`:** rejected — it existed only to avoid loading segment geometry
  for the risk model. Now that `getSegments()` is cached, the geometry costs no extra D1 read, so the
  risk model reuses `getSegments()` and the summary query is removed.

## Consequences

- The Cache API is **per-colo and evictable**: an eviction or a cold colo triggers a one-off D1 refill,
  never staleness. For Berlin-concentrated traffic this is effectively a shared cache. After a reseed
  the first request fleet-wide does one D1 read per key and repopulates.
- Reference reads drop ~95–99% (~5.3M → low tens of thousands of rows/day); overall D1 reads fall ~78%
  (~6.7M → ~1.5M/day). The win is headroom and lower latency on the `/risk` hot path, not billing.
- The **reports feed** (`reports ORDER BY timestamp DESC LIMIT 1000`, now the largest single source at
  ~1.45M rows/day) is intentionally **not** cached this way: it changes constantly and has no clean
  purge trigger. If it ever needs caching, use a short TTL (seconds), not the tag.
- `getDistance` / `loadGraph` still read stations/lines/line_stations raw from D1 for pathfinding
  (~249k rows/day, low call volume, a different shape than the cached read-models). Left uncached for
  now; revisit if `/distance` traffic grows.
- Cache writes use `executionCtx.waitUntil`, so they never delay the response; `executionCtx` is
  resolved per request in `applyServices` and is `undefined` off Workers (tests/seed), where caching
  is skipped anyway.
- We cache the **computed read-model** (post-reduce shape), not raw rows, so callers also skip
  rebuilding it.
