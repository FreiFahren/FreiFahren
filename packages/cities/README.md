# @freifahren/cities

The shared **city registry** — the single source of truth for everything that
differs between the cities FreiFahren serves (Berlin today, Leipzig next).

City is a runtime dimension resolved from the hostname (frontend) or an explicit
`?city=` query param (API). Code stays shared across cities; per-city differences
live here as **data**, never as forked code.

## Constraints

This package is consumed by four heterogeneous toolchains — the Vite frontend
build, three Cloudflare Worker bundles, and the Node/Bun seed scripts. It is
therefore **dependency-free plain TypeScript data**: no runtime dependencies, no
build step. Consumers import the source directly.

## Usage

```ts
import { CITIES, getCity, DEFAULT_CITY_SLUG } from '@freifahren/cities'

const city = getCity(slug) ?? CITIES[DEFAULT_CITY_SLUG]
```

## Shape

See `src/types.ts` for the full `CityConfig`. Each entry carries identity
(`slug`, `subdomain`, `displayName`, `lang`), database mapping (`dbName`,
`dbBinding`), `map` defaults, the `seed` pipeline inputs, the Telegram language
`profile`, and public `community` channels.
