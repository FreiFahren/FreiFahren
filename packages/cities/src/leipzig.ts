import { CITY_DATABASES } from './databases'
import type { CityConfig } from './types'

const promptExamples = `Message: "3k Haltestelle Zoo Richtung gohlis"
{"stationName": "Zoo", "directionName": "Gohlis"}

Message: "linie 1 hbf richt lausen 3 kontrolleure"
{"stationName": "Hauptbahnhof", "directionName": "Lausen"}

Message: "lvb kontrolle in der 16 messe richtung lößnig"
{"stationName": "Messegelände", "directionName": "Lößnig"}

Message: "s3 am bayerischen bahnhof prüfer eingestiegen"
{"stationName": "Bayerischer Bahnhof", "directionName": null}

Message: "11 connewitz 2 fahrkartenkontrolleure"
{"stationName": "Connewitz, Kreuz", "directionName": null}

Message: "hbf clean"
{"stationName": "Hauptbahnhof", "directionName": null}
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
        osmUrl: 'https://download.geofabrik.de/europe/germany/sachsen-latest.osm.pbf',
        clipToMapBounds: true,
    },
    seed: {
        adminLevel: '^6$',
        operators: ['Leipziger Verkehrsbetriebe', 'DB Regio Südost'],
        stationBounds: [12.18, 51.24, 12.56, 51.45],
        routeTypePriority: ['tram', 'train', 'light_rail', 'subway'],
        colors: {},
        defaultLineColor: '#000000',
    },
    telegram: {
        inspectorKeywords:
            'K (for example "3k" means three ticket inspectors), Kontrolleur, Kontrolleure, Konti, Kontrollettis, Fahrkartenkontrolle, Fahrausweisprüfung, Fahrausweisprüfer, LVB-Kontrolle, Prüfer',
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
    },
}
