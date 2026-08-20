import type { CityConfig } from './types'
import { CITY_DATABASES } from './databases'

const promptExamples = `Message: "u3 hbf 2 kontrolleure richtung billstedt"
{"stationName": "Hauptbahnhof", "directionName": "Billstedt"}

Message: "s1 altona richtung pops 3k"
{"stationName": "Altona", "directionName": "Poppenbüttel"}

Message: "jungfernstieg u1 2 mann in zivil"
{"stationName": "Jungfernstieg", "directionName": null}

Message: "landungsbrücken clean"
{"stationName": "Landungsbrücken", "directionName": null}

Message: "bus 5 hbf richtung palmaille kontrolle"
{"stationName": "Hauptbahnhof", "directionName": "Palmaille"}

Message: "u2 berliner tor richtung niendorf markt"
{"stationName": "Berliner Tor", "directionName": "Niendorf Markt"}

Message: "s3 hbf nach pinneberg, jetzt dammtor"
{"stationName": "Dammtor", "directionName": "Pinneberg"}

Message: "schlump 2k u2"
{"stationName": "Schlump", "directionName": null}

Message: "hbf clean auf der s1"
{"stationName": "Hauptbahnhof", "directionName": null}

Message: "3k barmbek richtung ohlsdorf"
{"stationName": "Barmbek", "directionName": "Ohlsdorf"}

Message: "weiß jemand ob die s4 fährt?"
{"stationName": null, "directionName": null}

Message: "Hi, kann mir wer ein Ticket verkaufen?"
{"stationName": null, "directionName": null}
`

export const HAMBURG: CityConfig = {
    slug: 'hamburg',
    subdomain: 'hamburg',
    displayName: 'Hamburg',
    listed: false,
    dbName: CITY_DATABASES.hamburg.dbName,
    dbBinding: CITY_DATABASES.hamburg.dbBinding,
    lang: 'de',
    timezone: 'Europe/Berlin',
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
    telegram: {
        inspectorKeywords:
            'K (for example "3k" means three ticket inspectors), Kontrolleur, Kontrolleure, Kontrolle, Konti, Kontis, HVV-Kontrolle, Hochbahn-Kontrolle, Zivil, in Zivil, Prüfer, Fahrkartenkontrolle',
        untrackedLinesNote:
            'Sightings on OTHER lines (three-digit bus lines, night buses, express X-lines, ' +
            'regional trains, replacement services) are still reports if a station name is mentioned — ' +
            'extract the station (bus stops are named after the nearby U/S station).',
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
    community: {
        reporterCount: { min: 4_000, max: 5_000 },
    },
}
