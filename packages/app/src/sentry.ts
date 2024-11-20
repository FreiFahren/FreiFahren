import { init } from '@sentry/react-native'
import { AxiosError } from 'axios'

import { config } from './config'

init({
    dsn: config.SENTRY_DSN,
    debug: __DEV__,
    beforeSend: (event, hint) => {
        if (__DEV__) return null

        const error = hint.originalException

        if (error instanceof AxiosError) {
            const status = error.response?.status

            if (status !== undefined && status >= 400) {
                return event
            }
            return null
        }

        return event
    },
})
