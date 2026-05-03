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
VITE_MAP_STYLE_URL=http://localhost:8090/style/freifahren-dark
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

The rewrite script updates the vector tile source to use Martin's TileJSON endpoint and removes glyph/sprite dependent layers for the initial no-assets deployment.

For production URLs, run:

```sh
npm run rewrite-style:prod
```

## Serve Locally

```sh
cd packages/tile-server
npm run serve
```

Martin listens on:

```text
http://localhost:8090
```

Frontend style URL:

```text
http://localhost:8090/style/freifahren-dark
```

Vector tile endpoint:

```text
http://localhost:8090/freifahren/{z}/{x}/{y}
```

## Frontend Setup

Set:

```env
VITE_MAP_STYLE_URL=http://localhost:8090/style/freifahren-dark
```

Restart the Vite dev server after changing this value because Vite reads `import.meta.env` at startup.

## Deployment

Deployment is fully automated via the `Dockerfile` in this package. On every push, Coolify builds the image, which:

1. Downloads the Berlin OSM extract from Geofabrik.
2. Runs Tilemaker to produce `freifahren-berlin.mbtiles`.
3. Runs `rewrite-style` against the committed `source/freifahren-style.json` with the production base URL.
4. Bakes the `.mbtiles`, the rewritten style JSON, and `martin/config.yaml` into a Martin image.

No manual artifact upload is required — `git push` is the deploy.
