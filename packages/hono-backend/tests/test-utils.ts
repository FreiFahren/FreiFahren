import app from '../src/index'

export const appRequest = async (path: string, init?: RequestInit) => {
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

export const sendReportRequest = async (payload: object) => {
    return appRequest('/reports', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Password': process.env.REPORT_PASSWORD ?? '',
        },
        body: JSON.stringify(payload),
    })
}
