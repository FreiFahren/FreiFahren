import { BERLIN_PUBLIC } from './berlin'
import { BERLIN_TELEGRAM } from './berlin.telegram'
import { HAMBURG_PUBLIC } from './hamburg'
import { HAMBURG_TELEGRAM } from './hamburg.telegram'
import { LEIPZIG_PUBLIC } from './leipzig'
import { LEIPZIG_TELEGRAM } from './leipzig.telegram'
import type { CityConfig } from './types'

export * from './types'

// Full configs, telegram profile included. BACKEND ONLY (api-worker, telegram-worker) — never
// import these from packages/frontend-next. See the warning on `PublicCityConfig` in ./types.ts
// and the frontend-safe entry point at ./public.ts.
export const BERLIN: CityConfig = { ...BERLIN_PUBLIC, telegram: BERLIN_TELEGRAM }
export const HAMBURG: CityConfig = { ...HAMBURG_PUBLIC, telegram: HAMBURG_TELEGRAM }
export const LEIPZIG: CityConfig = { ...LEIPZIG_PUBLIC, telegram: LEIPZIG_TELEGRAM }

export { CITY_DATABASES, CITY_DATABASE_SLUGS, getCityDatabase } from './databases'
export type { CityDatabaseSlug } from './databases'

/**
 * The city registry: the single source of truth for everything that differs between cities.
 * Keyed by slug. City is a runtime dimension resolved from the hostname (frontend) or an
 * explicit `?city=` param (API).
 *
 * BACKEND ONLY — carries `telegram`. Frontend code must import `PUBLIC_CITIES` from
 * `@freifahren/cities/public` instead.
 */
export const CITIES = {
    berlin: BERLIN,
    hamburg: HAMBURG,
    leipzig: LEIPZIG,
} as const satisfies Record<string, CityConfig>

export type CitySlug = keyof typeof CITIES

/**
 * Default city for callers that don't (or can't) resolve one: legacy API clients
 * with no `?city=` param, the Capacitor origin, and old PWA shells.
 */
export const DEFAULT_CITY_SLUG: CitySlug = 'berlin'

export const CITY_SLUGS = Object.keys(CITIES) as CitySlug[]

export const isCitySlug = (value: string): value is CitySlug => Object.prototype.hasOwnProperty.call(CITIES, value)

/** Look up a city by slug, or `undefined` if the slug is unknown. BACKEND ONLY (see CITIES). */
export const getCity = (slug: string): CityConfig | undefined => (isCitySlug(slug) ? CITIES[slug] : undefined)

export const isExcludedLineRef = (ref: string, patterns: readonly string[] | undefined): boolean => {
    if (patterns === undefined) return false
    for (const source of patterns) {
        if (new RegExp(source).test(ref)) return true
    }
    return false
}
