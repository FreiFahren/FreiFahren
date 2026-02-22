import type { Env } from '../../app-env'
import { defineRoute } from '../../common/router'

export const getRisk = defineRoute<Env>()({
    method: 'get',
    path: 'v0/risk',
    handler: async (c) => {
        const riskService = c.get('riskService')
        return c.json(await riskService.getRisk())
    },
})
