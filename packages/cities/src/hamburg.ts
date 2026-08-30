import type { CityConfig } from './types'
import { CITY_DATABASES } from './databases'

const promptExamples = `Message: "2 gelbwesten jungfernstieg am gleis richtung altona"
{"stationName": "Jungfernstieg", "directionName": "Altona"}

Message: "s3 hbf gerade losgefahren, 3 gelbwesten im ersten wagen richtung neugraben"
{"stationName": "Hauptbahnhof", "directionName": "Neugraben"}

Message: "zivis am kontrollieren in der s1 richtung wedel, jetzt jungfernstieg"
{"stationName": "Jungfernstieg", "directionName": "Wedel"}

Message: "2 kontrolleure in zivil an der bus-halte jungfernstieg ausgestiegen"
{"stationName": "Jungfernstieg", "directionName": null}

Message: "landungsbrücken clean"
{"stationName": "Landungsbrücken", "directionName": null}

Message: "hochbahn wache gerade hallerstraße aus der u1 richtung hbf ausgestiegen"
{"stationName": "Hallerstraße", "directionName": null}

Message: "bus 5 hbf richtung palmaille kontrolle"
{"stationName": "Hauptbahnhof", "directionName": "Palmaille"}

Message: "u2 berliner tor richtung niendorf markt"
{"stationName": "Berliner Tor", "directionName": "Niendorf Markt"}

Message: "s3 nach pinneberg, jetzt dammtor"
{"stationName": "Dammtor", "directionName": "Pinneberg"}

Message: "schlump 2 gelbwesten u2"
{"stationName": "Schlump", "directionName": null}

Message: "hbf clean auf der s1"
{"stationName": "Hauptbahnhof", "directionName": null}

Message: "gelbwesten barmbek richtung ohlsdorf"
{"stationName": "Barmbek", "directionName": "Ohlsdorf"}

Message: "weiß jemand ob die s4 fährt?"
{"stationName": null, "directionName": null}

Message: "Hi, kann mir wer ein Ticket verkaufen?"
{"stationName": null, "directionName": null}
`

export const HAMBURG: CityConfig = {
    slug: 'hamburg',
    subdomain: 'hamburg',
    displayName: 'Hamburg',
    publicAppUrl: 'https://hamburg.freifahren.org',
    listed: false,
    dbName: CITY_DATABASES.hamburg.dbName,
    dbBinding: CITY_DATABASES.hamburg.dbBinding,
    lang: 'de',
    timezone: 'Europe/Berlin',
    reporting: {
        publicSubmissionsEnabled: true,
        telegramForwardingEnabled: false,
    },
    map: {
        center: [9.9937, 53.5511],
        zoom: 11,
        bounds: [9.727, 53.369, 10.348, 53.733],
        styleUrl: 'https://tiles.freifahren.org/styles/hamburg.json',
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
            'Verkehrsbetriebe Hamburg-Holstein GmbH',
            'Verkehrsbetriebe Hamburg-Holstein',
        ],
        routeTypePriority: ['subway', 'light_rail', 'bus'],
        routeRefPatterns: { bus: String.raw`^\d{1,2}$` },
        colors: {
            light_rail: '#1A962B',
            bus: '#FA1E41',
        },
        defaultLineColor: '#000000',
    },
    telegram: {
        // Chosen from ~12k Hamburg group messages: "Gelbweste(n)" (the yellow hi-vis
        // vests HVV/Hochbahn inspectors wear) dominates by far, well ahead of "Zivil"/
        // "Zivi" (plainclothes) and formal "Kontrolleur". "Hochbahn Wache" also shows up
        // regularly; formal "Prüfer" is nearly unused. Unlike Berlin/Leipzig, the "Nk"
        // count shorthand ("3k") is rare here — people spell out "X gelbwesten"/"X mann".
        inspectorKeywords:
            'Gelbweste, Gelbwesten, gelbe Weste (the most common term — Hamburg\'s uniformed inspectors wear yellow hi-vis vests), Zivil, in Zivil, Zivi, Zivis, Zivikontrolle, Kontrolleur, Kontrolleure, Kontrolle, Hochbahn Wache, Hochbahn-Kontrolle, HVV-Kontrolle, Konti, Kontis, Prüfer, Fahrkartenkontrolle',
        untrackedLinesNote:
            'Sightings on OTHER lines (three-digit bus lines, night buses, express X-lines, ' +
            'regional trains, replacement services) are still reports if a station name is mentioned — ' +
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
        telegramChatId: '-1202572205',
        reporterCount: { min: 4_000, max: 5_000 },
    },
}
