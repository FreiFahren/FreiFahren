# Build a self-contained Martin image with the Berlin basemap baked in.
# Stages:
#   1. osm-source — download the OSM extract
#   2. tiles      — run tilemaker to produce the .mbtiles
#   3. style      — run rewrite-style.mjs against the committed source style
#   4. final      — Martin serving the baked artifacts

ARG OSM_URL=https://download.geofabrik.de/europe/germany/berlin-latest.osm.pbf
ARG STYLE_BASE_URL=https://tiles.freifahren.org
ARG BUILD_SHA=

# ---------- Stage 1: download OSM extract ----------
FROM alpine:3.20 AS osm-source
ARG OSM_URL
RUN apk add --no-cache curl ca-certificates \
 && curl -fsSL -o /berlin-latest.osm.pbf "$OSM_URL"

# ---------- Stage 2: generate vector tiles ----------
FROM ghcr.io/systemed/tilemaker:master AS tiles
WORKDIR /work
COPY tilemaker/ ./tilemaker/
COPY --from=osm-source /berlin-latest.osm.pbf /work/berlin-latest.osm.pbf
RUN mkdir -p /out \
 && /usr/src/app/tilemaker /work/berlin-latest.osm.pbf \
      --output /out/freifahren-berlin.mbtiles \
      --config /work/tilemaker/config-freifahren.json \
      --process /work/tilemaker/process-freifahren.lua

# ---------- Stage 3: rewrite MapLibre style ----------
FROM node:20-alpine AS style
ARG STYLE_BASE_URL
ARG BUILD_SHA
WORKDIR /work
COPY styles/ ./styles/
COPY source/freifahren-style.json ./source/freifahren-style.json
RUN mkdir -p /out \
 && node styles/rewrite-style.mjs \
      source/freifahren-style.json \
      /out/freifahren-dark.json \
      "$STYLE_BASE_URL" \
      "$BUILD_SHA"

# ---------- Stage 4: final Martin image ----------
FROM ghcr.io/maplibre/martin:1.8.2
COPY --from=tiles /out/freifahren-berlin.mbtiles /tiles/freifahren-berlin.mbtiles
COPY --from=style /out/freifahren-dark.json /styles/freifahren-dark.json
COPY martin/config.yaml /config/config.yaml
EXPOSE 3000
CMD ["--config", "/config/config.yaml"]
