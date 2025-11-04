import { defineRoute } from "../../common/router";
import { Env } from "../../app-env"

export const getReports = defineRoute<Env>()({
  method: 'get' as const,
  path: 'v0/reports',
  handler: async (c) => {
    const reportsService = c.get('reportsService');

    return reportsService.getReports()
  }
})
