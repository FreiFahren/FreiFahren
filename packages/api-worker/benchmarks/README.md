# Bus-support A/B benchmark

Tooling used to answer: _what does adding Berlin MetroBus (M-prefixed BVG bus)
lines do to API performance, payload sizes, D1 rows read, and Cloudflare cost?_

The comparison runs one worker codebase against two local D1 states:

- **baseline** — the bundled `snapshots/berlin` reference data (U/S/tram/regio)
- **+metrobus** — the same snapshots merged with the BVG MetroBus route
  relations, stop nodes/stop areas, and way geometries fetched from Overpass

## Steps

```sh
# 1. Fetch MetroBus OSM data (route=bus, operator=BVG, ref=^M\d+$).
#    Same query shapes as src/db/seed/stations/overpass.ts. Writes
#    bus_stations.json + bus_route_geometries.json into <dataDir>.
node benchmarks/fetch-metrobus.mjs <dataDir>

# 2. Merge into a snapshot dir.
node benchmarks/merge-snapshots.mjs <dataDir> <dataDir>/snapshots-bus

# 3. Seed the two variants into separate wrangler persist dirs.
npx tsx benchmarks/seed-variant.ts berlin <stateDir>/state-baseline
npx tsx benchmarks/seed-variant.ts <dataDir>/snapshots-bus <stateDir>/state-bus

# 4. Serve both.
npx wrangler dev --port 8787 --persist-to <stateDir>/state-baseline
npx wrangler dev --port 8788 --persist-to <stateDir>/state-bus

# 5. Benchmark.
node benchmarks/http-bench.mjs http://localhost:8787 baseline
node benchmarks/http-bench.mjs http://localhost:8788 metrobus
npx tsx benchmarks/rows-read.ts <stateDir>/state-baseline
npx tsx benchmarks/rows-read.ts <stateDir>/state-bus
```

`rows-read.ts` wraps the D1 binding and sums `meta.rows_read` — the unit D1
billing counts — while the real service queries run, so the numbers translate
directly to Cloudflare cost per cache-miss/uncached request.
