import { BERLIN } from './berlin'
import { HAMBURG } from './hamburg'
import { LEIPZIG } from './leipzig'
import { MUNICH } from './munich'
import { COLOGNE } from './cologne'
import { NUREMBERG } from './nuremberg'
import { HANNOVER } from './hannover'
import { DUESSELDORF } from './duesseldorf'
import { DRESDEN } from './dresden'
import { KARLSRUHE } from './karlsruhe'
import { FRANKFURT } from './frankfurt'
import { STUTTGART } from './stuttgart'
import type { CityConfig } from './types'

export * from './types'
export { BERLIN }
export { HAMBURG }
export { LEIPZIG }
export { MUNICH }
export { COLOGNE }
export { NUREMBERG }
export { HANNOVER }
export { DUESSELDORF }
export { DRESDEN }
export { KARLSRUHE }
export { FRANKFURT }
export { STUTTGART }
export { CITY_DATABASES, CITY_DATABASE_SLUGS, getCityDatabase } from './databases'
export type { CityDatabaseSlug } from './databases'

/**
 * The city registry: the single source of truth for everything that differs
 * between cities. Keyed by slug. City is a runtime dimension resolved from the
 * hostname (frontend) or an explicit `?city=` param (API).
 */
export const CITIES = {
    berlin: BERLIN,
    hamburg: HAMBURG,
    leipzig: LEIPZIG,
    munich: MUNICH,
    cologne: COLOGNE,
    nuremberg: NUREMBERG,
    hannover: HANNOVER,
    duesseldorf: DUESSELDORF,
    dresden: DRESDEN,
    karlsruhe: KARLSRUHE,
    frankfurt: FRANKFURT,
    stuttgart: STUTTGART,
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

export const isExcludedLineRef = (ref: string, patterns: readonly string[] | undefined): boolean => {
    if (patterns === undefined) return false
    for (const source of patterns) {
        if (new RegExp(source).test(ref)) return true
    }
    return false
}
