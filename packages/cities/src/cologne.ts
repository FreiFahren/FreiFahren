import { CITY_DATABASES } from './databases'
import type { CityConfig } from './types'

// Synthetic until there is a Köln group export to tune on, as Leipzig started out.
const promptExamples = `Message: "2 kontrolleure linie 3 neumarkt richtung thielenbruch"
{"stationName": "Neumarkt", "directionName": "Thielenbruch"}

Message: "s12 richtung horrem gerade köln messe/deutz 3 in db uniform"
{"stationName": "Bf Deutz/Messe", "directionName": "Horrem"}

Message: "16 Bonn gleich Barba, zwei in zivil"
{"stationName": "Barbarossaplatz", "directionName": "Bonn Hauptbahnhof"}

Message: "kvb kontrolle am ebertplatz bahnsteig 12/15"
{"stationName": "Ebertplatz", "directionName": null}

Message: "Sind Rudolfplatz ausgestiegen"
{"stationName": "Rudolfplatz", "directionName": null}

Message: "Richtung Bensberg"
{"stationName": null, "directionName": "Bensberg"}

Message: "zwei männlich gelesen, schwarze jacken"
{"stationName": null, "directionName": null}

Message: "fährt die 1 wieder bis weiden west?"
{"stationName": null, "directionName": null}
`

export const COLOGNE: CityConfig = {
    slug: 'cologne',
    subdomain: 'koeln',
    subdomainAliases: ['cologne'],
    // Also the OSM boundary name the seed's Overpass area query matches on.
    displayName: 'Köln',
    publicAppUrl: 'https://koeln.freifahren.org',
    listed: false,
    dbName: CITY_DATABASES.cologne.dbName,
    dbBinding: CITY_DATABASES.cologne.dbBinding,
    lang: 'de',
    timezone: 'Europe/Berlin',
    reporting: {
        telegramForwardingEnabled: false,
    },
    map: {
        center: [6.9583, 50.9413],
        zoom: 11,
        // KVB and S-Bahn Köln core [west, south, east, north]: Düren to Au (Sieg), Bonn to Langenfeld.
        bounds: [6.45, 50.7, 7.7, 51.12],
        styleUrl: 'https://tiles.freifahren.org/styles/cologne.json',
    },
    tiles: {
        osmUrl: 'https://download.geofabrik.de/europe/germany/nordrhein-westfalen/koeln-regbez-latest.osm.pbf',
        clipToMapBounds: true,
    },
    seed: {
        adminLevel: '^6$',
        operators: ['KVB', 'KVB;SWB', 'DB Regio NRW'],
        // The S6 runs on to Düsseldorf and Essen; those stops belong to Düsseldorf.
        stationBounds: [6.45, 50.7, 7.7, 51.12],
        routeTypePriority: ['light_rail', 'tram'],
        osmRouteTypeAliases: { train: 'light_rail' },
        // DB Regio NRW also runs the RE/RB lines through Köln; only its S-Bahn is seeded.
        routeRefPatterns: { light_rail: String.raw`^S\d+$` },
        // KVB and S-Bahn lines carry their VRS colours in OSM.
        colors: {},
        defaultLineColor: '#000000',
        // DB names its S-Bahn stops "Köln-X"; the KVB stops next to them use the local names.
        // Renaming the DB side merges the pairs and drops the city prefix elsewhere.
        stationNameOverrides: {
            'Köln Hauptbahnhof': 'Hauptbahnhof',
            'Köln Hansaring': 'Hansaring',
            'Köln Messe/Deutz (tief)': 'Bf Deutz/Messe',
            'Köln Messe/Deutz': 'Bf Deutz/Messe',
            'Köln-Mülheim': 'Bahnhof Mülheim',
            'Köln Geldernstraße/Parkgürtel': 'Geldernstraße/Parkgürtel',
            'Köln-Weiden West': 'Weiden West',
            'Köln-Chorweiler': 'Chorweiler',
            'Köln-Chorweiler Nord': 'Chorweiler Nord',
            'Köln-Dellbrück': 'Dellbrück',
            'Köln-Ehrenfeld': 'Ehrenfeld',
            'Köln-Nippes': 'Nippes',
            'Köln-Longerich': 'Longerich',
            'Köln-Worringen': 'Worringen',
            'Köln-Blumenberg': 'Blumenberg',
            'Köln-Buchforst': 'Buchforst',
            'Köln-Holweide': 'Holweide',
            'Köln-Stammheim': 'Stammheim',
            'Köln-Müngersdorf/Technologiepark': 'Müngersdorf/Technologiepark',
            'Köln Volkhovener Weg': 'Volkhovener Weg',
            'Köln Frankfurter Straße': 'Frankfurter Straße',
            'Köln Trimbornstraße': 'Trimbornstraße',
            'Köln Airport-Businesspark': 'Airport-Businesspark',
            'Bensberg U': 'Bensberg',
        },
    },
    telegram: {
        inspectorKeywords:
            'Kontrolleure, Kontrolle, Kontros, Kontrolleur, Kontis, in Uniform, DB Uniform, DB Sicherheit, ' +
            'in Zivil, Zivis, KVB, Fahrkartenkontrolle, Security, männlich/weiblich gelesen',
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
            [String.raw`\bbarba\b`, 'barbarossaplatz'],
            // "Dom/Hbf" is the KVB name of the Hauptbahnhof stop.
            [String.raw`^dom(\s*/\s*hauptbahnhof)?$`, 'hauptbahnhof'],
        ],
        promptExamples,
    },
    community: {},
}
