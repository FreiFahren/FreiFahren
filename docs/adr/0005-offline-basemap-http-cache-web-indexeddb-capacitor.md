# Offline basemap: HTTP cache on web, IndexedDB archive in the Capacitor app

## Status

accepted

## Context

With the basemap now a static PMTiles archive ([ADR 0004](0004-static-pmtiles-basemap-on-cloudflare-r2.md)),
offline support differs by platform. The web app runs a service worker; the Capacitor build
deliberately ships **none** (FRE-649 — a SW inside the native WebView serves a stale shell), so
SW-based caching is unavailable there.

## Decision

**Web — rely on the browser HTTP cache.** The `/v<sha>/` archive is immutable, so byte ranges fetched
while online are reused on an offline reload with no extra code. The service worker caches the style
(StaleWhileRevalidate) and glyphs (CacheFirst) but **deliberately does not cache `.pmtiles`** — a
CacheFirst store could answer a range request with a full `200` and corrupt the read.

**Capacitor — persist the archive in IndexedDB.** Download the full archive once in the background
and store it as a Blob (the same store the React Query cache uses to survive a tunnel); serve tiles
from it via an in-memory pmtiles `Source`. The cached style is kept **paired** with a present archive
(persist the new style only after its archive lands), so an interrupted download can never strand the
next offline launch with a style whose tiles are missing.

## Considered alternatives

- **`workbox-range-requests` to SW-cache `.pmtiles` on web:** rejected for now — meaningful complexity
  for marginal gain over the immutable HTTP cache. Revisit if guaranteed full-city web offline is
  wanted.
- **Capacitor Filesystem instead of IndexedDB:** rejected — a base64 round-trip for the ~25 MB
  archive, where IndexedDB stores the Blob directly and already persists across WebView cold starts.

## Consequences

- Web offline covers only previously-viewed areas, and the HTTP cache can be evicted — best-effort,
  not guaranteed.
- Capacitor gets guaranteed full-city offline at the cost of a one-time ~25 MB download and storage.
- Native offline logic lives in app code (gated behind `__CAPACITOR__`), not the service worker, so
  the two platforms diverge here by design.
