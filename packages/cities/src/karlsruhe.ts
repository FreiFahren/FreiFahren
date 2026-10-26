import { CITY_DATABASES } from './databases'
import type { CityConfig } from './types'

// Synthetic until there is a group export to tune on, as Leipzig started out.
const promptExamples = `Message: "2 kontrolleure in der 4 europaplatz richtung oberreut"
{"stationName": "Europaplatz (Kaiserstraße)", "directionName": "Oberreut Zentrum"}

Message: "S1 Richtung Hochstetten gerade Europaplatz"
{"stationName": "Europaplatz (U)", "directionName": "Hochstetten Grenzstraße"}

Message: "Sind Hbf ausgestiegen"
{"stationName": "Hauptbahnhof", "directionName": null}

Message: "zwei männlich gelesen, schwarze jacken"
{"stationName": null, "directionName": null}
`

export const KARLSRUHE: CityConfig = {
    slug: 'karlsruhe',
    subdomain: 'karlsruhe',
    // Also the OSM boundary name the seed's Overpass area query matches on.
    displayName: 'Karlsruhe',
    publicAppUrl: 'https://karlsruhe.freifahren.org',
    listed: false,
    dbName: CITY_DATABASES.karlsruhe.dbName,
    dbBinding: CITY_DATABASES.karlsruhe.dbBinding,
    lang: 'de',
    timezone: 'Europe/Berlin',
    reporting: {
        telegramForwardingEnabled: false,
    },
    map: {
        center: [8.4037, 49.0069],
        zoom: 11,
        // KVV core [west, south, east, north]: Wörth, Ettlingen, Durlach, Bruchsal and Rheinstetten.
        bounds: [8.2, 48.85, 8.7, 49.15],
        styleUrl: 'https://tiles.freifahren.org/styles/karlsruhe.json',
    },
    tiles: {
        osmUrl: 'https://download.geofabrik.de/europe/germany/baden-wuerttemberg/karlsruhe-regbez-latest.osm.pbf',
        clipToMapBounds: true,
    },
    seed: {
        adminLevel: '^6$',
        operators: [
            'Verkehrsbetriebe Karlsruhe GmbH',
            'Verkehrsbetriebe Karlsruhe',
            'AVG',
            'Albtal-Verkehrs-Gesellschaft mbH',
            'Albtal-Verkehrs-Gesellschaft mbH;DB Regio',
            'DB Regio Mitte',
        ],
        // The Stadtbahn reaches Heilbronn, Freudenstadt and Baden-Baden; only the core is seeded.
        stationBounds: [8.2, 48.85, 8.7, 49.15],
        routeTypePriority: ['light_rail', 'tram'],
        osmRouteTypeAliases: { train: 'light_rail' },
        routeRefPatterns: { light_rail: String.raw`^S\d+$`, tram: String.raw`^(\d+|S\d+)$` },
        // Trams and Stadtbahn lines carry their KVV colours in OSM.
        colors: {},
        defaultLineColor: '#000000',
        // DB names its stops "Karlsruhe-X"; the tram and Stadtbahn stops next to them use the local
        // names. Renaming the DB side merges the pairs.
        stationNameOverrides: {
            'Karlsruhe Hauptbahnhof': 'Hauptbahnhof',
            Bahnhofsvorplatz: 'Hauptbahnhof',
            'Karlsruhe-Durlach': 'Durlach Bahnhof',
            'Karlsruhe Hagsfeld': 'Bahnhof Hagsfeld',
            'Karlsruhe-Hagsfeld': 'Bahnhof Hagsfeld',
            'Karlsruhe-Knielingen': 'Knielingen',
            'Karlsruhe-Mühlburg': 'Mühlburg Bahnhof',
        },
    },
    telegram: {
        inspectorKeywords:
            'Kontrolleure, Kontrolle, Kontros, Kontrolleur, Kontis, in Uniform, DB Sicherheit, ' +
            'in Zivil, Zivis, KVV, VBK, AVG, Fahrkartenkontrolle, Security, männlich/weiblich gelesen',
        untrackedLinesNote:
            'Sightings on OTHER lines (bus lines, night lines, regional trains, ' +
            'replacement services) are still reports if a station name is mentioned: ' +
            'extract the station.',
        circularLineAlias: '',
        circularLinePattern: '',
        abbreviations: [
            [String.raw`straße`, 'strasse'],
            [String.raw`str\.?(?=\s|$|\/|,|\)|-)`, 'strasse'],
            [String.raw`str$`, 'strasse'],
            [String.raw`\bbhf\.?\b`, 'bahnhof'],
            [String.raw`\bhbf\.?\b`, 'hauptbahnhof'],
            [String.raw`\bpl\.?\b`, 'platz'],
        ],
        promptExamples,
    },
    community: {},
}
