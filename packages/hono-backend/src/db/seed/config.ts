// This file contains the configuration for the seeding process.
// Adapt this file to your needs. Based on your cities requirements.

// Ordered most-to-least prioritized — used to pick a single "highest"
// Route type when a station is served by several.
export const ROUTE_TYPE_PRIORITY = ['subway', 'tram', 'light_rail', 'train'] as const

export type RouteType = (typeof ROUTE_TYPE_PRIORITY)[number]

// Route types listed here always get the configured color regardless of the
// OSM relation tags (used to give all S-Bahn lines one shared green and all
// Tram lines one shared red). Route types absent from this map fall back to
// The OSM colour/color tag — best for subway lines with per-line branding.
export const ROUTE_COLORS: Partial<Record<RouteType, string>> = {
    tram: '#be1414', // Classic Berlin tram red (tram and metro tram M* lines).
    light_rail: '#007734', // Berlin S-Bahn green (S2), applied to all S-Bahn lines.
}

// Fallback when neither a configured route color nor an OSM colour/color tag is
// Available. Mirrors the DB default on `lines.color`.
export const DEFAULT_LINE_COLOR = '#000000'

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
    city: 'Berlin', // The city you want to seed.
    adminLevel: '^[4-6]$', // The admin level of the city. Usually 4-6 for a city boundary.

    // OSM `operator` tag values whose route relations should be seeded.
    // Filtering by operator keeps the query focused without coupling the
    // Pipeline to a hand-maintained list of line refs that drifts whenever
    // The network changes.
    operators: ['Berliner Verkehrsbetriebe', 'S-Bahn Berlin GmbH'],

    // OSM `route` tag values to include.
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
