import { CITY_DATABASES } from './databases'
import type { CityConfig } from './types'

// Synthetic until there is a group export to tune on, as Leipzig started out.
const promptExamples = `Message: "2 kontrolleure u79 heinrich-heine-allee richtung duisburg"
{"stationName": "Heinrich-Heine-Allee", "directionName": "Duisburg Hauptbahnhof"}

Message: "709 Richtung Gerresheim gerade Graf-Adolf-Platz"
{"stationName": "Graf-Adolf-Platz", "directionName": "Gerresheim Krankenhaus"}

Message: "Sind Hbf ausgestiegen"
{"stationName": "Hauptbahnhof", "directionName": null}

Message: "zwei männlich gelesen, schwarze jacken"
{"stationName": null, "directionName": null}
`

export const DUESSELDORF: CityConfig = {
    slug: 'duesseldorf',
    subdomain: 'duesseldorf',
    subdomainAliases: ['dusseldorf'],
    // Also the OSM boundary name the seed's Overpass area query matches on.
    displayName: 'Düsseldorf',
    publicAppUrl: 'https://duesseldorf.freifahren.org',
    listed: false,
    dbName: CITY_DATABASES.duesseldorf.dbName,
    dbBinding: CITY_DATABASES.duesseldorf.dbBinding,
    lang: 'de',
    timezone: 'Europe/Berlin',
    reporting: {
        telegramForwardingEnabled: false,
    },
    map: {
        center: [6.7763, 51.2277],
        zoom: 11,
        // Rheinbahn and S-Bahn core [west, south, east, north]: Krefeld, Duisburg, Ratingen, Benrath and Neuss.
        bounds: [6.55, 51.1, 7.0, 51.44],
        styleUrl: 'https://tiles.freifahren.org/styles/duesseldorf.json',
    },
    tiles: {
        osmUrl: 'https://download.geofabrik.de/europe/germany/nordrhein-westfalen/duesseldorf-regbez-latest.osm.pbf',
        clipToMapBounds: true,
    },
    seed: {
        adminLevel: '^6$',
        operators: ['Rheinbahn', 'Rheinbahn;DVG', 'DB Regio NRW', 'Regiobahn'],
        // The S-Bahn lines run on to Köln, Essen and Wuppertal; those stops are left out.
        stationBounds: [6.55, 51.1, 7.0, 51.44],
        routeTypePriority: ['subway', 'light_rail', 'tram'],
        osmRouteTypeAliases: { train: 'light_rail' },
        // DB Regio NRW also runs the RE/RB lines; only its S-Bahn is seeded.
        routeRefPatterns: { light_rail: String.raw`^S\d+$` },
        // The U lines carry their Rheinbahn colours in OSM; the trams and half the S-Bahn have none.
        colors: { light_rail: '#008D4F', tram: '#be1414' },
        defaultLineColor: '#000000',
        // DB names its S-Bahn stops "Düsseldorf-X"; the Rheinbahn stops next to them are "X S".
        // Renaming the DB side merges the pairs and drops the city prefix elsewhere.
        stationNameOverrides: {
            'Düsseldorf Hauptbahnhof': 'Hauptbahnhof',
            'Düsseldorf-Bilk': 'Bilk S',
            'Düsseldorf-Derendorf': 'Derendorf S',
            'Düsseldorf Zoo': 'Zoo S',
            'Düsseldorf Wehrhahn': 'Wehrhahn S',
            'Düsseldorf Volksgarten': 'Volksgarten S',
            'Düsseldorf-Flingern': 'Flingern S',
            'Düsseldorf-Oberbilk': 'Oberbilk S',
            'Düsseldorf-Unterrath': 'Unterrath S',
            'Düsseldorf-Eller Mitte': 'Eller Mitte S',
            'Düsseldorf-Rath': 'Rath S',
            'Düsseldorf-Rath Mitte': 'Rath Mitte S',
            'Düsseldorf-Rath Mitte S': 'Rath Mitte S',
            'Düsseldorf-Gerresheim': 'Gerresheim S',
            'Düsseldorf-Benrath': 'Benrath S',
            'Düsseldorf Völklinger Straße': 'Völklinger Straße S',
            'Düsseldorf-Friedrichstadt': 'Friedrichstadt S',
            'Düsseldorf-Hamm': 'Hamm',
            'Düsseldorf-Eller': 'Eller',
            'Düsseldorf-Eller Süd': 'Eller Süd',
            'Düsseldorf-Garath': 'Garath',
            'Düsseldorf-Hellerhof': 'Hellerhof',
            'Düsseldorf-Reisholz': 'Reisholz',
            'Düsseldorf-Lörick': 'Lörick',
            'Düsseldorf-Hubertushain': 'Hubertushain',
            'Düsseldorf Engerstraße': 'Engerstraße',
            'Düsseldorf Grunerstraße': 'Grunerstraße',
            'Düsseldorf Hansaplatz': 'Hansaplatz',
            'Düsseldorf Lindemannstraße': 'Lindemannstraße',
            'Düsseldorf Schumannstraße': 'Schumannstraße',
            // Two stations about 2 km apart: the S11/U80 terminal stop and the long-distance one on the S1.
            'D-Flughafen Terminal S U': 'Flughafen Terminal',
            'Düsseldorf Flughafen': 'Flughafen Fernbahnhof',
            'Duisburg Hauptbahnhof U': 'Duisburg Hauptbahnhof',
            'Neuss Hbf': 'Neuss Hauptbahnhof',
            'Krefeld Hbf': 'Krefeld Hauptbahnhof',
        },
    },
    telegram: {
        inspectorKeywords:
            'Kontrolleure, Kontrolle, Kontros, Kontrolleur, Kontis, in Uniform, DB Sicherheit, ' +
            'in Zivil, Zivis, Rheinbahn, Fahrkartenkontrolle, Security, männlich/weiblich gelesen',
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
