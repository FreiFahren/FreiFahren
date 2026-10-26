import { CITY_DATABASES } from './databases'
import type { CityConfig } from './types'

// Real messages from the group, none of them in the eval sample.
const promptExamples = `Message: "Min. 2 männlich gelesen in der 4 roderbruch grade nackenberg"
{"stationName": "Nackenberg", "directionName": "Roderbruch"}

Message: "Kontrolle 7 Misburg gerade kröpke rein. 5 männlich gelesene"
{"stationName": "Kröpcke", "directionName": "Misburg"}

Message: "4 männlich gelesene Kontrolletis in der 7 Wettbergen alle in Üstra uniform jetzt Lister Platz"
{"stationName": "Lister Platz", "directionName": "Wettbergen"}

Message: "11 richtung zoo jetzt ab Steintor"
{"stationName": "Steintor", "directionName": "Zoo"}

Message: "3 Männer gerade in 1 Langenhagen in aegi eingestiegen"
{"stationName": "Aegidientorplatz", "directionName": "Langenhagen"}

Message: "3 Typen in der 9 Richtung Hbf, gerade Bauweg raus"
{"stationName": "Bauweg", "directionName": "Hauptbahnhof"}

Message: "10 ZOB gleich glocksee"
{"stationName": "Glocksee", "directionName": "Hauptbahnhof"}

Message: "Linie 4 Richtung Garbsen, Höhe stadtfriedhof Stöcken"
{"stationName": "Stadtfriedhof Stöcken", "directionName": "Garbsen"}

Message: "Sind schwarzer Bär raus"
{"stationName": "Schwarzer Bär", "directionName": null}

Message: "Noltemeyerbrücke ausgestiegen"
{"stationName": "Noltemeyerbrücke", "directionName": null}

Message: "Linie 9, Richtung Empelde"
{"stationName": null, "directionName": "Empelde"}

Message: "drei männliche gelesene"
{"stationName": null, "directionName": null}
`

export const HANNOVER: CityConfig = {
    slug: 'hannover',
    subdomain: 'hannover',
    // Also the OSM boundary name the seed's Overpass area query matches on.
    displayName: 'Hannover',
    publicAppUrl: 'https://hannover.freifahren.org',
    listed: false,
    dbName: CITY_DATABASES.hannover.dbName,
    dbBinding: CITY_DATABASES.hannover.dbBinding,
    lang: 'de',
    timezone: 'Europe/Berlin',
    reporting: {
        telegramForwardingEnabled: false,
    },
    map: {
        center: [9.7386, 52.3745],
        zoom: 11,
        // Region Hannover and the S-Bahn as far as Hildesheim, Celle and Nienburg [west, south, east, north].
        bounds: [9.15, 52.1, 10.15, 52.68],
        styleUrl: 'https://tiles.freifahren.org/styles/hannover.json',
    },
    tiles: {
        osmUrl: 'https://download.geofabrik.de/europe/germany/niedersachsen-latest.osm.pbf',
        clipToMapBounds: true,
    },
    seed: {
        // The city sits at admin level 8 inside Region Hannover (6).
        adminLevel: '^8$',
        operators: ['ÜSTRA', 'Transdev Hannover GmbH', 'DB Regio AG Nord'],
        // S1 and S5 run on to Minden and Paderborn; those stops are out of scope.
        stationBounds: [9.15, 52.1, 10.15, 52.68],
        routeTypePriority: ['light_rail', 'tram'],
        osmRouteTypeAliases: { train: 'light_rail' },
        // DB Regio AG Nord runs RE1 too; only the Stadtbahn and S-Bahn are seeded.
        routeRefPatterns: { light_rail: String.raw`^(\d+|S\d+)$` },
        colors: {},
        defaultLineColor: '#000000',
        // DB names its S-Bahn stops "Hannover-X"; the Stadtbahn stops next to them are "Bahnhof X".
        // Renaming the DB side merges the pairs and drops the city prefix elsewhere.
        stationNameOverrides: {
            'Hannover Hauptbahnhof': 'Hauptbahnhof',
            'Hannover Karl-Wiechert-Allee': 'Bahnhof Karl-Wiechert-Allee',
            'Hannover-Linden/Fischerhof': 'Bahnhof Linden/Fischerhof',
            'Hannover-Leinhausen': 'Bahnhof Leinhausen',
            'Hannover-Nordstadt': 'Bahnhof Nordstadt',
            'Hannover Anderten/Misburg': 'Anderten/Misburg',
            'Hannover-Bornum': 'Bornum',
            'Hannover-Kleefeld': 'Kleefeld',
            'Hannover Bismarckstraße': 'Bismarckstraße',
            'Hannover-Vinnhorst': 'Vinnhorst',
            'Hannover-Ledeburg': 'Ledeburg',
            'Hannover Messe/Laatzen': 'Messe/Laatzen',
            'Hannover Flughafen': 'Flughafen',
            // One S-Bahn stop under three names in OSM, one of them misspelt.
            'Langenhagen-Kaltenweide': 'Kaltenweide',
            'Langanhagen Kaltenweide': 'Kaltenweide',
            'Kaltenweide Bahnhof': 'Kaltenweide',
        },
        // Some stops carry GVH stop numbers ("4311;4312") in `ref`.
        stationCodeFromRef: false,
    },
    telegram: {
        inspectorKeywords:
            'Kontrolleure, Kontrolle, Kontros, Kontrolleur, Kontis, in Uniform, DB Uniform, DB Sicherheit, ' +
            'in Zivil, Zivis, ÜSTRA, Protec, Prüfer, Fahrkartenkontrolle, Security, männlich/weiblich gelesen',
        untrackedLinesNote:
            'Lines are often given as a bare number ("die 9", "in der 4"); those are Stadtbahn lines. ' +
            'Sightings on OTHER lines (bus lines, night lines, regional trains, replacement services) ' +
            'are still reports if a station name is mentioned: extract the station.',
        circularLineAlias: '',
        circularLinePattern: '',
        abbreviations: [
            [String.raw`straße`, 'strasse'],
            [String.raw`str\.?(?=\s|$|\/|,|\)|-)`, 'strasse'],
            [String.raw`str$`, 'strasse'],
            [String.raw`\bbhf\.?\b`, 'bahnhof'],
            [String.raw`\bhbf\.?\b`, 'hauptbahnhof'],
            [String.raw`\bpl\.?\b`, 'platz'],
            [String.raw`\baegi\b`, 'aegidientorplatz'],
            [String.raw`\bkropke\b`, 'kropcke'],
            [String.raw`\bkuga\b`, 'kuchengarten'],
            [String.raw`\bkowo\b`, 'konigsworther platz'],
            [String.raw`\bschw\.?\s+bar\b`, 'schwarzer bar'],
            // The bus station next to the Hauptbahnhof, also the 10's terminus.
            [String.raw`^(hauptbahnhof\s*/?\s*)?zob$`, 'hauptbahnhof'],
            [String.raw`\bndsring\b`, 'niedersachsenring'],
        ],
        promptExamples,
    },
    community: {},
}
