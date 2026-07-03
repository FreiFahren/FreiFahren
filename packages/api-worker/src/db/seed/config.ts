// Seed configuration. City-specific inputs (operators, admin level, colors,
// Route-type priority) come from the shared `@freifahren/cities` registry; the
// Pipeline-global tuning below (Overpass endpoint, merge threshold, geometry
// Tolerance) doesn't vary by city and stays here with the pipeline.

import { BERLIN, type RouteType } from '@freifahren/cities'

const CITY = BERLIN

export type { RouteType }

export const ROUTE_TYPE_PRIORITY = CITY.seed.routeTypePriority
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
