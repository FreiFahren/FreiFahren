import axios, { AxiosInstance } from 'axios'
import { Dimensions, Platform } from 'react-native'
import DeviceInfo from 'react-native-device-info'

import { config } from './config'

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

export const trackHit = () => {
    ;(async () => {
        if (client === null) {
            client = await createClient()
        }

        // eslint-disable-next-line no-console
        console.log('[Event] Hit')

        if (__DEV__) return

        const { width, height } = Dimensions.get('window')

        await client.get('/hit', {
            params: {
                nc: Date.now(),
                code: config.PIRSCH_IDENTIFICATION_CODE,
                w: width,
                h: height,
                url: config.PIRSCH_SITE_URL,
            },
        })
    })().catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to track hit:', error)
    })
}

type BaseEvent = {
    duration?: number
}

type Event = BaseEvent &
    (
        | { name: 'Reports Viewed' }
        | { name: 'Report Tapped'; station: string }
        | { name: 'Layer Selected'; layer: 'risk' | 'lines' }
        | { name: 'Report Sheet Opened' }
        | { name: 'Report Submitted'; duration: number }
        | { name: 'Language Switched'; language: string }
        | { name: 'Privacy Policy Viewed'; from: string }
        | { name: 'Support Page Viewed'; from: string }
        | { name: 'Settings Opened' }
        | { name: 'Disclaimer Viewed' }
        | { name: 'Disclaimer Dismissed' }
        | { name: 'Privacy Policy Blocker Shown' }
        | { name: 'Privacy Policy Accepted' }
    )

export const track = ({ name, duration, ...eventData }: Event) => {
    ;(async () => {
        if (client === null) {
            client = await createClient()
        }

        // eslint-disable-next-line no-console
        console.log(`[Event] ${name}`, eventData)

        if (__DEV__) return

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
            event_duration: duration ?? 0,
            event_meta: eventData,
        })
    })().catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Failed to track event:', error)
    })
}
