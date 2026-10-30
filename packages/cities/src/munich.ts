import { CITY_DATABASES } from './databases'
import type { CityConfig } from './types'

// Real phrasings from the München group, none of them part of the eval sample. Riders mostly
// write "<line> <terminus> <now> <station>" without "Richtung", so most examples teach that.
const promptExamples = `Message: "S1 Freising gerade Marienplatz wird kontrolliert"
{"stationName": "Marienplatz", "directionName": "Freising"}

Message: "S3 Mammendorf\ngleich Hirschgarten\nmind. 4 uniformierte.\nvorderes abteil"
{"stationName": "Hirschgarten", "directionName": "Mammendorf"}

Message: "U3 fürstenreidwest jz machtlfinger 3 mal männlich grad ganz vorne"
{"stationName": "machtlfinger", "directionName": "fürstenreidwest"}

Message: "U6 Studentenstadt Ri. Sendlinger Tor 2 Zivile mit basecaps."
{"stationName": "Studentenstadt", "directionName": "Sendlinger Tor"}

Message: "Kontrolle U5 Neuperlach Süd vier männliche Kontrolletis. Sind am Stachus raus."
{"stationName": "Stachus", "directionName": "Neuperlach Süd"}

Message: "S3 Stadteinwärts gerade Donnersbergerbrücke. DB Uniform"
{"stationName": "Donnersbergerbrücke", "directionName": null}

Message: "Tram 17 Richtung Amalienburgstraße, die gerade an der Donnersberger Brücke war"
{"stationName": "Donnersberger Brücke", "directionName": "Amalienburgstraße"}

Message: "Bus 58 Richtung Ostbahnhof. Vier Personen bin zivil. Gleich Kolumbusplatz"
{"stationName": "Kolumbusplatz", "directionName": "Ostbahnhof"}

Message: "u2 richtung feldmoching 3x ubahn wache am scheidplatz steigen ganz hinten ein"
{"stationName": "scheidplatz", "directionName": "feldmoching"}

Message: "Sind Implerstr ausgestiegen"
{"stationName": "Implerstr", "directionName": null}

Message: "Richtung ostbahnhof"
{"stationName": null, "directionName": "ostbahnhof"}

Message: "Zwei männl gelesen, db Klamotten und gelbe Westen"
{"stationName": null, "directionName": null}

Message: "Ganz vorne"
{"stationName": null, "directionName": null}

Message: "Sind heute welche unterwegs ? Richtig U3 wisst ihr was ?"
{"stationName": null, "directionName": null}
`

export const MUNICH: CityConfig = {
    slug: 'munich',
    subdomain: 'muenchen',
    subdomainAliases: ['munich'],
    // Also the OSM boundary name the seed's Overpass area query matches on.
    displayName: 'München',
    publicAppUrl: 'https://muenchen.freifahren.org',
    listed: true,
    dbName: CITY_DATABASES.munich.dbName,
    dbBinding: CITY_DATABASES.munich.dbBinding,
    lang: 'de',
    timezone: 'Europe/Berlin',
    reporting: {
        telegramForwardingEnabled: false,
    },
    map: {
        center: [11.5755, 48.1374],
        zoom: 11,
        // Approximate S-Bahn-network extent [west, south, east, north].
        bounds: [11.0, 47.85, 12.0, 48.45],
        styleUrl: 'https://tiles.freifahren.org/styles/munich.json',
    },
    tiles: {
        // No Munich-only Geofabrik extract exists, so Upper Bavaria is cropped to the S-Bahn extent.
        osmUrl: 'https://download.geofabrik.de/europe/germany/bayern/oberbayern-latest.osm.pbf',
        clipToMapBounds: true,
    },
    seed: {
        adminLevel: '^6$',
        operators: ['Münchner Verkehrsgesellschaft', 'DB Regio AG/S-Bahn München'],
        routeTypePriority: ['subway', 'light_rail', 'tram', 'bus'],
        osmRouteTypeAliases: { train: 'light_rail' },
        // MetroBus (50-63) and ExpressBus (X30-X36) only, as in Berlin: the ~70 three-digit
        // StadtBus lines would multiply the network for lines that are rarely checked.
        routeRefPatterns: { bus: String.raw`^(\d{2}|X\d+)$` },
        // Empty on purpose: U-Bahn, S-Bahn and tram lines all carry their official MVV
        // per-line colour in OSM.
        colors: {},
        defaultLineColor: '#000000',
        // Night lines and the E-prefixed tram reinforcement services duplicate day routes; 97 is
        // a Gasteig parking shuttle.
        excludeLineRefPatterns: [String.raw`^N`, String.raw`^E\d+$`, String.raw`^97$`],
        // DB names its platforms "München …", MVG and riders don't.
        stationNameOverrides: {
            'München Ost': 'Ostbahnhof',
            'München-Pasing': 'Pasing',
            'München Hbf Gleis 27-36, Starnberger Bahnhof': 'Hauptbahnhof (Starnberger Bahnhof)',
        },
        // MVG puts line and track numbers in `ref` ("U3;U6", "6/4"), not station codes.
        stationCodeFromRef: false,
    },
    telegram: {
        // Ordered by frequency in the München group export. Police terms (Polizei, Cops) are
        // left out on purpose, as in Leipzig: they are not ticket checks.
        inspectorKeywords:
            'Kontrolleure, Kontrolle, Kontros, Kontrolleur, in Uniform, DB Uniform, DB Sicherheit, ' +
            'in Zivil, uniformierte, Kontrolletis, Kontrollis, Zivis, Security, Secus, U-Bahn-Wache, ' +
            'Kontis, männlich/weiblich gelesen',
        untrackedLinesNote:
            'Sightings on OTHER lines (three-digit bus lines, night lines, regional trains, ' +
            'replacement services) are still reports if a station name is mentioned — ' +
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
            [String.raw`\boez\b`, 'olympia-einkaufszentrum'],
            [String.raw`\btwiese\b`, 'theresienwiese'],
            // DB's names for the stations seeded under their MVG names (see seed.stationNameOverrides).
            [String.raw`\bmunchen[\s-]+ost\b`, 'ostbahnhof'],
            [String.raw`\bmunchen[\s-]+pasing\b`, 'pasing'],
        ],
        promptExamples,
    },
    community: {
        telegramChatId: '-1001394169627',
    },
}
