// This file contains the configuration for the seeding process.
// Adapt this file to your needs. Based on your cities requirements.
export const ROUTE_TYPE_PRIORITY = ['subway', 'tram', 'light_rail'] as const // Based on the OSM tags used in the seeding process.

export type RouteType = (typeof ROUTE_TYPE_PRIORITY)[number]

// Route types listed here always get the configured color regardless of the
// OSM relation tags (used to give all S-Bahn lines one shared green and all
// Tram lines one shared red). Route types absent from this map fall back to
// The OSM colour/color tag — best for subway lines with per-line branding.
export const ROUTE_COLORS: Partial<Record<RouteType, string>> = {
    tram: '#be1414', // Classic Berlin tram red (tram and metro tram M* lines).
    light_rail: '#007734', // Berlin S-Bahn green (S2), applied to all S-Bahn lines.
}

export const SEED_CONFIG = {
    city: 'Berlin', // The city you want to seed.
    adminLevel: '^[4-6]$', // The admin level of the city. Usually 4-6 for a city boundary.

    // The lines you want to seed.
    lines: [
        'S1',
        'S2',
        'S25',
        'S26',
        'S3',
        'S41',
        'S42',
        'S46',
        'S47',
        'S5',
        'S7',
        'S75',
        'S8',
        'S85',
        'S9',
        'U1',
        'U2',
        'U3',
        'U5',
        'U6',
        'U7',
        'U8',
        'U9',
        'M1',
        'M2',
        'M4',
        'M5',
        'M6',
        'M8',
        'M10',
        'M13',
        'M17',
        '12',
        '16',
        '18',
        '21',
        '27',
        '37',
        '50',
        '60',
        '61',
        '62',
        '63',
        '67',
        '68',
    ],

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
