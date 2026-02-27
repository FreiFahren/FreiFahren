// This file contains the configuration for the seeding process.
// Adapt this file to your needs. Based on your cities requirements.
export const ROUTE_TYPE_PRIORITY = ['train', 'subway', 'tram', 'light_rail'] as const // Based on the OSM tags used in the seeding process.

export type RouteType = (typeof ROUTE_TYPE_PRIORITY)[number]

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
        'S45',
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
        'U4',
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
        timeoutSeconds: 1200,
        fetchTimeoutMs: 180_000,
    },

    mergeThresholdMeters: 250, // The threshold in meters for merging proximate stations.
} as const
