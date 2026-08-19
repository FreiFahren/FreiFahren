import type { CityConfig } from './types'
import { CITY_DATABASES } from './databases'

// Few-shot examples appended to the Telegram extraction prompt. Tuned to teach
// disambiguation the model gets wrong: slang names, direction-vs-station,
// all-clear messages, the implicit-direction case. Kept in German since the chat
// is mixed German/English.
const promptExamples = `Message: "Hi, kann mir wer ein Ticket verkaufen?"
{"stationName": null, "directionName": null}
`

export const HAMBURG: CityConfig = {
    slug: 'hamburg',
    subdomain: 'hamburg',
    displayName: 'Hamburg',
    // D1 databases can't be renamed and we don't migrate data, so Berlin keeps
    // the existing database and its `DB` binding.
    dbName: CITY_DATABASES.hamburg.dbName,
    dbBinding: CITY_DATABASES.hamburg.dbBinding,
    lang: 'de',
    timezone: 'Europe/Berlin',
    map: {
        center: [9.9937, 53.5511],
        zoom: 11,
        // Approximate S-Bahn-network extent [west, south, east, north].
        bounds: [9.727, 53.369, 10.348, 53.733],
        // styleUrl: 'https://tiles.freifahren.org/styles/hamburg.json',
        styleUrl: 'http://localhost:3000/styles/hamburg.json',
    },
    tiles: {
        osmUrl: 'https://download.geofabrik.de/europe/germany/hamburg-latest.osm.pbf',
    },
    seed: {
        adminLevel: '^4$',
        operators: [
            'Hamburger Hochbahn',
            'Hamburger Hochbahn AG',
            'S-Bahn Hamburg GmbH',
            // Bus operators in the outskirts:
            // 'Verkehrsbetriebe Hamburg-Holstein GmbH',
            // 'KVG Stade GmbH & Co. KG',
            // 'KVG Stade',
        ],
        // Bus is last: when a stop serves rail and bus, the rail type stays the
        // station's representative type (and wins the proximate-merge pick).
        // 'train' is not included here because that's only used for regional trains.
        routeTypePriority: ['subway', 'light_rail', 'bus'],
        // Hamburg's Metro Busses are one or two-digit numbers. Excluding most other 
        // bus lines are three-digit numbers, mostly 1xx and 2xx. Night bus lines are 
        // 6xx. Express lines start with "X".
        routeRefPatterns: { bus: String.raw`^\d{1,2}$` },
        colors: {
            light_rail: '#1A962B', // Hamburg S-Bahn green (S1), applied to all S-Bahn lines.
            bus: '#FA1E41', // HVV red, one shared color for all bus lines.
        },
        defaultLineColor: '#000000',
    },
    telegram: {
        inspectorKeywords: 'Kontrolleur, HVV-Kontrolle, Zivilkontrolle',
        untrackedLinesNote:
            'Sightings on OTHER lines (three-digit bus lines, night buses, ' +
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
        ],
        promptExamples,
    },
    community: {
        telegramHandle: '@FreiFahren_HH',
        reporterCount: { min: 20_000, max: 30_000 },
    },
}
