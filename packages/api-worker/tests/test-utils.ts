import { Bindings } from '../src/app-env'
import { app } from '../src/index'

// Derived from process.env on every call so a test can flip an env var (e.g. NODE_ENV) right
// before a request and have it take effect.
export const testEnv = (): Bindings => ({
    DATABASE_URL: process.env.DATABASE_URL,
    CORS_ORIGINS: process.env.CORS_ORIGINS ?? 'http://localhost',
    NODE_ENV: process.env.NODE_ENV,
    TELEGRAM_WORKER_URL: process.env.TELEGRAM_WORKER_URL,
    REPORT_PASSWORD: process.env.REPORT_PASSWORD,
    LOG_LEVEL: process.env.LOG_LEVEL as Bindings['LOG_LEVEL'],
})

/**
 * Sends a request to the app and follows redirects.
 * @param path - The path to request.
 * @param init - The request init.
 * @param targetApp - The app to send the request to. Defaults to the singleton app.
 * @returns The response.
 * We use this instead of app.request because we want to test the latest version of the API.
 * Otherwise we would have to specify the route version in every test.
 * With this function we can just call the route path and it will be redirected to the latest version.
 */
export const appRequestWithRedirect = async (path: string, init?: RequestInit, targetApp = app) => {
    const response = await targetApp.request(path, init, testEnv())
    if (response.status === 307) {
        const location = response.headers.get('Location')
        if (location) {
            const url = new URL(location)
            return targetApp.request(url.pathname + url.search, init, testEnv())
        }
    }
    return response
}

/**
 * Sends a report request to the app.
 * @param payload - The report payload.
 * @param routeApp - The app to send the request to. Defaults to the singleton app.
 * @returns The response.
 */
export const sendReportRequest = async (payload: object, routeApp = app) => {
    return appRequestWithRedirect(
        '/reports',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Password': process.env.REPORT_PASSWORD ?? '',
            },
            body: JSON.stringify(payload),
        },
        routeApp
    )
}
