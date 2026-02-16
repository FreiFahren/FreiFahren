import { app } from '../src/index'

export const sendReportRequest = async (payload: object) => {
    return app.request('/v0/reports', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Password': process.env.REPORT_PASSWORD ?? '',
        },
        body: JSON.stringify(payload),
    })
}
