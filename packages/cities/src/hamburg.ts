import type { PublicCityConfig } from './types'
import { CITY_DATABASES } from './databases'

export const HAMBURG_PUBLIC: PublicCityConfig = {
    slug: 'hamburg',
    subdomain: 'hamburg',
    displayName: 'Hamburg',
    publicAppUrl: 'https://hamburg.freifahren.org',
    listed: false,
    dbName: CITY_DATABASES.hamburg.dbName,
    dbBinding: CITY_DATABASES.hamburg.dbBinding,
    lang: 'de',
    timezone: 'Europe/Berlin',
    reporting: {
        publicSubmissionsEnabled: true,
        telegramForwardingEnabled: false,
    },
    map: {
        center: [9.9937, 53.5511],
        zoom: 11,
        bounds: [9.727, 53.369, 10.348, 53.733],
        styleUrl: 'https://tiles.freifahren.org/styles/hamburg.json',
    },
    tiles: {
        osmUrl: 'https://download.geofabrik.de/europe/germany/hamburg-latest.osm.pbf',
    },
    seed: {
        adminLevel: '^4$',
        operators: [
            'Hamburger Hochbahn',
            'Hamburger Hochbahn AG',
            'S-Bahn Hamburg GmbH',
            'Verkehrsbetriebe Hamburg-Holstein GmbH',
            'Verkehrsbetriebe Hamburg-Holstein',
        ],
        routeTypePriority: ['subway', 'light_rail', 'bus'],
        routeRefPatterns: { bus: String.raw`^\d{1,2}$` },
        colors: {
            light_rail: '#1A962B',
            bus: '#FA1E41',
        },
        defaultLineColor: '#000000',
    },
    community: {
        telegramChatId: '-1202572205',
        reporterCount: { min: 4_000, max: 5_000 },
    },
}
