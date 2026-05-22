# FreiFahren Tile Server

This package builds and serves the FreiFahren Berlin basemap.

It turns an OpenStreetMap extract into vector tiles, serves those tiles through a tile server, and exposes a MapLibre style JSON that the frontend can load with `VITE_MAP_STYLE_URL`.

## How It Works

The package has three parts:

- `tilemaker/`: Tilemaker config for generating Berlin vector tiles from OSM data.
- `styles/rewrite-style.mjs`: helper for preparing a MapLibre style JSON for the configured tile host.
- `martin/`: Martin config for serving the style and generated MBTiles.
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
- Node.js/npm
- A Berlin or Berlin/Brandenburg OSM extract at:

```text
packages/tile-server/source/berlin-latest.osm.pbf
```

A clipped Berlin extract is fastest for local iteration.

## Generate Tiles

```sh
cd packages/tile-server
npm run generate:berlin
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
npm run rewrite-style
```

This writes:

```text
tileserver/styles/freifahren-dark.json
```

The rewrite script replaces the vector tile source with a `tiles[]` URL template pointing at Martin and removes glyph/sprite dependent layers for the initial no-assets deployment.

For production URLs, run:

```sh
npm run rewrite-style:prod
```

The script accepts an optional 4th positional argument used as a cache-bust token. When set, it is appended to each tile URL as `?v=<token>`:

```sh
node styles/rewrite-style.mjs source/freifahren-style.json out.json https://tiles.freifahren.org abc123
# → tiles: ["https://tiles.freifahren.org/freifahren/{z}/{x}/{y}?v=abc123"]
```

This is how the Dockerfile threads the deploy SHA into the style — see [Caching](#caching).

## Serve Locally

```sh
cd packages/tile-server
npm run serve
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
4. Bakes the `.mbtiles`, the rewritten style JSON, and `martin/config.yaml` into a Martin image.

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
