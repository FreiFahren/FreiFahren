import type { CityTelegramProfile } from './types'

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

/**
 * Berlin's Telegram extraction profile. NEVER import this from frontend code — it carries
 * report-extraction prompt engineering that must not ship in the client bundle. See the
 * warning on `PublicCityConfig` in ./types.ts.
 */
export const BERLIN_TELEGRAM: CityTelegramProfile = {
    inspectorKeywords: 'Kontrolleur, BVG-Kontrolle, BOS, BW, Blauwesten, Zivilkontrolle, blaue Westen',
    // MetroBus (M11-M85) IS tracked, so it must not be listed here; what stays
    // outside the network is the rest of the BVG bus system.
    untrackedLinesNote:
        'Sightings on OTHER lines (X-lines, three-digit bus lines, night buses, ' +
        'replacement services) are still reports if a station name is mentioned — ' +
        'extract the station (bus stops are named after the nearby U/S station).',
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
}
