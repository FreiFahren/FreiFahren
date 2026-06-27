import type { Env } from '../../app-env'
import { defineRoute } from '../../common/router'

export const getRisk = defineRoute<Env>()({
    method: 'get',
    path: '/',
    docs: {
        summary: 'Get risk data',
        description:
            'Retrieves risk predictions for transit segments. This endpoint returns color-coded risk levels along with the risk value for different segments of the transit network based on recent ticket inspector activity.',
        tags: ['risk'],
    },
    handler: async (c) => {
        const riskService = c.get('riskService')
        return c.json(await riskService.getRisk())
    },
})
