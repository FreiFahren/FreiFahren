// Seed configuration. City-specific inputs (operators, admin level, colors,
// Route-type priority) come from the shared `@freifahren/cities` registry; the
// Pipeline-global tuning below (Overpass endpoint, merge threshold, geometry
// Tolerance) doesn't vary by city and stays here with the pipeline.

import { getCity, type CityConfig, type RouteType } from '@freifahren/cities'

// The seed pipeline runs as a single-city process. The city is selected via the
// SEED_CITY env var (the seed entry points set it from their `--city` flag),
// Defaulting to Berlin, and resolved once here so every transform reads the
// Constants below for that one city. In the Worker bundle SEED_CITY is unset, so
// This resolves to Berlin — unchanged from before.
const SEED_CITY_SLUG = process.env.SEED_CITY ?? 'berlin'

const CITY: CityConfig = (() => {
    const city = getCity(SEED_CITY_SLUG)
    if (!city) {
        throw new Error(`Unknown SEED_CITY="${SEED_CITY_SLUG}" — not in the @freifahren/cities registry`)
    }
    return city
})()

/** Slug of the city this seed run targets — used to namespace snapshots per city. */
export const SEED_CITY = CITY.slug

export type { RouteType }

export const ROUTE_TYPE_PRIORITY = CITY.seed.routeTypePriority
export const ROUTE_REF_PATTERNS: Partial<Record<RouteType, string>> = CITY.seed.routeRefPatterns ?? {}
export const ROUTE_COLORS: Partial<Record<RouteType, string>> = CITY.seed.colors
export const DEFAULT_LINE_COLOR = CITY.seed.defaultLineColor

// Resolves the canonical color for an OSM route relation: configured route-type
// Color first, then the OSM colour/color tag, then the default. Color is a line
// Property; segments inherit it from their line.
export const resolveLineColor = (tags: Record<string, string | undefined>): string => {
    const routeType = tags.route as RouteType | undefined
    const configured = routeType ? ROUTE_COLORS[routeType] : undefined
    if (configured !== undefined) return configured

    const explicit = tags.colour ?? tags.color
    return explicit !== undefined && explicit !== '' ? explicit : DEFAULT_LINE_COLOR
}

export const SEED_CONFIG = {
    city: CITY.displayName,
    adminLevel: CITY.seed.adminLevel,
    operators: CITY.seed.operators,
    routeTypes: ROUTE_TYPE_PRIORITY,

    // The Overpass API configuration.
    overpass: {
        url: 'https://overpass-api.de/api/interpreter',
        timeoutSeconds: 180,
        fetchTimeoutMs: 200_000,
    },

    mergeThresholdMeters: 250, // The threshold in meters for merging proximate stations.
    geometrySimplificationTolerance: 0.00003, // Approx. 3m in latitude; keeps endpoints while reducing vertex count.
    routeColors: ROUTE_COLORS,
} as const
