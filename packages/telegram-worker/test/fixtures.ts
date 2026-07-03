import { profileFor } from '../src/config'
import { buildIndex } from '../src/transit'
import type { TransitIndex } from '../src/types'

/** Berlin profile for tests — mirrors the production CITY_NAME default. */
export const berlinProfile = profileFor('Berlin')

export const ALLOWED_CHAT_ID = '-1001'
export const PUBLIC_APP_URL = 'https://app.example.test'
export const BACKEND_URL = 'https://backend.test'

/**
 * Synthetic transit payloads mirroring tests/test_resolution.py's _make_transit(),
 * shaped exactly as the backend's /v0/transit/{stations,lines} responses.
 */
export function rawTransit() {
    const rawStations = {
        'S-suedkreuz': { name: 'Südkreuz', lines: ['S41', 'S42'] },
        'U-turmstrasse': { name: 'Turmstraße', lines: ['U9'] },
        'U-leinestrasse': { name: 'Leinestraße', lines: ['U8'] },
        'U-rudow': { name: 'Rudow', lines: ['U7'] },
        'U-rathaus-neukoelln': { name: 'Rathaus Neukölln', lines: ['U7'] },
        'U-hermannplatz': { name: 'Hermannplatz', lines: ['U7', 'U8'] },
    }
    const rawLines = [
        { id: 'S41-v', name: 'S41', isCircular: true, stations: ['S-suedkreuz'] },
        { id: 'S42-v', name: 'S42', isCircular: true, stations: ['S-suedkreuz'] },
        { id: 'U9-v', name: 'U9', isCircular: false, stations: ['U-turmstrasse'] },
        { id: 'U8-v', name: 'U8', isCircular: false, stations: ['U-leinestrasse', 'U-hermannplatz'] },
        {
            id: 'U7-v',
            name: 'U7',
            isCircular: false,
            stations: ['U-rudow', 'U-rathaus-neukoelln', 'U-hermannplatz'],
        },
    ]
    return { rawStations, rawLines }
}

export function makeIndex(): TransitIndex {
    const { rawStations, rawLines } = rawTransit()
    return buildIndex(rawStations, rawLines, berlinProfile)
}

export interface PickedStation {
    stationId: string
    lineId: string
    lineName: string
    directionId: string
}

/** First variant with >=2 stations: first station is the location, last the direction. */
export function pickStationFixture(index: TransitIndex): PickedStation {
    const variant = index.variants.find((v) => v.stations.length >= 2)
    if (!variant) {
        throw new Error('No line variant with >=2 stations in fixture')
    }
    return {
        stationId: variant.stations[0],
        lineId: variant.id,
        lineName: variant.name,
        directionId: variant.stations[variant.stations.length - 1],
    }
}
