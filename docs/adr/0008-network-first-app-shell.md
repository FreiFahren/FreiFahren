# Web app shell: network-first HTML so deploys roll out on the next load

## Status

accepted

## Context

The web app's service worker precached the app shell (`index.html`) and served it via a
`navigateFallback` NavigationRoute — cache-first. Even with `registerType: 'autoUpdate'`, the new
service worker only takes over on a *later* navigation, so a fresh deploy reached users one
navigation late, and in practice sometimes only after a manual browser cache clear (observed while
shipping FRE-684). `index.html` is already served `must-revalidate` at the edge (`public/_headers`),
so the staleness was entirely the service-worker layer. The lag forces us to keep the API and query
shapes backward-compatible with shells that trail the current build.

## Decision

Serve the HTML document **network-first**: a `runtimeCaching` rule matching `request.mode ===
'navigate'` (`NetworkFirst`, 3s network timeout, `app-shell` cache). Online, every hard load fetches
the current `index.html`, which references the latest content-hashed bundle, so users are never a
version behind. The hashed JS/CSS/fonts stay **precached / cache-first** — they're immutable (a new
build gets new filenames), so cache-first is correct and keeps the boot instant and offline-capable.

`navigateFallback` is set to `null` (vite-plugin-pwa defaults it to `index.html`). Its NavigationRoute
is registered *before* `runtimeCaching` and first-match-wins, so leaving it on would shadow the
network-first rule and keep serving the stale shell. With it off, the network-first rule is the sole
navigation handler and caches each visited shell, so a returning visitor still cold-boots offline.

Keep the service worker. Dropping it would also make every load latest, but forfeits offline
cold-boot (the tunnel scenario this app exists for) and installability.

## Considered alternatives

- **Drop the PWA / service worker entirely:** rejected — loses offline cold-boot and Add-to-Home-Screen.
  The app's core value is checking for inspectors underground with no signal.
- **Keep the precache shell, add a prompt / auto-reload when a new SW activates:** rejected — still one
  navigation behind and adds update UI (AGENTS.md: keep update UI minimal). Network-first removes the
  lag at its source.

## Consequences

- Deploys reach users on the next hard load, no manual cache clear — less backward-compat burden.
- A hard navigation now waits on a network round-trip when online (3s timeout, then the cached shell).
  In-app SPA navigation is client-side and unaffected.
- Offline now covers **previously-visited pages** (the network-first cache) rather than any path (the
  old precache fallback). This narrows web offline slightly but matches the best-effort framing already
  in [ADR 0005](0005-offline-basemap-http-cache-web-indexeddb-capacitor.md).
- Unchanged in the Capacitor build, which ships no service worker at all (FRE-649).
