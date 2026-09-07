// Frontend-safe entry point. Import from here (`@freifahren/cities/public`), never from the
// package root (`@freifahren/cities`) — the root re-exports the full `CityConfig`, including
// `telegram` (report-extraction prompt engineering), which a bundler will embed verbatim in
// the client JS the moment anything in this module graph is imported. This file's import graph
// touches only the `*_PUBLIC` halves of each city — never `./berlin.telegram`,
// `./hamburg.telegram`, or `./leipzig.telegram` — so that data can never reach a browser
// through this path even transitively.
import { BERLIN_PUBLIC } from './berlin'
import { HAMBURG_PUBLIC } from './hamburg'
import { LEIPZIG_PUBLIC } from './leipzig'
import type { PublicCityConfig } from './types'

export type { PublicCityConfig } from './types'

// Deliberately NOT imported from ./index — importing anything from that module, even a type,
// risks a future edit turning it into a real runtime import and pulling the telegram profiles
// back into this graph. Keep this file's imports limited to the `*_PUBLIC` values above.
export const PUBLIC_CITY_SLUGS = ['berlin', 'hamburg', 'leipzig'] as const

export const PUBLIC_CITIES = {
    berlin: BERLIN_PUBLIC,
    hamburg: HAMBURG_PUBLIC,
    leipzig: LEIPZIG_PUBLIC,
} as const satisfies Record<(typeof PUBLIC_CITY_SLUGS)[number], PublicCityConfig>

export type PublicCitySlug = keyof typeof PUBLIC_CITIES

export const DEFAULT_CITY_SLUG = 'berlin' as const

const isPublicCitySlug = (value: string): value is keyof typeof PUBLIC_CITIES =>
    Object.prototype.hasOwnProperty.call(PUBLIC_CITIES, value)

/** Look up the frontend-safe view of a city, or `undefined` if the slug is unknown. */
export const getPublicCity = (slug: string): PublicCityConfig | undefined =>
    isPublicCitySlug(slug) ? PUBLIC_CITIES[slug] : undefined
