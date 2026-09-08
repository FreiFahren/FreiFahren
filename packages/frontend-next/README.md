# FreiFahren web app (`frontend-next`) — React + Vite, shipped as a PWA and via Capacitor

## Local development

```sh
bun install
bun run dev                  # Vite dev server
```

Copy [`.env.example`](./.env.example) to `.env`; each variable is documented there. `VITE_API_URL`
points at the API — `http://localhost:8787` for a locally running `api-worker` (see its README for
seeding a local D1 and for running it without the private report gate).

## Tests

Two suites, deliberately separate:

```sh
bun run test:unit            # Vitest over src/, browserless, ~350ms
bun run test                 # Playwright over e2e/, needs a built app and a browser
```

`test:unit` covers the app's pure logic — anything free of React and the browser. `test` covers
behaviour that only exists in a real browser. CI runs the unit tests before the build so a broken
invariant fails in seconds rather than after a bundle and a browser download.

### Known gap

There is **no end-to-end test for the journey planner** (destination entry → result view → the
collapsed segment list). The flow has only been verified by hand. `e2e/pwa-offline.spec.ts` is the
pattern to follow.

_Delete this section once that test exists._
