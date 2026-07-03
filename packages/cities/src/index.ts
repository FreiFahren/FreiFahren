import { BERLIN } from './berlin'
import type { CityConfig } from './types'

export * from './types'
export { BERLIN }

/**
 * The city registry: the single source of truth for everything that differs
 * between cities. Keyed by slug. City is a runtime dimension resolved from the
 * hostname (frontend) or an explicit `?city=` param (API).
 */
export const CITIES = {
    berlin: BERLIN,
} as const satisfies Record<string, CityConfig>

export type CitySlug = keyof typeof CITIES

/**
 * Default city for callers that don't (or can't) resolve one: legacy API clients
 * with no `?city=` param, the Capacitor origin, and old PWA shells.
 */
export const DEFAULT_CITY_SLUG: CitySlug = 'berlin'

export const CITY_SLUGS = Object.keys(CITIES) as CitySlug[]

export const isCitySlug = (value: string): value is CitySlug => Object.prototype.hasOwnProperty.call(CITIES, value)

/** Look up a city by slug, or `undefined` if the slug is unknown. */
export const getCity = (slug: string): CityConfig | undefined => (isCitySlug(slug) ? CITIES[slug] : undefined)
