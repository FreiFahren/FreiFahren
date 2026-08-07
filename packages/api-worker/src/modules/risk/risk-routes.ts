import type { Env } from '../../app-env'
import { defineRoute } from '../../common/router'
import { resolveViewer } from '../reports/viewer'

export const getRisk = defineRoute<Env>()({
    method: 'get',
    path: '/',
    handler: async (c) => {
        const riskService = c.get('riskService')
        /*
         * The map colours are computed per request and never cached, so personalising them costs
         * nothing — and it is the surface that matters most here. A flooder whose reports moved no
         * segment would notice immediately.
         */
        return c.json(await riskService.getRisk(undefined, await resolveViewer(c)))
    },
})
