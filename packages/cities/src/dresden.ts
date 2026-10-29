import { CITY_DATABASES } from './databases'
import type { CityConfig } from './types'

// Real messages from the group's 2018-2019 export, none of them in the eval sample.
const promptExamples = `Message: "2 in der 6 Richtung Niedersedlitz. gerade an Lene-Glatzer-Straße"
{"stationName": "Lene-Glatzer-Straße", "directionName": "Niedersedlitz"}

Message: "2 kontrolleure in der 2 richtung gorbitz gerade pirnaischer platz"
{"stationName": "Pirnaischer Platz", "directionName": "Gorbitz, Betriebshof"}

Message: "K in der 42 Richtung bühlau, grade diakonissenkrankenhaus"
{"stationName": "Diakonissenkrankenhaus", "directionName": null}

Message: "2 k in der s1 von mitte nach hbf"
{"stationName": "Bahnhof Mitte", "directionName": "Hauptbahnhof"}

Message: "Sind postplatz raus"
{"stationName": "Postplatz", "directionName": null}

Message: "41 südvorstadt richtung stadt viele kontroleure"
{"stationName": null, "directionName": null}

Message: "4 Leute mit Klemmbrett."
{"stationName": null, "directionName": null}
`

export const DRESDEN: CityConfig = {
    slug: 'dresden',
    subdomain: 'dresden',
    // Also the OSM boundary name the seed's Overpass area query matches on.
    displayName: 'Dresden',
    publicAppUrl: 'https://dresden.freifahren.org',
    listed: false,
    dbName: CITY_DATABASES.dresden.dbName,
    dbBinding: CITY_DATABASES.dresden.dbBinding,
    lang: 'de',
    timezone: 'Europe/Berlin',
    reporting: {
        telegramForwardingEnabled: false,
    },
    map: {
        center: [13.7373, 51.0504],
        zoom: 11,
        // DVB trams and S-Bahn Dresden [west, south, east, north]: Meißen, Tharandt, Pirna and Bad Schandau.
        bounds: [13.45, 50.85, 14.2, 51.2],
        styleUrl: 'https://tiles.freifahren.org/styles/dresden.json',
    },
    tiles: {
        osmUrl: 'https://download.geofabrik.de/europe/germany/sachsen-latest.osm.pbf',
        clipToMapBounds: true,
    },
    seed: {
        adminLevel: '^6$',
        operators: ['DVB', 'DB Regio Südost'],
        // The S-Bahn runs on to Děčín and Freiberg; only the VVO core is seeded.
        stationBounds: [13.45, 50.85, 14.2, 51.2],
        routeTypePriority: ['light_rail', 'tram'],
        osmRouteTypeAliases: { train: 'light_rail' },
        // DB Regio Südost also runs the RE/RB lines; only its S-Bahn is seeded. OSM spells it "S 1".
        routeRefPatterns: { light_rail: String.raw`^S\s?\d+$` },
        colors: { light_rail: '#008D4F' },
        defaultLineColor: '#000000',
        // DB names its stops "Dresden-X" and a few DVB stops carry a "Dresden, " prefix; the stops
        // next to them use the plain local names. Renaming merges the pairs.
        stationNameOverrides: {
            'Dresden Hbf': 'Hauptbahnhof',
            'Dresden, Hauptbahnhof': 'Hauptbahnhof',
            'Dresden Mitte': 'Bahnhof Mitte',
            'Bahnhof Mitte / Könneritzstraße': 'Bahnhof Mitte',
            'Dresden-Neustadt': 'Bahnhof Neustadt',
            'Dresden, Angelikastraße': 'Angelikastraße',
            'Dresden, Blasewitzer Straße/Fetscherstraße': 'Blasewitzer Straße/Fetscherstraße',
            'Dresden, Walpurgisstraße': 'Walpurgisstraße',
            'Dresden Bischofsplatz': 'Bischofsplatz',
            'Dresden Freiberger Straße': 'Freiberger Straße',
            'Dresden Grenzstraße': 'Grenzstraße',
            'Dresden Industriegelände': 'Industriegelände',
            'Dresden Flughafen': 'Flughafen',
            'Dresden-Dobritz': 'Dobritz',
            'Dresden-Klotzsche': 'Klotzsche',
            'Dresden-Niedersedlitz': 'Niedersedlitz',
            'Dresden-Pieschen': 'Pieschen',
            'Dresden-Plauen': 'Plauen',
            'Dresden-Reick': 'Reick',
            'Dresden-Strehlen': 'Strehlen',
            'Dresden-Trachau': 'Trachau',
            'Dresden-Zschachwitz': 'Zschachwitz',
            // The merged stop takes its name from the exit-only platform otherwise.
            'Postplatz (Ausstieg)': 'Postplatz',
        },
    },
    telegram: {
        inspectorKeywords:
            'Kontrolleure, Kontrolle, Kontros, Kontrolleur, Kontis, in Uniform, DB Sicherheit, ' +
            'in Zivil, Zivis, K (short for Kontrolleur), Klemmbrett, DVB, Fahrkartenkontrolle, Security, männlich/weiblich gelesen',
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
            // Termini go by their district alone ("9 richtung kaditz", "11 bülau").
            [String.raw`^(kaditz|katiz|riegelplatz)$`, 'kaditz, riegelplatz'],
            [String.raw`^b(u|uh)lau$`, 'buhlau, ullersdorfer platz'],
            [String.raw`^(zschernitz|zschertnitz|zerschnitz)$`, 'zschertnitz, munzmeisterstrasse'],
            [String.raw`^klein\s?z?schachwitz$`, 'kleinzschachwitz, freystrasse'],
            [String.raw`^prohlis$`, 'prohlis, gleisschleife'],
            [String.raw`^weixdorf$`, 'weixdorf, rathenaustrasse'],
            [String.raw`^laubegast$`, 'laubegast, kronstadter platz'],
            [String.raw`^(hellerau|kiefernweg)$`, 'hellerau, kiefernweg'],
            [String.raw`^radebeul west$`, 'radebeul west, flemmingstrasse'],
            // Stops named after their street, shortened to the street's first word.
            [String.raw`^augsburger(\s+strasse)?$`, 'augsburger strasse (universitatsklinikum)'],
            [String.raw`^tharand?ter(\s+strasse)?$`, 'lobtau, tharandter strasse'],
            [String.raw`^nurnberger$`, 'nurnberger platz'],
            [
                String.raw`^bau(t)?zner(\s+strasse)?(\s*/\s*rothenburger(\s+strasse)?)?$`,
                'bautzner strasse / rothenburger strasse',
            ],
            [String.raw`^anton(strasse)?\s*/?\s*leipziger(\s+strasse)?$`, 'antonstrasse / leipziger strasse'],
            [String.raw`^rosa[\s-]luxemburg$`, 'rosa-luxemburg-platz'],
            [String.raw`^infin[ei]on\s+sud$`, 'infineon sud (abzweig nach hellerau)'],
        ],
        promptExamples,
    },
    community: {
        telegramChatId: '-1001342076099',
    },
}
