// Reverse proxy so PostHog traffic goes through our own domain, not *.posthog.com (which ad blockers block).
const API_HOST = 'eu.i.posthog.com';
const ASSET_HOST = 'eu-assets.i.posthog.com';
const PREFIX = '/relay';

function withHostMetadata(response: Response, url: URL, method: string): Response {
  if (method !== 'GET' || !response.headers.get('content-type')?.includes('text/html')) {
    return response;
  }

  const origin = url.origin;
  const canonicalUrl = `${origin}/`;
  // Every route shares this single index.html (SPA, no per-route head), so only each host's
  // root is a distinct, indexable "product for city X" page. Deep routes (reports, station
  // detail, settings, ...) would otherwise all present identical head metadata to crawlers.
  const isRoot = url.pathname === '/';

  const rewriter = new HTMLRewriter()
    .on('meta[property="og:url"]', {
      element(element) {
        element.setAttribute('content', canonicalUrl);
      },
    })
    .on('meta[property="og:image"]', {
      element(element) {
        element.setAttribute('content', `${canonicalUrl}og-image.jpg`);
      },
    })
    .on('link[rel="canonical"]', {
      element(element) {
        element.setAttribute('href', canonicalUrl);
      },
    });

  if (!isRoot) {
    rewriter.on('head', {
      element(element) {
        element.append('<meta name="robots" content="noindex, nofollow">', { html: true });
      },
    });
  }

  const transformed = rewriter.transform(response);
  if (!isRoot) {
    transformed.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  return transformed;
}

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
      return withHostMetadata(await env.ASSETS.fetch(request), url, request.method);
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
