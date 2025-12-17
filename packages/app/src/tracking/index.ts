import axios, { AxiosInstance } from 'axios'
import { Dimensions, Platform } from 'react-native'
import DeviceInfo from 'react-native-device-info'

import { useAppStore } from '../app.store'
import { config } from '../config'
import { Event } from './events'

export type Tracker = {
    track: (event: Event) => void
}

export const createTracker = (): Tracker => {
    const deviceName = DeviceInfo.getDeviceNameSync()
    const platform = Platform.OS === 'ios' ? 'iOS' : 'Android'

    const client: AxiosInstance = axios.create({
        baseURL: config.UMAMI_HOST_URL,
        headers: {
            'User-Agent': `Freifahren/1.0 (${platform}; ${Platform.Version}; ${deviceName})`,
            'Content-Type': 'application/json',
        },
    })

    const getBasePayload = () => {
        const { width, height } = Dimensions.get('window')

        return {
            website: config.UMAMI_WEBSITE_ID,
            screen: `${Math.floor(width)}x${Math.floor(height)}`,
            language: useAppStore.getState().language,
            title: 'Freifahren',
            hostname: 'app.freifahren.org',
            url: 'app://freifahren',
        }
    }

    const track = async ({ name, ...data }: Event) => {
        try {
            await client.post('/api/send', {
                type: 'event',
                payload: { ...getBasePayload(), name, data },
            })
        } catch (error) {
            // eslint-disable-next-line no-console
            if (__DEV__) console.error('Failed to send umami event:', error)
        }
    }

    return {
        track,
    }
}
