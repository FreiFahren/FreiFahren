import { Env } from "../../app-env"
import { defineRoute } from "../../common/router";

export const getReports = defineRoute<Env>()({
  method: 'get' as const,
  path: '/basics/reports',
  handler: async (c) => {
    const reportsService = c.get('reportsService');

    return reportsService.getReports()
  }
})
