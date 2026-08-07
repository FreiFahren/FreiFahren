import type { Env } from '../../app-env'
import { defineRoute } from '../../common/router'

/*
 * Runtime-discoverable switches, so a client learns the current state instead of shipping a copy of
 * it. The report killswitch is the reason this exists: a build-time flag is frozen into whatever
 * bundle a user installed — which, for the Capacitor app, is unreachable without a release — and it
 * is a second source of truth that has to be flipped in the right order to stay consistent.
 *
 * Never cache this response, here or in the Workers Cache middleware. Being answered live is the
 * whole value of the switch: REPORTING_ENABLED is flipped with `wrangler deploy --var` and takes
 * effect on the next request. Any cache in front of this reintroduces exactly the staleness the
 * switch exists to avoid.
 */
export const getConfig = defineRoute<Env>()({
    method: 'get',
    path: '/',
    handler: async (c) => {
        c.header('Cache-Control', 'no-store')

        return c.json({ reporting: { enabled: c.get('config').reportingEnabled } })
    },
})
