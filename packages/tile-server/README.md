# FreiFahren Tile Server

This package builds and serves the FreiFahren Berlin basemap.

It turns an OpenStreetMap extract into vector tiles, serves those tiles through a tile server, and exposes a MapLibre style JSON that the frontend can load with `VITE_MAP_STYLE_URL`.

## How It Works

The package has three parts:

- `tilemaker/`: Tilemaker config for generating Berlin vector tiles from OSM data.
- `styles/rewrite-style.mjs`: helper for preparing a MapLibre style JSON for the configured tile host.
- `tileserver/`: local TileServer GL config for serving the style and generated MBTiles.

The frontend only needs the public style URL:

```env
VITE_MAP_STYLE_URL=http://localhost:8090/styles/freifahren-dark/style.json
```

For production, point the same variable at the hosted style JSON:

```env
VITE_MAP_STYLE_URL=https://tiles.freifahren.org/styles/freifahren-dark/style.json
```

## Generated Files

These files are intentionally git-ignored:

- `source/`: source OSM extracts and local style input files.
- `tileserver/data/`: generated `.mbtiles` files.
- `tileserver/styles/freifahren-dark/style.json`: generated style output.

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
tileserver/styles/freifahren-dark/style.json
```

The rewrite script updates the vector tile source, glyph URL, and sprite URL to use the configured tile host.

To keep externally hosted glyphs and sprites during local comparison, run:

```sh
node styles/rewrite-style.mjs \
  source/freifahren-style.json \
  tileserver/styles/freifahren-dark/style.json \
  http://localhost:8090 \
  --keep-assets
```

## Serve Locally

```sh
cd packages/tile-server
npm run serve
```

TileServer GL listens on:

```text
http://localhost:8090
```

Frontend style URL:

```text
http://localhost:8090/styles/freifahren-dark/style.json
```

Vector tile endpoint:

```text
http://localhost:8090/data/freifahren/{z}/{x}/{y}.pbf
```

## Frontend Setup

Set:

```env
VITE_MAP_STYLE_URL=http://localhost:8090/styles/freifahren-dark/style.json
```

Restart the Vite dev server after changing this value because Vite reads `import.meta.env` at startup.

## Deployment

Publish these generated artifacts to the tile host:

- `freifahren-berlin.mbtiles`
- `freifahren-dark/style.json`
- optional `fonts/` and `sprites/` folders if the style uses self-hosted assets

TileServer GL can serve the current local setup directly.
