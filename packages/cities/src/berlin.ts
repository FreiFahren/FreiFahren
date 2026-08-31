import type { PublicCityConfig } from './types'
import { CITY_DATABASES } from './databases'

export const BERLIN_PUBLIC: PublicCityConfig = {
    slug: 'berlin',
    subdomain: 'berlin',
    displayName: 'Berlin',
    publicAppUrl: 'https://app.freifahren.org',
    // D1 databases can't be renamed and we don't migrate data, so Berlin keeps
    // the existing database and its `DB` binding.
    dbName: CITY_DATABASES.berlin.dbName,
    dbBinding: CITY_DATABASES.berlin.dbBinding,
    lang: 'de',
    timezone: 'Europe/Berlin',
    reporting: {
        publicSubmissionsEnabled: true,
        telegramForwardingEnabled: false,
    },
    map: {
        center: [13.388, 52.5162],
        zoom: 11,
        // Approximate S-Bahn-network extent [west, south, east, north].
        bounds: [13.088, 52.338, 13.761, 52.675],
        styleUrl: 'https://tiles.freifahren.org/styles/berlin.json',
    },
    tiles: {
        osmUrl: 'https://download.geofabrik.de/europe/germany/berlin-latest.osm.pbf',
    },
    seed: {
        adminLevel: '^[4-6]$',
        operators: ['Berliner Verkehrsbetriebe', 'S-Bahn Berlin GmbH'],
        // Bus is last: when a stop serves rail and bus, the rail type stays the
        // station's representative type (and wins the proximate-merge pick).
        routeTypePriority: ['subway', 'tram', 'light_rail', 'train', 'bus'],
        // MetroBus (M11–M85) only: BVG runs ~300 bus lines, but only the Metro
        // network runs frequently enough to be checked and reported in practice.
        // Berlin's Metrotram refs (M1–M17) are disjoint from the MetroBus refs,
        // so scoping bus this way can't collide with a tram of the same name.
        routeRefPatterns: { bus: String.raw`^M\d+$` },
        colors: {
            tram: '#be1414', // Classic Berlin tram red (tram and metro tram M* lines).
            light_rail: '#007734', // Berlin S-Bahn green (S2), applied to all S-Bahn lines.
            bus: '#95276E', // VBB MetroBus purple, one shared color for all bus lines.
        },
        defaultLineColor: '#000000',
    },
    community: {
        telegramHandle: '@FreiFahren_BE',
        telegramChatId: '-1001370021231',
        reporterCount: { min: 50_000, max: 60_000 },
    },
}
