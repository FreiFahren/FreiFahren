export type TrustedReportIntake = {
    city: {
        slug: string
        publicAppUrl: string
        dbBinding: string
        telegramChatId: string | null
        reporting: {
            publicSubmissionsEnabled: boolean
            telegramForwardingEnabled: boolean
        }
    }
    report: {
        stationId: string
        source: 'telegram'
        lineId: string | null
        directionId: string | null
    }
}

export type TrustedReportGate = {
    intake(request: TrustedReportIntake): Promise<
        | { ok: true; data: unknown }
        | {
              ok: false
              error: {
                  message: string
                  statusCode: number
                  internalCode: string
              }
          }
    >
}
