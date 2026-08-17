import { CITY_DATABASES } from './databases'
import type { CityConfig } from './types'

const promptExamples = `Message: "3k Haltestelle Zoo Richtung gohlis"
{"stationName": "Zoo", "directionName": "Gohlis"}

Message: "linie 1 hbf richt lausen 3 kontrolleure"
{"stationName": "Hauptbahnhof", "directionName": "Lausen"}

Message: "lvb kontrolle in der 16 messe richtung lößnig"
{"stationName": "Messegelände", "directionName": "Lößnig"}

Message: "2k in der 10 nach wahren, jetzt wilhelm-leuschner-platz"
{"stationName": "Wilhelm-Leuschner-Platz", "directionName": "Wahren"}

Message: "7 richtung böhlitz-ehrenberg, gerade augustusplatz"
{"stationName": "Augustusplatz", "directionName": "Böhlitz-Ehrenberg"}

Message: "s3 am bayerischen bahnhof prüfer eingestiegen"
{"stationName": "Bayerischer Bahnhof", "directionName": null}

Message: "11 connewitz 2 fahrkartenkontrolleure"
{"stationName": "Connewitzer Kreuz", "directionName": null}

Message: "hbf clean"
{"stationName": "Hauptbahnhof", "directionName": null}

Message: "3k stieglitzstraße richtung innenstadt"
{"stationName": "Stieglitzstraße", "directionName": null}

Message: "2k südplatz stadteinwärts"
{"stationName": "Südplatz", "directionName": null}

Message: "automat im ersten wagen kaputt, gerade johannisplatz"
{"stationName": null, "directionName": null}

Message: "fährt die 70 wieder übers kreuz?"
{"stationName": null, "directionName": null}

Message: "weiß jemand ob heute noch kontrolliert wird?"
{"stationName": null, "directionName": null}
`

export const LEIPZIG: CityConfig = {
    slug: 'leipzig',
    subdomain: 'leipzig',
    displayName: 'Leipzig',
    dbName: CITY_DATABASES.leipzig.dbName,
    dbBinding: CITY_DATABASES.leipzig.dbBinding,
    lang: 'de',
    timezone: 'Europe/Berlin',
    map: {
        center: [12.3731, 51.3397],
        zoom: 12,
        bounds: [12.18, 51.24, 12.56, 51.45],
        styleUrl: 'https://tiles.freifahren.org/styles/leipzig.json',
    },
    tiles: {
        // No Leipzig-only Geofabrik extract exists, so the whole Saxony extract is used
        // and cropped to the city bounds (clipToMapBounds).
        osmUrl: 'https://download.geofabrik.de/europe/germany/sachsen-latest.osm.pbf',
        clipToMapBounds: true,
    },
    seed: {
        adminLevel: '^6$',
        // LVB only. S-Bahn ("DB Regio Südost") is intentionally dropped — a separate
        // operator, routinely inspected anyway, and of little added value here.
        operators: ['Leipziger Verkehrsbetriebe'],
        stationBounds: [12.18, 51.24, 12.56, 51.45],
        // LVB is a tram + bus network. Bus is last so that where a stop serves both,
        // tram stays the station's representative type (and wins the proximate-merge pick).
        routeTypePriority: ['tram', 'bus'],
        // Empty on purpose: keep each line's own OSM colour (official LVB per-line
        // colors) instead of forcing one shared color per vehicle type.
        colors: {},
        defaultLineColor: '#000000',
        excludeLineRefPatterns: [
            String.raw`^\+`,
            String.raw`^SEV(\s|$)`,
            String.raw`^N`,
            String.raw`^Messe Transport$`,
            String.raw`^108$`,
        ],
    },
    telegram: {
        // Chosen from ~60k Leipzig group messages: the "3k" shorthand, "uniformiert" and
        // "zivil" dominate; formal "Prüfer"/"Fahrausweisprüfung" are effectively absent.
        // Police terms are intentionally excluded (police are not ticket inspectors).
        inspectorKeywords:
            'K (for example "3k" means three ticket inspectors), Kontrolleur, Kontrolleure, Kontrolle, Konti, Kontis, Kontrolletti, Kontrollettis, uniformiert, Uniform, Zivil, in Zivil, LVB-Kontrolle, Fahrkartenkontrolle',
        // LVB's tram and bus network is seeded in full, so only the deliberately
        // excluded S-Bahn/regional operators fall outside it.
        untrackedLinesNote:
            'Sightings on OTHER lines (S-Bahn, regional trains, replacement services) are ' +
            'still reports if a station name is mentioned — extract the station.',
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
        telegramHandle: '@freifahren_leipzig',
        reporterCount: { min: 7_000, max: 8_000 },
    },
}
