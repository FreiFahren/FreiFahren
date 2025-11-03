import { defineRoute } from "../../common/router";
import { Env} from "../../app-type"

export const getReports = defineRoute<Env>()({
  method: 'get' as const,
  path: '/basics/reports',
  handler: async (c) => {
    const reportsService = c.get('reportsService');

    return reportsService.getReports()
  }
})
