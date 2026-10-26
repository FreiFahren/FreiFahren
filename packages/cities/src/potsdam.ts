import { CITY_DATABASES } from './databases'
import type { CityConfig } from './types'

// Synthetic until there is a group export to tune on, as Leipzig started out.
const promptExamples = `Message: "2 kontrolleure in der 91 richtung bahnhof rehbrücke gerade platz der einheit"
{"stationName": "Platz der Einheit/West", "directionName": "Bahnhof Rehbrücke"}

Message: "s7 richtung ahrensfelde gerade babelsberg 3 in db uniform"
{"stationName": "Babelsberg", "directionName": null}

Message: "Sind Hauptbahnhof ausgestiegen"
{"stationName": "Hauptbahnhof", "directionName": null}

Message: "zwei männlich gelesen, schwarze jacken"
{"stationName": null, "directionName": null}
`

export const POTSDAM: CityConfig = {
    slug: 'potsdam',
    subdomain: 'potsdam',
    // Also the OSM boundary name the seed's Overpass area query matches on.
    displayName: 'Potsdam',
    publicAppUrl: 'https://potsdam.freifahren.org',
    listed: false,
    dbName: CITY_DATABASES.potsdam.dbName,
    dbBinding: CITY_DATABASES.potsdam.dbBinding,
    lang: 'de',
    timezone: 'Europe/Berlin',
    reporting: {
        telegramForwardingEnabled: false,
    },
    map: {
        center: [13.0645, 52.3906],
        zoom: 11,
        // ViP tram network and the S7 up to Griebnitzsee [west, south, east, north]; Wannsee is Berlin.
        bounds: [12.88, 52.33, 13.15, 52.46],
        styleUrl: 'https://tiles.freifahren.org/styles/potsdam.json',
    },
    tiles: {
        osmUrl: 'https://download.geofabrik.de/europe/germany/brandenburg-latest.osm.pbf',
        clipToMapBounds: true,
    },
    seed: {
        adminLevel: '^6$',
        operators: ['ViP Verkehrsbetrieb Potsdam GmbH', 'Verkehrsbetrieb Potsdam GmbH', 'S-Bahn Berlin GmbH'],
        // The S7 runs on through Berlin to Ahrensfelde; only its Potsdam stops are seeded.
        stationBounds: [12.88, 52.33, 13.15, 52.46],
        routeTypePriority: ['light_rail', 'tram', 'bus'],
        // ViP buses run as three-digit lines and the X lines; night lines start with N.
        routeRefPatterns: { bus: String.raw`^(\d{3}|X\d+)$` },
        colors: { light_rail: '#008D4F', tram: '#be1414' },
        defaultLineColor: '#000000',
        stationNameOverrides: { 'Potsdam Hauptbahnhof': 'Hauptbahnhof' },
    },
    telegram: {
        inspectorKeywords:
            'Kontrolleure, Kontrolle, Kontros, Kontrolleur, Kontis, in Uniform, DB Sicherheit, ' +
            'in Zivil, Zivis, ViP, Fahrkartenkontrolle, Security, männlich/weiblich gelesen',
        untrackedLinesNote:
            'Sightings on OTHER lines (night lines, regional trains, ' +
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
