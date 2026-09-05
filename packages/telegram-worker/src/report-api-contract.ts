export type TelegramReportIntake = {
    city: string
    report: {
        stationId: string
        lineId: string | null
        directionId: string | null
    }
}

export type TelegramReportsApi = {
    intake(
        request: TelegramReportIntake
    ): Promise<
        | { ok: true; data: unknown }
        | { ok: false; error: { message: string; statusCode: number; internalCode: string } }
    >
}
