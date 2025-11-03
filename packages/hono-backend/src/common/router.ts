import { z} from 'zod';

import { Handler, Hono, Env } from 'hono';

import {zValidator} from '@hono/zod-validator'

type HttpMethod = 'get' | 'post' | 'put';
type RouteSchemas = {
  json?: z.ZodTypeAny;
  param?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
};

type DefineRouteInput<E extends Env, M extends HttpMethod, S extends RouteSchemas> = {
  method: M;
  path: string;
  schemas?: S;
  // Optional non-validation middlewares (e.g., auth, logging)
  middlewares?: Handler<E>[]; // runs before validators
  handler: Handler<E>;
};

export const defineRoute = <E extends Env>() =>
  <M extends HttpMethod, S extends RouteSchemas>(
    def: DefineRouteInput<E, M, S>
  ) => {
    const mws: Handler[] = [];

    // user-provided non-validation middlewares first
    if (def.middlewares?.length) {
      mws.push(...def.middlewares);
    }

    // then validators derived from optional schemas
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

export const register = <E extends Env>(app: Hono<E>, r: ReturnType<ReturnType<typeof defineRoute<E>>>) => {
  app[r.method](r.path, ...r.middlewares, r.handler);
};
