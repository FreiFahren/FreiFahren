import { CITY_DATABASES } from './databases'
import type { CityConfig } from './types'

// Real messages from the group's export, none of them in the eval sample.
const promptExamples = `Message: "S2 Spöck, gerade am Gottesauer Platz"
{"stationName": "Gottesauer Platz/BGV", "directionName": "Spöck Hochhaus"}

Message: "S11 hochstetten 3 bigs. Gerade hbf"
{"stationName": "Hauptbahnhof", "directionName": "Hochstetten Altenheim"}

Message: "3 K in der 1 Richtung Durlach auf Höhe Euro"
{"stationName": "Europaplatz (U)", "directionName": "Durlach Turmberg"}

Message: "2 stück in der S5 Richtung pforzheim am kronenplatz"
{"stationName": "Kronenplatz (U)", "directionName": null}

Message: "2 am hbf, s steig stadteinwärts"
{"stationName": "Hauptbahnhof", "directionName": null}

Message: "Männlich gelesen,  weiße Haare in zivil"
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
            // Termini go by their district alone ("1 Richtung Heide", "S2 Spöck").
            [String.raw`^(neureut[\s-])?heide$`, 'neureut-heide'],
            [String.raw`^hochstetten$`, 'hochstetten altenheim'],
            [String.raw`^durlach$`, 'durlach turmberg'],
            [String.raw`^knielingen$`, 'knielingen nord'],
            [String.raw`^ober+eu[rt]$`, 'oberreut zentrum'],
            [String.raw`^wolfartswei(h)?er$`, 'wolfartsweier nord'],
            [String.raw`^waldstadt$`, 'waldstadt zentrum'],
            [String.raw`^ittersbach$`, 'ittersbach rathaus'],
            [String.raw`^spock$`, 'spock hochhaus'],
            [String.raw`^sollingen$`, 'sollingen (pfinztal)'],
            [String.raw`^berghausen$`, 'berghausen (baden)'],
            [String.raw`^rheinstetten$`, 'morsch bach west'],
            [String.raw`^(ka|karlsruhe)$`, 'hauptbahnhof'],
            // Regional destinations outside the seeded area would otherwise match "Hauptbahnhof".
            [String.raw`^(pforzheim|mannheim|speyer|heidelberg|stuttgart|germersheim)\b.*`, ''],
            // No longer a stop, and it would match Herweghstraße.
            [String.raw`^herrenstrasse$`, ''],
            // Stops shortened to their first word.
            [String.raw`^euro$`, 'europaplatz (u)'],
            [String.raw`^tulla(\s+strasse)?$`, 'tullastrasse/alter schlachthof'],
            [String.raw`^bgv$`, 'gottesauer platz/bgv'],
            [String.raw`^werder$`, 'werderstrasse'],
            [
                String.raw`^(auer(\s*strasse)?\s*/?\s*)?(dr\.?\s*)?will?mar\s*schwabe$`,
                'auer strasse/dr. willmar schwabe',
            ],
            [String.raw`^auer\s*strasse$`, 'auer strasse/dr. willmar schwabe'],
        ],
        promptExamples,
    },
    community: {},
}
