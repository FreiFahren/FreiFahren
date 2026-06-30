// Reverse proxy so PostHog traffic goes through our own domain, not *.posthog.com (which ad blockers block).
const API_HOST = 'eu.i.posthog.com';
const ASSET_HOST = 'eu-assets.i.posthog.com';
const PREFIX = '/relay';

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

interface Ctx {
  waitUntil(promise: Promise<unknown>): void;
}

export default {
  async fetch(request: Request, env: Env, ctx: Ctx): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(`${PREFIX}/`)) {
      return env.ASSETS.fetch(request);
    }

    const upstreamPath = url.pathname.slice(PREFIX.length) + url.search;

    if (url.pathname.startsWith(`${PREFIX}/static/`)) {
      // Fetch without the original request: the asset CDN 302s to a login page if it sees an Origin header.
      const cache = (caches as unknown as { default: Cache }).default;
      const cacheKey = new Request(url.toString(), request);
      let response = await cache.match(cacheKey);
      if (!response) {
        response = await fetch(`https://${ASSET_HOST}${upstreamPath}`);
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      }
      return response;
    }

    const apiRequest = new Request(`https://${API_HOST}${upstreamPath}`, request);
    apiRequest.headers.delete('cookie');
    return fetch(apiRequest);
  },
};
