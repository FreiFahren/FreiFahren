import { Pirsch } from 'pirsch-sdk/web'

import { config } from './config'

export const client = new Pirsch({
    identificationCode: config.PIRSCH_IDENTIFICATION_CODE,
})

type Event =
    | { name: 'reports-viewed' }
    | { name: 'report-tapped'; station: string }
    | { name: 'layer-selected'; layer: 'risk' | 'lines' }
    | { name: 'report-sheet-opened' }
    | { name: 'report-submitted'; timeTaken: number }
    | { name: 'language-selected'; language: string }
    | { name: 'privacy-policy-viewed'; from: string }
    | { name: 'settings-opened' }
    | { name: 'disclaimer-viewed' }
    | { name: 'disclaimer-dismissed' }

export const track = ({ name, ...eventData }: Event) => {
    if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.log('[Event]', name, eventData)
    }
    // eslint-disable-next-line no-console
    client.event(name, undefined, eventData).catch(console.error)
}
