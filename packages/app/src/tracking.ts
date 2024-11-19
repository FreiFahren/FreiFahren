import axios, { AxiosInstance } from 'axios'
import { Dimensions, Platform } from 'react-native'
import DeviceInfo from 'react-native-device-info'

import { config } from './config'

type Event =
    | { name: 'app-opened' }
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

let client: AxiosInstance | null = null

const createClient = async () => {
    const deviceName = await DeviceInfo.getDeviceName()
    const appVersion = DeviceInfo.getVersion()
    const buildNumber = DeviceInfo.getBuildNumber()

    const platform = Platform.OS === 'ios' ? 'iOS' : 'Android'

    const userAgent = `Freifahren/${appVersion} (${platform}; ${Platform.Version}; ${deviceName}) BuildNumber/${buildNumber}`

    return axios.create({
        baseURL: config.PIRSCH_BASE_URL,
        headers: {
            'User-Agent': userAgent,
        },
    })
}

export const track = ({ name, ...eventData }: Event) => {
    ;(async () => {
        if (client === null) {
            client = await createClient()
        }

        // eslint-disable-next-line no-console
        console.log(`[Event] ${name}`, eventData)

        const { width, height } = Dimensions.get('window')

        await client.post('/event', {
            identification_code: config.PIRSCH_IDENTIFICATION_CODE,
            url: config.PIRSCH_SITE_URL,
            title: 'Freifahren',
            referrer: '',
            screen_width: Math.floor(width),
            screen_height: Math.floor(height),
            tags: {},
            event_name: name,
            event_duration: 0,
            event_meta: eventData,
        })
    })().catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to track event:', error)
    })
}
