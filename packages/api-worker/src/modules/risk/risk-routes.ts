import type { Env } from '../../app-env'
import { defineRoute } from '../../common/router'

export const getRisk = defineRoute<Env>()({
    method: 'get',
    path: '/',
    handler: async (c) => {
        const riskService = c.get('riskService')
        return c.json(await riskService.getRisk())
    },
})
