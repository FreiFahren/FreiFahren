import { CITY_DATABASES } from './databases'
import type { CityConfig } from './types'

// Real messages from the Stuttgart group, none of them in the eval sample. They teach the
// "U2 Botnang gerade X" shape (line, terminus, then the station), the local short forms
// ("charlie", "uni", "lb") and that "zwischen A und B" means the stop it is heading to.
const promptExamples = `Message: "U1 nach Heslach, gleich am Wilhelmsplatz"
{"stationName": "Wilhelmsplatz", "directionName": "Heslach Vogelrain"}

Message: "u2 botnang gerade 5kontros bei vogelsang rein"
{"stationName": "Vogelsang", "directionName": "Botnang"}

Message: "U12 nach Dürrlewang  gerade Löwentor"
{"stationName": "Löwentor", "directionName": "Dürrlewang"}

Message: "S1 nach Kirchheim gerade neckarpark 4 Kontrolleure + 2 Security"
{"stationName": "Neckarpark", "directionName": "Kirchheim (Teck)"}

Message: "S2 Filderstadt gleich Uni zwei Kontros"
{"stationName": "Universität", "directionName": "Filderstadt"}

Message: "S2 nach Stuttgart gerade in Waiblingen 3 junge Kontrolleure"
{"stationName": "Waiblingen", "directionName": "Hauptbahnhof"}

Message: "S5 Richtung Bietigheim ist in lb"
{"stationName": "Ludwigsburg", "directionName": "Bietigheim-Bissingen"}

Message: "kontros am charlie gleis 4 Richtung remseck"
{"stationName": "Charlottenplatz", "directionName": "Remseck Neckargröningen"}

Message: "S5 Richtung Schwabstraße gerade zwischen Kornwestheim und Zuffenhausen Kontrolle"
{"stationName": "Zuffenhausen", "directionName": "Schwabstraße"}

Message: "Mind 6 Leute in der Zacke Richtung Degerloch"
{"stationName": null, "directionName": "Degerloch"}

Message: "U4 Endhaltestelle Untertürkheim / Großkontrolle mit allem drum und dran!"
{"stationName": "Untertürkheim", "directionName": null}

Message: "Kontrollettis in Uniform am bihlplatz Richtung stadteinwärts"
{"stationName": "Bihlplatz", "directionName": null}

Message: "die fahren bis an die endhaltestelle"
{"stationName": null, "directionName": null}

Message: "Stadtticket für LB gültig heute liegt im Automat Gleis 2/3 in LB. Wer's brauchen kann, bitteschön."
{"stationName": null, "directionName": null}
`

export const STUTTGART: CityConfig = {
    slug: 'stuttgart',
    subdomain: 'stuttgart',
    // Also the OSM boundary name the seed's Overpass area query matches on.
    displayName: 'Stuttgart',
    publicAppUrl: 'https://stuttgart.freifahren.org',
    listed: false,
    dbName: CITY_DATABASES.stuttgart.dbName,
    dbBinding: CITY_DATABASES.stuttgart.dbBinding,
    lang: 'de',
    timezone: 'Europe/Berlin',
    reporting: {
        telegramForwardingEnabled: false,
    },
    map: {
        center: [9.1829, 48.7758],
        zoom: 11,
        // S-Bahn Stuttgart extent [west, south, east, north]: Herrenberg, Kirchheim (Teck),
        // Schorndorf and Bietigheim.
        bounds: [8.8, 48.55, 9.6, 49.0],
        styleUrl: 'https://tiles.freifahren.org/styles/stuttgart.json',
    },
    tiles: {
        osmUrl: 'https://download.geofabrik.de/europe/germany/baden-wuerttemberg/stuttgart-regbez-latest.osm.pbf',
        clipToMapBounds: true,
    },
    seed: {
        adminLevel: '^6$',
        operators: ['Stuttgarter Straßenbahnen AG', 'SSB AG', 'DB Regio'],
        routeTypePriority: ['light_rail', 'tram', 'bus'],
        // The Stadtbahn is tagged light_rail like the S-Bahn, which comes in as train.
        osmRouteTypeAliases: { train: 'light_rail' },
        // DB Regio also runs the RE/RB lines here; only its S-Bahn is seeded. Tram 10 is the
        // Zacke; 21 and 23 are heritage and event lines. SSB buses run as two-digit lines and the X1.
        routeRefPatterns: {
            light_rail: String.raw`^[US]\d+$`,
            tram: String.raw`^10$`,
            bus: String.raw`^(\d{2}|X\d+)$`,
        },
        colors: {},
        defaultLineColor: '#000000',
        // DB names its S-Bahn stops "Stuttgart X"; the Stadtbahn stops next to them use the local
        // names. Renaming the DB side merges the pairs and drops the city prefix elsewhere.
        stationNameOverrides: {
            'Stuttgart Hauptbahnhof (tief)': 'Hauptbahnhof',
            'Hauptbahnhof (Arnulf-Klett-Platz)': 'Hauptbahnhof',
            'Stuttgart-Vaihingen': 'Vaihingen',
            'Stuttgart-Untertürkheim': 'Untertürkheim',
            'Untertürkheim Bf': 'Untertürkheim',
            'Stuttgart-Feuerbach': 'Feuerbach Bahnhof',
            'Stuttgart Stadtmitte': 'Stadtmitte',
            'Stuttgart Universität': 'Universität',
            'Stuttgart Flughafen/Messe': 'Flughafen/Messe',
            'Stuttgart Schwabstraße': 'Schwabstraße',
            'Stuttgart Nordbahnhof': 'Nordbahnhof',
            'Stuttgart-Zuffenhausen': 'Zuffenhausen',
            'Stuttgart Feuersee': 'Feuersee',
            'Stuttgart Österfeld': 'Österfeld',
            'Stuttgart-Rohr': 'Rohr',
            'Stuttgart-Obertürkheim': 'Obertürkheim',
            'Stuttgart Neuwirtshaus (Porscheplatz)': 'Neuwirtshaus (Porscheplatz)',
            'Stuttgart Neckarpark': 'Neckarpark',
            'Kornwestheim Personenbahnhof': 'Kornwestheim',
            // Otherwise merged into the S-Bahn's Bad Cannstatt, whose name it contains.
            'Bad Cannstatt Wilhelmsplatz': 'Wilhelmsplatz',
            'Leinf. Unteraichen': 'Leinfelden Unteraichen',
        },
        // Some stops carry VVS ids ("de:08111:5:1:2") in `ref`.
        stationCodeFromRef: false,
    },
    telegram: {
        inspectorKeywords:
            'Kontrolleure, Kontrolle, Kontros, Kontrolleur, Kontis, in Uniform, DB Uniform, DB Sicherheit, ' +
            'in Zivil, Zivis, SSB, Fahrkartenkontrolle, Security, Secus, Kontrolletis, Kontrollettis, Kontrollos, männlich/weiblich gelesen',
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
            [String.raw`\bcharlie\b`, 'charlottenplatz'],
            [String.raw`\buni\b`, 'universitat'],
            [String.raw`\blb\b`, 'ludwigsburg'],
            [String.raw`\bnordbhf\b`, 'nordbahnhof'],
            [String.raw`\bosi\b`, 'osterreichischer platz'],
            // Only when the whole name is the short form; the full station names contain these too.
            [String.raw`^liederhalle$`, 'berliner platz liederhalle'],
            [String.raw`^schwab[\s/-]*bebel\b`, 'schwab bebel'],
        ],
        promptExamples,
    },
    community: {},
}
