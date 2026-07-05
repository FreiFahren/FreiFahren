# Serve the basemap as static PMTiles on Cloudflare R2

## Status

accepted

## Context

The frontend basemap was served by a **Martin** vector-tile server (Docker on Coolify,
`tiles.freifahren.org`) reading an MBTiles file. That's a stateful service to run, monitor, and pay
for — with cold starts and a single point of failure — for what is effectively static, rarely-changing
city data.

## Decision

Drop the server. Tilemaker outputs a single **PMTiles** archive; CI uploads it to an **R2 bucket**
(`freifahren-tiles`) behind a custom domain (`tiles.freifahren.org`), and the browser reads it
**directly via HTTP range requests** through MapLibre's `pmtiles://` protocol. A GitHub Actions
workflow generates and uploads on push; the edge is read-only.

Cache invalidation is **purge-free** by construction: the archive is written to an immutable,
commit-versioned path `/v<sha>/berlin.pmtiles` (`Cache-Control: immutable`, 1 year), and the only
mutable object is a small `styles/berlin.json` pointer (short TTL) that names the current archive. A
deploy writes a new `/v<sha>/` and rewrites the pointer — old archives are simply unreferenced and
age out. The same commit sha drives both the upload key and the style's source URL, so they can't
diverge. A Cloudflare Cache Rule with **Respect Strong ETags** keeps range reads returning `206` once
edge-cached.

## Considered alternatives

- **Keep Martin:** rejected — server/ops cost and a SPOF for data that barely changes.
- **Hosted tile vendor:** rejected — recurring cost and a third-party dependency when we already run
  on Cloudflare.

## Consequences

- No tile server to operate; tiles are globally edge-cached and range-served from the nearest PoP.
- The frontend must register the `pmtiles://` protocol. Overlays are unaffected (separate GeoJSON
  sources).
- New cities become add-an-archive + pointer rather than a new server — driven by the
  `@freifahren/cities` registry (a city's `tiles` block), not a hand-maintained list.
- CORS is per-origin (`Vary: Origin` from R2); an unconditional `Access-Control-Allow-Origin: *`
  transform rule is an option if cold-cache CORS races appear.
- Provisioning (bucket, custom domain, cache rule) currently lives in the Cloudflare API/MCP, not
  Terraform; import into the `infra` repo when it lands.
