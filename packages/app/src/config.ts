import { z } from 'zod'

export const config = (() => {
    try {
        return z
            .object({
                FF_API_BASE_URL: z.string(),
                MAP_STYLE_URL: z.string(),
                PRIVACY_POLICY_URL: z.string(),
                SENTRY_DSN: z.string(),
                PIRSCH_BASE_URL: z.string(),
                PIRSCH_IDENTIFICATION_CODE: z.string(),
                PIRSCH_SITE_URL: z.string(),
            })
            .parse({
                FF_API_BASE_URL: process.env.EXPO_PUBLIC_FF_API_BASE_URL,
                MAP_STYLE_URL: process.env.EXPO_PUBLIC_MAP_STYLE_URL,
                PRIVACY_POLICY_URL: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL,
                SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
                PIRSCH_BASE_URL: process.env.EXPO_PUBLIC_PIRSCH_BASE_URL,
                PIRSCH_IDENTIFICATION_CODE: process.env.EXPO_PUBLIC_PIRSCH_IDENTIFICATION_CODE,
                PIRSCH_SITE_URL: process.env.EXPO_PUBLIC_PIRSCH_SITE_URL,
            })
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Missing environment variables:', error)
        throw error
    }
})()
