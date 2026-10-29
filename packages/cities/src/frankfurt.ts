import { CITY_DATABASES } from './databases'
import type { CityConfig } from './types'

// Mostly synthetic: the 069land export only reaches back two messages, both used here.
const promptExamples = `Message: "2 kontrolleure u4 konsti richtung enkheim"
{"stationName": "Konstablerwache", "directionName": "Enkheim"}

Message: "s8 richtung wiesbaden gerade hauptwache 3 in db uniform"
{"stationName": "Hauptwache", "directionName": "Wiesbaden Hauptbahnhof"}

Message: "U6 Hausen gleich Zoo, zwei in zivil"
{"stationName": "Zoo", "directionName": "Hausen"}

Message: "tram 16 südbahnhof richtung ginnheim kontrolle"
{"stationName": "Südbahnhof", "directionName": "Ginnheim Mitte"}

Message: "U1238 Miquel stadteinwärts, 3 in Uniform"
{"stationName": "Miquel-/Adickesallee", "directionName": "Südbahnhof"}

Message: "S4 nach Süd, gleich Eschborn Süd vorderer Wagen"
{"stationName": "Eschborn Süd", "directionName": "Südbahnhof"}

Message: "kontis an der bockenheimer warte bahnsteig u6"
{"stationName": "Bockenheimer Warte", "directionName": null}

Message: "Sind Willy-Brandt-Platz ausgestiegen"
{"stationName": "Willy-Brandt-Platz", "directionName": null}

Message: "Richtung Südbahnhof"
{"stationName": null, "directionName": "Südbahnhof"}

Message: "zwei männlich gelesen, schwarze jacken"
{"stationName": null, "directionName": null}

Message: "fährt die u5 wieder bis preungesheim?"
{"stationName": null, "directionName": null}
`

export const FRANKFURT: CityConfig = {
    slug: 'frankfurt',
    subdomain: 'frankfurt',
    displayName: 'Frankfurt',
    publicAppUrl: 'https://frankfurt.freifahren.org',
    listed: false,
    dbName: CITY_DATABASES.frankfurt.dbName,
    dbBinding: CITY_DATABASES.frankfurt.dbBinding,
    lang: 'de',
    timezone: 'Europe/Berlin',
    reporting: {
        telegramForwardingEnabled: false,
    },
    map: {
        center: [8.679, 50.114],
        zoom: 11,
        // Approximate S-Bahn Rhein-Main extent [west, south, east, north]: Wiesbaden, Mainz,
        // Darmstadt, Hanau and Friedberg.
        bounds: [8.15, 49.83, 9.05, 50.37],
        styleUrl: 'https://tiles.freifahren.org/styles/frankfurt.json',
    },
    tiles: {
        osmUrl: 'https://download.geofabrik.de/europe/germany/hessen-latest.osm.pbf',
        // Mainz, on S8, is across the border in Rhineland-Palatinate.
        extraOsmUrls: ['https://download.geofabrik.de/europe/germany/rheinland-pfalz-latest.osm.pbf'],
        clipToMapBounds: true,
    },
    seed: {
        osmAreaName: 'Frankfurt am Main',
        adminLevel: '^6$',
        operators: ['VGF', 'DB S-Bahn Rhein-Main', 'In-der-City-Bus', 'Transdev Rhein-Main', 'DB Regio Bus Mitte'],
        routeTypePriority: ['subway', 'light_rail', 'tram', 'bus'],
        osmRouteTypeAliases: { train: 'light_rail' },
        // MetroBus only, as in Berlin. The bus operators are listed for their M lines.
        routeRefPatterns: { bus: String.raw`^M\d+$` },
        // U and S lines carry their RMV colours in OSM; trams and buses have none.
        colors: {
            tram: '#be1414',
            bus: '#95276E',
        },
        defaultLineColor: '#000000',
        // The Ebbelwei-Express is a sightseeing tram.
        excludeLineRefPatterns: [String.raw`^EEx$`],
        // DB names its S-Bahn stops "Frankfurt-X"; the tram and bus stops next to them use the
        // local names. Renaming the DB side merges the pairs and drops the city prefix elsewhere.
        stationNameOverrides: {
            'Frankfurt am Main West': 'Westbahnhof',
            'Frankfurt (Main) Süd': 'Südbahnhof',
            'Frankfurt-Louisa': 'Louisa Bahnhof',
            'Frankfurt-Niederrad': 'Niederrad Bahnhof',
            'Frankfurt-Zeilsheim': 'Zeilsheim Bahnhof',
            'Frankfurt am Main Sindlingen': 'Sindlingen Bahnhof',
            'Frankfurt-Eschersheim': 'Eschersheim Bahnhof',
            'Frankfurt-Rödelheim': 'Rödelheim Bahnhof',
            'Frankfurt-Höchst': 'Höchst Bahnhof',
            'Frankfurt am Main Messe': 'Messe',
            'Frankfurt am Main Stadion': 'Stadion',
            'Frankfurt (Main) Galluswarte': 'Galluswarte',
            'Frankfurt-Berkersheim': 'Berkersheim',
            'Frankfurt Frankfurter Berg': 'Frankfurter Berg',
            'Frankfurt-Höchst Farbwerke': 'Farbwerke',
            'Frankfurt-Gateway Gardens': 'Gateway Gardens',
            'Frankfurt am Main Flughafen Regionalbahnhof': 'Flughafen Regionalbahnhof',
            'Hanau Hbf': 'Hanau Hauptbahnhof',
            'Wiesbaden Hbf': 'Wiesbaden Hauptbahnhof',
        },
        // Stops carry platform letters and U3 abbreviations ("C", "HM") in `ref`.
        stationCodeFromRef: false,
    },
    telegram: {
        inspectorKeywords:
            'Kontrolleure, Kontrolle, Kontros, Kontrolleur, Kontis, in Uniform, DB Uniform, DB Sicherheit, ' +
            'in Zivil, Zivis, VGF, Fahrkartenkontrolle, Security, männlich/weiblich gelesen',
        untrackedLinesNote:
            'Sightings on OTHER lines (regular bus lines, night lines, regional trains, ' +
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
            [String.raw`\bkonsti\b`, 'konstablerwache'],
            [String.raw`\bsudbf\b`, 'sudbahnhof'],
        ],
        promptExamples,
    },
    community: {
        telegramChatId: '-1001466597831',
    },
}
