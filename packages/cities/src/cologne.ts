import { CITY_DATABASES } from './databases'
import type { CityConfig } from './types'

// Real messages from the Köln group, none of them in the eval sample.
const promptExamples = `Message: "Kontrolle in der u18 Richtung Bonn gerade ebertplatz. Kontrolleur weiblich orangefarbener parker."
{"stationName": "Ebertplatz", "directionName": "Bonn Hauptbahnhof"}

Message: "Kontis in s19 Richtung Düren gleich Trimbornstraße"
{"stationName": "Trimbornstraße", "directionName": "Düren"}

Message: "Kontrolleurin Undercover in der 16 Richtung Niel Sebastianstraße. Nächste Station Dom HBF."
{"stationName": "Dom/Hbf", "directionName": "Niehl Sebastianstraße"}

Message: "4 kontros in uniform lanxess/deutz gehen zu u3/4"
{"stationName": "Bahnhof Deutz / LANXESS arena", "directionName": null}

Message: "RE 9 nach Siegen. Gerade Messe deutz los."
{"stationName": "Bf Deutz/Messe", "directionName": null}

Message: "s6 richtung ddorf kontros drin, grad köln hbf"
{"stationName": "Hauptbahnhof", "directionName": null}

Message: "RE 5 (RRX) Ri. Köln Hbf., gerade in Brühl losgefahren."
{"stationName": null, "directionName": "Hauptbahnhof"}

Message: "Kontrollierende im RB26 nach Sinzig, grad aus Köln Süd raus gefahren."
{"stationName": null, "directionName": null}

Message: "Bonn// 4 kotros am Bertha-von-Suttner-Platz an den Bussen Richtung Beuel"
{"stationName": null, "directionName": null}

Message: "Zwei Kontos am Rudolfplatz, Linien 12/15 unklar welche Richtung"
{"stationName": "Rudolfplatz", "directionName": null}

Message: "Richtung Bensberg"
{"stationName": null, "directionName": "Bensberg"}

Message: "fährt die 1 wieder bis weiden west?"
{"stationName": null, "directionName": null}
`

export const COLOGNE: CityConfig = {
    slug: 'cologne',
    subdomain: 'cologne',
    subdomainAliases: ['koeln'],
    // Also the OSM boundary name the seed's Overpass area query matches on.
    displayName: 'Köln',
    publicAppUrl: 'https://cologne.freifahren.org',
    listed: true,
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
            'extract the station. The group covers the whole VRS region, so RE/RB trains and ' +
            'Bonn often name places outside this network (Koblenz, Aachen, Wesel, Brühl, Köln Süd, ' +
            'Bonn bus stops): return null for those instead of a similar sounding Köln station.',
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
            // Regional trains name other cities' main stations ("RE5 nach Koblenz Hbf"); without this
            // they contain "hauptbahnhof" and snap onto Köln Hbf.
            [String.raw`^(?!(koln|kolner|bonn|dom)\b)[a-z'-]+\.?\s+hauptbahnhof\.?$`, ''],
        ],
        promptExamples,
    },
    community: {
        telegramChatId: '-1001360550269',
    },
}
