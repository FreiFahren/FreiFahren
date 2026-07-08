import type { CityConfig } from './types'

// Few-shot examples appended to the Telegram extraction prompt. Tuned to teach
// disambiguation the model gets wrong: slang names, direction-vs-station,
// all-clear messages, the implicit-direction case. Kept in German since the chat
// is mixed German/English.
const promptExamples = `Message: "U2 alex hab in dem bahnstation gesehen"
{"stationName": "Alex", "directionName": null}

Message: "3x kotti u3 am Gleis"
{"stationName": "Kottbusser Tor", "directionName": null}

Message: "gorli u1/u3 3 Männer"
{"stationName": "Görlitzer Bahnhof", "directionName": null}

Message: "U7 Rathaus Spandau Richt Rudow Höhe sbhf Neukölln 4 Mann BOS"
{"stationName": "Neukölln", "directionName": "Rudow"}

Message: "u 8 wittenau in blauen westen höhe osloer"
{"stationName": "osloer", "directionName": "wittenau"}

Message: "Gesundbrunnen clean on u8"
{"stationName": "Gesundbrunnen", "directionName": null}

Message: "M29 bus moritzplatz"
{"stationName": "Moritzplatz", "directionName": null}

Message: "3 Bos Jacken M29 Anhalter Bahnhof Richtung Hermannplatz"
{"stationName": "Anhalter Bahnhof", "directionName": "Hermannplatz"}

Message: "S3 nach ostbahnof"
{"stationName": null, "directionName": "Ostbahnhof"}

Message: "To Rathaus SPANDAU"
{"stationName": null, "directionName": "Rathaus Spandau"}

Message: "U7 Rathaus Neukölln 3x BOS just got off the train"
{"stationName": "Rathaus Neukölln", "directionName": null}

Message: "U6 Kaiserin Augusta 2x bos"
{"stationName": "Kaiserin-Augusta-Straße", "directionName": null}

Message: "Zoo Richtung Steglitz"
{"stationName": "Zoo", "directionName": "Steglitz"}

Message: "Hi, kann mir wer ein Ticket verkaufen?"
{"stationName": null, "directionName": null}
`

export const BERLIN: CityConfig = {
    slug: 'berlin',
    subdomain: 'berlin',
    displayName: 'Berlin',
    // D1 databases can't be renamed and we don't migrate data, so Berlin keeps
    // the existing database and its `DB` binding.
    dbName: 'api-worker-db-eu',
    dbBinding: 'DB',
    lang: 'de',
    map: {
        center: [13.388, 52.5162],
        zoom: 11,
        // Approximate S-Bahn-network extent [west, south, east, north].
        bounds: [13.088, 52.338, 13.761, 52.675],
        styleUrl: 'https://tiles.freifahren.org/styles/berlin.json',
    },
    tiles: {
        osmUrl: 'https://download.geofabrik.de/europe/germany/berlin-latest.osm.pbf',
    },
    seed: {
        adminLevel: '^[4-6]$',
        operators: ['Berliner Verkehrsbetriebe', 'S-Bahn Berlin GmbH'],
        // Bus is last: when a stop serves rail and bus, the rail type stays the
        // station's representative type (and wins the proximate-merge pick).
        routeTypePriority: ['subway', 'tram', 'light_rail', 'train', 'bus'],
        // MetroBus (M11–M85) only: BVG runs ~300 bus lines, but only the Metro
        // network is frequent enough to be checked/reported in practice.
        routeRefPatterns: { bus: String.raw`^M\d+$` },
        colors: {
            tram: '#be1414', // Classic Berlin tram red (tram and metro tram M* lines).
            light_rail: '#007734', // Berlin S-Bahn green (S2), applied to all S-Bahn lines.
            bus: '#95276E', // VBB MetroBus purple, one shared color for all bus lines.
        },
        defaultLineColor: '#000000',
    },
    telegram: {
        inspectorKeywords: 'Kontrolleur, BVG-Kontrolle, BOS, BW, Blauwesten, Zivilkontrolle, blaue Westen',
        circularLineAlias: 'Ringbahn',
        circularLinePattern: String.raw`(?<![A-Za-z])(?:s[-\s]?)?ring(?:bahn)?`,
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
    community: {
        telegramHandle: '@FreiFahren_BE',
    },
}
