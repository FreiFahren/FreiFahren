# FreiFahren Tile Server

Builds the FreiFahren basemap as **static PMTiles on Cloudflare R2**. There is no running tile
server: an OSM extract is turned into a single `.pmtiles` archive per city, uploaded to the
`freifahren-tiles` R2 bucket behind `tiles.freifahren.org`, and read directly by the browser via HTTP
range requests (MapLibre's `pmtiles://` protocol).

Which cities get built is a projection of the shared [`@freifahren/cities`](../cities) registry: every
city in it (each carries a `tiles` block with its Geofabrik `osmUrl`). There is no hand-maintained list.

## Layout

- `packages/cities` — the registry; a city's `tiles` block is what makes it buildable here.
- `tilemaker/config-freifahren.json` — city-agnostic layer/settings tuning. Per-city identity (name,
  description, schema, `default_view`) is injected by `generate.ts` from the registry.
- `tilemaker/` — Tilemaker config + Lua that map OSM into the basemap layers (city-agnostic).
- `source/freifahren-style.json` — the source MapLibre style (the only committed `source/` file).
- `scripts/generate.ts` — download extract → tilemaker → `dist/<city>.pmtiles` + `dist/styles/<city>.json`.
- `styles/rewrite-style.ts` — points the style at a city's archive (pure function used by `generate.ts`).
- `styles/serve.ts` — a range-capable static server for local `dist/`.
- `fonts/` — TTF the glyph PBFs would be generated from (unused until the style gets text layers).

## Prerequisites

- Docker (Tilemaker runs in a container)
- Bun

## Local development

```sh
cd packages/tile-server
bun run generate     # all buildable cities in the registry → dist/  (CITY=berlin builds just one)
bun run serve        # serve dist/ with range + CORS on http://localhost:3000
```

Then point the frontend at the local style:

```env
VITE_MAP_STYLE_URL=http://localhost:3000/styles/berlin.json
```

`generate` downloads each city's OSM extract into `source/` on first run (cached afterwards). Locally
the style references a flat `/<city>.pmtiles`; the deploy adds the version segment (below).

## Deploying / uploading new tiles

Pushing to `main` with changes under `packages/tile-server/**` runs `.github/workflows/tile-server-deploy.yml`,
which regenerates every city and uploads to R2. There is no manual upload step — `git push` is the
deploy. (Trigger it without a code change via the workflow's **Run workflow** button.)

The deploy is **purge-free**. Each build writes the archive to an immutable, commit-versioned path
`/v<sha>/<city>.pmtiles` (`Cache-Control: immutable`), and the only mutable object is
`styles/<city>.json` (60 s TTL) — it names the current `/v<sha>/` archive. A new deploy is a new
archive URL, so nothing needs purging; the old archive ages out unreferenced. The same git sha drives
both the archive path and the style's source URL, so they can't diverge.

The deploy job is gated on the `TILES_BASE_URL` repo variable (the R2 custom domain, e.g.
`https://tiles.freifahren.org`); until it's set the job is skipped.

## Adding a city

1. Add a `tiles` block to the city's entry in `packages/cities` (`slug` is used in URLs/filenames;
   `osmUrl` is its Geofabrik extract):

   ```ts
   tiles: {
       osmUrl: 'https://download.geofabrik.de/europe/germany/bayern/oberbayern-latest.osm.pbf',
   },
   ```

2. Push. The deploy builds and uploads `v<sha>/<slug>.pmtiles` + `styles/<slug>.json` alongside the
   existing cities — additive, so other cities' URLs are untouched.

3. Point the relevant frontend deployment at `https://tiles.freifahren.org/styles/<slug>.json`. (The
   Tilemaker config is city-agnostic; `generate.ts` injects the per-city name/description/schema from
   the registry, and the archive's `default_view` from the city's `map` center + zoom.)

See `docs/adr/0004-static-pmtiles-basemap-on-cloudflare-r2.md` for why this is static-on-R2 rather
than a tile server.
