import { zValidator } from '@hono/zod-validator'
import { Handler, Hono, Env } from 'hono';
import { z } from 'zod';

type HttpMethod = 'get' | 'post' | 'put';
type RouteSchemas = {
  json?: z.ZodTypeAny;
  param?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
};

type HonoInputFromRouteSchemas<S extends RouteSchemas> = {
  out: {
    [k in keyof S]: S[k] extends undefined ? undefined : z.infer<S[k]>
  }
}

type DefineRouteInput<E extends Env, M extends HttpMethod, S extends RouteSchemas> = {
  method: M;
  path: string;
  schemas?: S;
  // Optional non-validation middlewares (e.g., auth, logging)
  middlewares?: Handler<E>[]; // Runs before validators
  handler: Handler<E, string, HonoInputFromRouteSchemas<S>>;
};

export const defineRoute = <E extends Env>() =>
  <M extends HttpMethod, S extends RouteSchemas>(
    def: DefineRouteInput<E, M, S>
  ) => {
    const mws: Handler[] = [];

    if ((def.middlewares?.length ?? 0) > 0) {
      mws.push(...(def.middlewares ?? []));
    }

    if (def.schemas?.param) mws.push(zValidator('param', def.schemas.param));
    if (def.schemas?.query) mws.push(zValidator('query', def.schemas.query));
    if (def.schemas?.json) mws.push(zValidator('json', def.schemas.json));

    return {
      method: def.method,
      path: def.path,
      middlewares: mws as readonly Handler<E>[],
      handler: def.handler,
    } as const;
  }

export const registerRoutes = <E extends Env>(app: Hono<E>, routes: ReturnType<ReturnType<typeof defineRoute<E>>>[]) => {
  routes.forEach((r) => app[r.method](r.path, ...r.middlewares, r.handler));
};
