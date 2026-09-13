import type { Env } from '../../app-env'
import { defineRoute } from '../../common/router'

// City metadata is resolved at request time so each hostname receives the same registry values.
// Never cache this response because city configuration can change independently of the app bundle.
export const getConfig = defineRoute<Env>()({
    method: 'get',
    path: '/',
    handler: async (c) => {
        c.header('Cache-Control', 'no-store')

        const city = c.get('city')
        return c.json({
            city: {
                slug: city.slug,
                subdomain: city.subdomain,
                displayName: city.displayName,
                publicAppUrl: city.publicAppUrl,
                listed: city.listed ?? true,
                lang: city.lang,
                timezone: city.timezone,
                map: city.map,
                community: {
                    telegramHandle: city.community.telegramHandle,
                    reporterCount: city.community.reporterCount,
                },
            },
        })
    },
})
