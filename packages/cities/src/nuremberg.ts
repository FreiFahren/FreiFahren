import { CITY_DATABASES } from './databases'
import type { CityConfig } from './types'

// Real messages from the group, none of them in the eval sample.
const promptExamples = `Message: "Kontros U1 Richtung langwasser grad lorenzkirche in der U-Bahn"
{"stationName": "Lorenzkirche", "directionName": "Langwasser Süd"}

Message: "5 Zivis (4 m 1f) am Hbf mom am Gleis U1 Richtung Fürth"
{"stationName": "Hauptbahnhof", "directionName": "Fürth Hardhöhe"}

Message: "Kontrolle Langwasser Richtung Fürth jetzt Bauernfeindstrasse"
{"stationName": "Bauernfeindstraße", "directionName": "Fürth Hardhöhe"}

Message: "U2 Richtung röthenbach in Wöhrder Wiese kontroller"
{"stationName": "Wöhrder Wiese", "directionName": "Röthenbach"}

Message: "Kontrolle in U3 gerade Gustav Adolf Straße, Richtung Grosreuth"
{"stationName": "Gustav-Adolf-Straße", "directionName": "Großreuth bei Schweinau"}

Message: "4 Kontros (DB Security)S2 Richtung Altdorf grade Fischbach. Kontrollieren 3G"
{"stationName": "Fischbach (b Nürnberg)", "directionName": "Altdorf (b Nürnberg)"}

Message: "Tram 6 Richtung Doku Zentrum steigen grad bei landgrabenstrasse ein"
{"stationName": "Landgrabenstraße", "directionName": "Doku-Zentrum"}

Message: "4kontis in der 6 gerade Christuskirche ausgestiegen Richtung Doku zentrum"
{"stationName": "Christuskirche", "directionName": "Doku-Zentrum"}

Message: "Sind jetzt raus bei nordostbahnhof"
{"stationName": "Nordostbahnhof", "directionName": null}

Message: "Kontis stehen grade an der Cramergasse (Bus Linie 43/44) und haben zwei Mädels raus gezogen"
{"stationName": null, "directionName": null}

Message: "S2 Richtung Altdorf Kontrolle"
{"stationName": null, "directionName": "Altdorf (b Nürnberg)"}

Message: "Kick die mal raus"
{"stationName": null, "directionName": null}
`

export const NUREMBERG: CityConfig = {
    slug: 'nuremberg',
    subdomain: 'nuremberg',
    subdomainAliases: ['nuernberg'],
    displayName: 'Nürnberg',
    publicAppUrl: 'https://nuremberg.freifahren.org',
    listed: true,
    dbName: CITY_DATABASES.nuremberg.dbName,
    dbBinding: CITY_DATABASES.nuremberg.dbBinding,
    lang: 'de',
    timezone: 'Europe/Berlin',
    reporting: {
        telegramForwardingEnabled: false,
    },
    map: {
        center: [11.0767, 49.4521],
        zoom: 11,
        // S-Bahn Nürnberg extent [west, south, east, north]: Ansbach, Roth, Neumarkt, Hartmannshof
        // and Bamberg.
        bounds: [10.5, 49.15, 11.6, 49.92],
        styleUrl: 'https://tiles.freifahren.org/styles/nuremberg.json',
    },
    tiles: {
        // Bamberg and Neumarkt lie outside Mittelfranken, so the whole of Bavaria is cropped instead.
        osmUrl: 'https://download.geofabrik.de/europe/germany/bayern-latest.osm.pbf',
        clipToMapBounds: true,
    },
    seed: {
        adminLevel: '^6$',
        operators: [
            'Verkehrs-Aktiengesellschaft Nürnberg',
            'VAG Verkehrs-Aktiengesellschaft Nürnberg',
            'DB Regio Mittelfranken',
            'DB Regio AG - Regio Bayern',
        ],
        stationBounds: [10.5, 49.15, 11.6, 49.92],
        routeTypePriority: ['subway', 'light_rail', 'tram'],
        osmRouteTypeAliases: { train: 'light_rail' },
        routeRefPatterns: { light_rail: String.raw`^S\d+$` },
        // U and S lines carry their VGN colours in OSM; the trams have none.
        colors: { tram: '#be1414' },
        defaultLineColor: '#000000',
        // DB names its S-Bahn stops "Nürnberg-X"; the tram stops next to them use the local names.
        // Renaming the DB side merges the pairs and drops the city prefix elsewhere.
        stationNameOverrides: {
            'Nürnberg Hauptbahnhof': 'Hauptbahnhof',
            'Nürnberg-Dürrenhof': 'Dürrenhof',
            'Nürnberg-Dutzendteich': 'Dutzendteich',
            'Nürnberg-Steinbühl': 'Steinbühl',
            'Nürnberg-Mögeldorf': 'Mögeldorf',
            'Nürnberg Frankenstadion': 'Frankenstadion',
            'Nürnberg Ostring': 'Ostring',
            'Nürnberg-Eibach': 'Eibach',
            'Nürnberg-Gleißhammer': 'Gleißhammer',
            'Nürnberg-Laufamholz': 'Laufamholz',
            'Nürnberg-Rehhof': 'Rehhof',
            'Nürnberg-Reichelsdorf': 'Reichelsdorf',
            'Nürnberg-Sandreuth': 'Sandreuth',
            'Nürnberg-Stein': 'Stein',
            'Nürnberg-Schweinau': 'Schweinau',
            'Fürth (Bayern) Hauptbahnhof': 'Fürth Hauptbahnhof',
            // The U1 stop shares its stop area with the newer S1 halt "Fürth Klinikum".
            Klinikum: 'Fürth Klinikum',
            'Fürth-Stadthalle': 'Fürth Stadthalle',
            'Julienstr.': 'Julienstraße',
        },
    },
    telegram: {
        inspectorKeywords:
            'Kontrolleure, Kontrolle, Kontros, Kontrolleur, Kontis, in Uniform, DB Uniform, DB Sicherheit, ' +
            'DB Security, in Zivil, Zivile, VAG, Fahrkartenkontrolle, Security, männlich/weiblich gelesen',
        untrackedLinesNote:
            'Trams are often given as a bare number ("in der 6"). Sightings on OTHER lines (bus lines, ' +
            'night lines, regional trains, replacement services) are still reports if a station name ' +
            'is mentioned: extract the station.',
        circularLineAlias: '',
        circularLinePattern: '',
        abbreviations: [
            [String.raw`straße`, 'strasse'],
            [String.raw`str\.?(?=\s|$|\/|,|\)|-)`, 'strasse'],
            [String.raw`str$`, 'strasse'],
            [String.raw`\bbhf\.?\b`, 'bahnhof'],
            [String.raw`\bhbf\.?\b`, 'hauptbahnhof'],
            [String.raw`\bpl\.?\b`, 'platz'],
            // Termini by their short names.
            [String.raw`^langwasser$`, 'langwasser sud'],
            [String.raw`^furth$`, 'furth hardhohe'],
            [String.raw`^altdorf$`, 'altdorf (b nurnberg)'],
            [String.raw`^lauf$`, 'lauf (links pegnitz)'],
            [String.raw`^gro(ss|s)reuth$`, 'grossreuth bei schweinau'],
            [String.raw`^doku$`, 'doku-zentrum'],
        ],
        promptExamples,
    },
    community: {
        telegramChatId: '-1001407366881',
    },
}
