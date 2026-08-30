import type { Env } from '../../app-env'
import { defineRoute } from '../../common/router'
import { resolveViewer } from '../reports/viewer'

export const getRisk = defineRoute<Env>()({
    method: 'get',
    path: '/',
    handler: async (c) => {
        const riskService = c.get('riskService')
        // Risk is viewer-dependent and therefore computed per request rather than cached.
        return c.json(await riskService.getRisk({ viewer: await resolveViewer(c) }))
    },
})
