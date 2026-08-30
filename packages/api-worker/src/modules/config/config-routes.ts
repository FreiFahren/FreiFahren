import type { Env } from '../../app-env'
import { defineRoute } from '../../common/router'
import { isOpenReportPreview } from '../report-gate/preview-report-gate'

/*
 * Runtime-discoverable switches, so a client learns the current state instead of shipping a copy of
 * it. The report killswitch is the reason this exists: a build-time flag is frozen into whatever
 * bundle a user installed — which, for the Capacitor app, is unreachable without a release — and it
 * is a second source of truth that has to be flipped in the right order to stay consistent.
 *
 * Never cache this response, here or in the Workers Cache middleware. Being answered live is what
 * lets a city-registry deployment close public intake for installed clients without an app release.
 */
export const getConfig = defineRoute<Env>()({
    method: 'get',
    path: '/',
    handler: async (c) => {
        c.header('Cache-Control', 'no-store')

        const city = c.get('city')
        const reportingEnabled = isOpenReportPreview(c) || city.reporting.publicSubmissionsEnabled

        return c.json({
            reporting: { enabled: reportingEnabled },
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
