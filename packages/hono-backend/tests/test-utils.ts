import { app } from '../src/index'

/**
 * Sends a request to the app and follows redirects.
 * @param path - The path to request.
 * @param init - The request init.
 * @returns The response.
 */
export const appRequestWithRedirect = async (path: string, init?: RequestInit) => {
    const response = await app.request(path, init)
    if (response.status === 307) {
        const location = response.headers.get('Location')
        if (location) {
            const url = new URL(location)
            return app.request(url.pathname + url.search, init)
        }
    }
    return response
}

/**
 * Sends a report request to the app.
 * @param payload - The report payload.
 * @returns The response.
 */
export const sendReportRequest = async (payload: object) => {
    return appRequestWithRedirect('/reports', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Password': process.env.REPORT_PASSWORD ?? '',
        },
        body: JSON.stringify(payload),
    })
}
