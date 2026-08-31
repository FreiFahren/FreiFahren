import { CITY_DATABASES } from './databases'
import type { PublicCityConfig } from './types'

export const LEIPZIG_PUBLIC: PublicCityConfig = {
    slug: 'leipzig',
    subdomain: 'leipzig',
    displayName: 'Leipzig',
    publicAppUrl: 'https://leipzig.freifahren.org',
    dbName: CITY_DATABASES.leipzig.dbName,
    dbBinding: CITY_DATABASES.leipzig.dbBinding,
    lang: 'de',
    timezone: 'Europe/Berlin',
    reporting: {
        publicSubmissionsEnabled: true,
        telegramForwardingEnabled: true,
    },
    map: {
        center: [12.3731, 51.3397],
        zoom: 12,
        bounds: [12.18, 51.24, 12.56, 51.45],
        styleUrl: 'https://tiles.freifahren.org/styles/leipzig.json',
    },
    tiles: {
        // No Leipzig-only Geofabrik extract exists, so the whole Saxony extract is used
        // and cropped to the city bounds (clipToMapBounds).
        osmUrl: 'https://download.geofabrik.de/europe/germany/sachsen-latest.osm.pbf',
        clipToMapBounds: true,
    },
    seed: {
        adminLevel: '^6$',
        // LVB only. S-Bahn ("DB Regio Südost") is intentionally dropped — a separate
        // operator, routinely inspected anyway, and of little added value here.
        operators: ['Leipziger Verkehrsbetriebe'],
        stationBounds: [12.18, 51.24, 12.56, 51.45],
        // LVB is a tram + bus network. Bus is last so that where a stop serves both,
        // tram stays the station's representative type (and wins the proximate-merge pick).
        routeTypePriority: ['tram', 'bus'],
        // Empty on purpose: keep each line's own OSM colour (official LVB per-line
        // colors) instead of forcing one shared color per vehicle type.
        colors: {},
        defaultLineColor: '#000000',
        excludeLineRefPatterns: [
            String.raw`^\+`,
            String.raw`^SEV(\s|$)`,
            String.raw`^N`,
            String.raw`^Messe Transport$`,
            String.raw`^108$`,
        ],
    },
    community: {
        telegramHandle: '@freifahren_leipzig',
        telegramChatId: '-1001138115617',
        reporterCount: { min: 7_000, max: 8_000 },
    },
}
