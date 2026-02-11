import { zValidator } from '@hono/zod-validator'
import { Context, Handler, Hono, Env } from 'hono'
import { z } from 'zod'

type HttpMethod = 'get' | 'post' | 'put'
type RouteSchemas = {
    json?: z.ZodTypeAny
    param?: z.ZodTypeAny
    query?: z.ZodTypeAny
}

type HonoInputFromRouteSchemas<S extends RouteSchemas> = {
    out: {
        [k in keyof S]: S[k] extends undefined ? undefined : z.infer<S[k]>
    }
}

type DefineRouteInput<E extends Env, M extends HttpMethod, S extends RouteSchemas> = {
    method: M
    path: string
    schemas?: S
    // Optional non-validation middlewares (e.g., auth, logging)
    middlewares?: Handler<E>[] // Runs before validators
    handler: Handler<E, string, HonoInputFromRouteSchemas<S>>
}

export const defineRoute =
    <E extends Env>() =>
    <M extends HttpMethod, S extends RouteSchemas>(def: DefineRouteInput<E, M, S>) => {
        const mws: Handler[] = []

        if ((def.middlewares?.length ?? 0) > 0) {
            mws.push(...(def.middlewares ?? []))
        }

        if (def.schemas?.param) mws.push(zValidator('param', def.schemas.param))
        if (def.schemas?.query) mws.push(zValidator('query', def.schemas.query))
        if (def.schemas?.json) mws.push(zValidator('json', def.schemas.json))

        return {
            method: def.method,
            path: def.path,
            middlewares: mws as readonly Handler<E>[],
            handler: def.handler,
        } as const
    }

const registerRoutes = <E extends Env>(app: Hono<E>, routes: ReturnType<ReturnType<typeof defineRoute<E>>>[]) => {
    routes.forEach((r) => app[r.method](r.path, ...r.middlewares, r.handler))
}

export const registerVersionedRoutes = <E extends Env>(
    app: Hono<E>,
    basePath: string,
    latestVersion: string,
    versions: Record<string, ReturnType<ReturnType<typeof defineRoute<E>>>[]>
) => {
    // Create a standalone mini-app per version and mount it at /{version}/{basePath}.
    // Routes inside only define paths relative to their module (e.g. "/" or "/stations"),
    // And app.route() prefixes them so they resolve to the full URL (e.g. /v0/transit/stations).
    for (const [version, routes] of Object.entries(versions)) {
        const subApp = new Hono<E>()

        if (version !== latestVersion) {
            subApp.use('*', async (c, next) => {
                await next()
                c.header('Deprecation', 'true')
                c.header('X-Latest-Api-Version', latestVersion)
            })
        }

        registerRoutes(subApp, routes)
        // We define version in the route so that it is easy to identify and debug potential version mismatches
        app.route(`/${version}/${basePath}`, subApp)
    }

    // Return 404 with available versions for unknown version prefixes (e.g. /v99/reports)
    const availableVersions = Object.keys(versions)
    const unknownVersion = (c: Context) => {
        const requestedVersion = c.req.param('version')
        return c.json(
            {
                error: `Version ${requestedVersion} not found for ${basePath}`,
                availableVersions,
            },
            404
        )
    }
    app.all(`/:version{v\\d+}/${basePath}/*`, unknownVersion)
    app.all(`/:version{v\\d+}/${basePath}`, unknownVersion)

    // Redirect unversioned requests to the latest version.
    // 307 preserves the original HTTP method and body
    const redirect = (c: Context) => {
        const url = new URL(c.req.url)
        url.pathname = `/${latestVersion}${url.pathname}`
        return c.redirect(url.toString(), 307)
    }
    app.all(`/${basePath}/*`, redirect)
    app.all(`/${basePath}`, redirect)
}
