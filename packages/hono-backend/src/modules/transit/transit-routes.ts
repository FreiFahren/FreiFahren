import { Env } from '../../app-env'
import { defineRoute } from '../../common/router'

export const getStations = defineRoute<Env>()({
    method: 'get' as const,
    path: 'v0/stations',
    handler: async (c) => {
        const linesStationService = c.get('linesStationService')
        return c.json(await linesStationService.getStations())
    },
})
