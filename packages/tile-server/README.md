# FreiFahren Tile Server

This package builds and serves the FreiFahren Berlin basemap.

It turns an OpenStreetMap extract into vector tiles, serves those tiles through a tile server, and exposes a MapLibre style JSON that the frontend can load with `VITE_MAP_STYLE_URL`.

## How It Works

The package has three parts:

- `tilemaker/`: Tilemaker config for generating Berlin vector tiles from OSM data.
- `styles/rewrite-style.ts`: helper for preparing a MapLibre style JSON for the configured tile host.
- `martin/`: Martin config for serving the style, generated MBTiles, and font glyphs.
- `fonts/`: TTF fonts Martin turns into MapLibre glyph PBFs (see [Fonts & Glyphs](#fonts--glyphs)).
- `tileserver/`: generated tile/style artifacts and local Docker Compose entrypoint.

The frontend only needs the public style URL:

```env
VITE_MAP_STYLE_URL=http://localhost:3000/style/freifahren-dark
```

For production, point the same variable at the hosted style JSON:

```env
VITE_MAP_STYLE_URL=https://tiles.freifahren.org/style/freifahren-dark
```

## Generated Files

These files are intentionally git-ignored:

- `source/`: source OSM extracts and local style input files.
- `tileserver/data/`: generated `.mbtiles` files.
- `tileserver/styles/freifahren-dark.json`: generated style output.

Only reproducible configs and scripts are committed.

## Prerequisites

- Docker
- Bun
- A Berlin or Berlin/Brandenburg OSM extract at:

```text
packages/tile-server/source/berlin-latest.osm.pbf
```

A clipped Berlin extract is fastest for local iteration.

## Generate Tiles

```sh
cd packages/tile-server
bun run generate:berlin
```

This runs Tilemaker in Docker and writes:

```text
tileserver/data/freifahren-berlin.mbtiles
```

Tile generation is controlled by:

- `tilemaker/config-freifahren.json`: output layers, zoom ranges, simplification, and metadata.
- `tilemaker/process-freifahren.lua`: OSM tag mapping into FreiFahren basemap layers and attributes.

## Prepare The Style

Place the source MapLibre style at:

```text
packages/tile-server/source/freifahren-style.json
```

Then run:

```sh
cd packages/tile-server
bun run rewrite-style
```

This writes:

```text
tileserver/styles/freifahren-dark.json
```

The rewrite script:

- replaces the vector tile source with a `tiles[]` URL template pointing at Martin,
- sets the top-level `glyphs` URL to Martin's font endpoint so text layers can render (see [Fonts & Glyphs](#fonts--glyphs)),
- strips layers that depend on a sprite (`icon-image`), which the tile service does not serve yet.

For production URLs, run:

```sh
bun run rewrite-style:prod
```

The script accepts an optional 4th positional argument used as a cache-bust token. When set, it is appended to each tile URL as `?v=<token>`:

```sh
bun styles/rewrite-style.ts source/freifahren-style.json out.json https://tiles.freifahren.org abc123
# → tiles: ["https://tiles.freifahren.org/freifahren/{z}/{x}/{y}?v=abc123"]
```

This is how the Dockerfile threads the deploy SHA into the style — see [Caching](#caching).

## Fonts & Glyphs

Martin serves MapLibre glyph PBFs from the TTF fonts in `fonts/` (`fonts.paths` in
`martin/config.yaml`), and `rewrite-style.ts` sets the style's `glyphs` to
`<base-url>/font/{fontstack}/{range}`. This is required for any `text-field` layer to render,
including the frontend's line/station labels.

The committed `Open Sans Regular` matches MapLibre's default `text-font`, so the frontend needs no
changes. To swap fonts, drop a `.ttf` into `fonts/`; if its name differs, set `text-font` on the
frontend symbol layers to match. Icons (`icon-image`) still need a sprite — a separate follow-up.

## Serve Locally

```sh
cd packages/tile-server
bun run serve
```

Martin listens on:

```text
http://localhost:3000
```

Frontend style URL:

```text
http://localhost:3000/style/freifahren-dark
```

Vector tile endpoint:

```text
http://localhost:3000/freifahren/{z}/{x}/{y}
```

## PMTiles (R2 migration)

We're migrating off the Martin server to **static PMTiles read directly by the browser over HTTP
range requests** (hosted on Cloudflare R2). The Martin path above still builds and deploys
production today; the scripts below produce the static artifacts for the new path. Both share the
same Tilemaker config/Lua and the same `source/freifahren-style.json`.

```sh
cd packages/tile-server
bun run pmtiles:build   # generate dist/berlin.pmtiles + dist/styles/berlin.json
bun run pmtiles:serve   # serve dist/ with range support + CORS on http://localhost:3000
```

What differs from the Martin path:

- **Tiles**: Tilemaker writes `.pmtiles` purely by output extension — same config, same tile size.
- **Style**: `rewrite-style.ts --pmtiles` emits a single `pmtiles://` vector source (the browser
  range-reads the archive via the `pmtiles` protocol the frontend registers) and points `glyphs`
  at a static `{fontstack}/{range}.pbf` path. No `tiles[]` template, no Martin glyph endpoint.
- **Cache-bust**: the version is a path segment (`/v<sha>/berlin.pmtiles`), not a `?v=` query — an
  immutable versioned object, so a deploy never needs an edge purge. Versioning is applied **only by
  the deploy workflow**, which threads one git sha into both the style URL and the R2 upload key so
  they can't diverge. The local `pmtiles:build`/`pmtiles:serve` flow passes no version: the style
  points at a flat `dist/berlin.pmtiles` that the build actually produces.
- **Glyphs**: the basemap style currently has no `text-field` layers, so glyphs are not fetched.
  The `glyphs` URL is emitted for forward-compatibility; generating the static PBF tree is a
  follow-up (needed only once labels are added).

`dist/` is git-ignored. Output layout mirrors the R2 bucket: `berlin.pmtiles` and `styles/berlin.json`.

### Deploy

`.github/workflows/tile-server-deploy.yml` runs on every push to `main` that touches this package
(and via manual dispatch). It downloads the OSM extract, generates `dist/`, and uploads to the
`freifahren-tiles` R2 bucket: `v<sha>/berlin.pmtiles` (immutable, 1-year cache) and
`styles/berlin.json` (60s TTL — the only mutable pointer, already referencing this build's archive).

The deploy job is **gated on the `TILES_BASE_URL` repo variable** — until it's set the job is
skipped, so this can merge with zero effect on production or existing users.

### Cutover (one-time, manual)

This is what flips traffic from Martin to R2. Everything above ships dormant; these are the only
steps that change what users see.

1. **Prepare the edge** (Cloudflare dashboard, R2 → `freifahren-tiles`):
   - Attach a custom domain (e.g. `basemap.freifahren.org`).
   - Add a Cache Rule for that hostname with **Respect Strong ETags** enabled, so byte-range reads
     return `206` through the proxy. _Verify before flipping:_
     `curl -I -H 'Range: bytes=0-99' https://basemap.freifahren.org/v<sha>/berlin.pmtiles` → `206`.
   - Set the `TILES_BASE_URL` repo variable to that origin and re-run the deploy workflow so the
     style is uploaded pointing at the live archive.
2. **Flip the frontend**: change `VITE_MAP_STYLE_URL` in `packages/frontend-next/.env.production`
   from the Martin style to `https://basemap.freifahren.org/styles/berlin.json`. The frontend
   already registers the `pmtiles://` protocol, so this is the only frontend change. Merging it
   redeploys the app onto R2.
3. **Decommission**: once the new app is live and verified, remove the Coolify Martin service.

Stale service-worker clients self-heal on reload (web-only, `autoUpdate`); pmtiles served from a new
origin aren't matched by the existing `map-tiles` cache rule, so there's no range-cache poisoning to
worry about. (Offline caching of pmtiles is a separate follow-up.)

## Frontend Setup

Set:

```env
VITE_MAP_STYLE_URL=http://localhost:3000/style/freifahren-dark
```

Restart the Vite dev server after changing this value because Vite reads `import.meta.env` at startup.

## Deployment

Deployment is fully automated via the `Dockerfile` in this package. On every push, Coolify builds the image, which:

1. Downloads the Berlin OSM extract from Geofabrik.
2. Runs Tilemaker to produce `freifahren-berlin.mbtiles`.
3. Runs `rewrite-style` against the committed `source/freifahren-style.json` with the production base URL and the build's `BUILD_SHA` (cache-bust token — see [Caching](#caching)).
4. Bakes the `.mbtiles`, the rewritten style JSON, the `fonts/`, and `martin/config.yaml` into a Martin image.

No manual artifact upload is required — `git push` is the deploy.

The image accepts two build args:

| Arg              | Purpose                                                        |
| ---------------- | -------------------------------------------------------------- |
| `STYLE_BASE_URL` | Base URL baked into the style's tile templates.                |
| `BUILD_SHA`      | Cache-bust token appended to tile URLs as `?v=`. Empty by default. |

Coolify must pass `BUILD_SHA` as a build arg (e.g. `BUILD_SHA=${SOURCE_COMMIT}` in the service's Build Variables). Without it, the token is empty and tile URLs don't change between deploys, which means Cloudflare keeps serving old cached tiles until the 1-year TTL expires or someone purges manually.

## Caching

`tiles.freifahren.org` sits behind Cloudflare, and tile responses are aggressively cached at the edge — tiles are baked into the image at build time, so they're identical for every user until the next deploy.

Deploy-time invalidation works via the `BUILD_SHA` token: each deploy bakes a different SHA into the style, so the `?v=<sha>` on every tile URL changes. Browsers and the edge see new URLs after a redeploy and fetch fresh tiles from Martin; old cache entries stay valid but unreferenced and age out on their own. No manual purge required.

The actual cache rules live in the Cloudflare dashboard, not in this repo. To inspect or change caching behavior, check the rules under the `freifahren.org` zone (Caching → Cache Rules, and Rules → Overview).
