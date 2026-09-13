import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { marked } from 'marked';

// Stamped into the bundle so the React Query cache persister can `buster` (drop) a persisted
// cache whose query shapes predate this build, rather than hydrating an incompatible snapshot.
// Date is read at build time only (Node), never at runtime.
const BUILD_ID = new Date().toISOString();

// Source maps are uploaded to Sentry only when SENTRY_AUTH_TOKEN is present (set in the deploy
// workflow, never on PRs/forks). Without it the build is byte-for-byte unchanged: no maps emitted,
// plugin not loaded.
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;

// Set by `bun run build:ios`. A service worker inside the native WebView serves a stale shell
// (FRE-649), so the PWA plugin is dropped for Capacitor builds.
const isCapacitor = process.env.CAPACITOR === 'true';

// The 400 (regular) weight is our body font and is on the critical render path, but it's only
// discovered after the CSS chain resolves (index.html -> index.css -> @font-face), several round
// trips in on a slow connection. Inject a <link rel="preload"> so the browser starts fetching it
// during HTML parse. The filename is content-hashed, so we read the emitted name from the bundle
// rather than hard-coding it. `crossorigin` is required: font fetches are always CORS-mode, so
// without it the preload wouldn't match the actual request and would be downloaded twice.
function preloadPrimaryFont(): Plugin {
  return {
    name: 'preload-primary-font',
    transformIndexHtml(html, ctx) {
      const font = ctx.bundle
        ? Object.keys(ctx.bundle).find((file) =>
            /ibm-plex-sans-latin-400-normal-[^/]*\.woff2$/.test(file),
          )
        : undefined;
      if (!font) return html;
      return {
        html,
        tags: [
          {
            tag: 'link',
            attrs: {
              rel: 'preload',
              as: 'font',
              type: 'font/woff2',
              href: `/${font}`,
              crossorigin: '',
            },
            injectTo: 'head',
          },
        ],
      };
    },
  };
}

// External links follow the rest of the codebase: new tab, noopener.
marked.use({
  renderer: {
    link(token) {
      const text = this.parser.parseInline(token.tokens);
      return `<a href="${token.href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    },
  },
});

// Compiles src/content/announcements/*.md at build time, so no markdown parser reaches the client.
// Each file yields two modules, kept apart so a growing changelog can't grow the entry chunk:
//   `<file>.md?meta` -> frontmatter, imported eagerly for the unread badge
//   `<file>.md`      -> the rendered HTML body, imported lazily by the article view
function announcementsMarkdown(): Plugin {
  return {
    name: 'announcements-markdown',
    enforce: 'pre',
    transform(code, id) {
      const [file, query] = id.split('?');
      if (!file?.endsWith('.md') || !file.includes('/src/content/')) return null;
      // Parsed, not compared: dev appends its own params, so this arrives as `?import&meta`.
      const isMeta = new URLSearchParams(query).has('meta');

      const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(code);
      const body = match ? code.slice(match[0].length).trim() : code.trim();

      if (!isMeta) {
        return {
          code: `export default ${JSON.stringify(body ? marked.parse(body, { async: false }) : '')}`,
          map: null,
        };
      }

      // Flat `key: value` scalars only, hence no YAML dependency.
      const frontmatter: Record<string, string> = {};
      for (const line of match?.[1].split('\n') ?? []) {
        const separator = line.indexOf(':');
        if (separator === -1) continue;
        frontmatter[line.slice(0, separator).trim()] = line
          .slice(separator + 1)
          .trim()
          .replace(/^['"]|['"]$/g, '');
      }

      // `<slug>.<lang>.md`, split on the final dot so a slug may contain dots.
      const [slug, lang] = path.basename(file, '.md').split(/\.(?=[^.]+$)/);

      return {
        code: `export default ${JSON.stringify({
          slug,
          lang,
          title: frontmatter.title ?? '',
          description: frontmatter.description ?? '',
          date: frontmatter.date ?? '',
          hasBody: body.length > 0,
        })}`,
        map: null,
      };
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
    // Compile-time flag so the native-only branches (e.g. @sentry/capacitor) are dead-code
    // eliminated from the web bundle.
    __CAPACITOR__: JSON.stringify(isCapacitor),
  },
  // 'hidden' emits source maps for the upload but ships no sourceMappingURL comment, so the maps are
  // never referenced by (or served to) clients; the Sentry plugin deletes them after upload.
  build: { sourcemap: sentryAuthToken ? 'hidden' : false },
  plugins: [
    announcementsMarkdown(),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    babel({ presets: [reactCompilerPreset({ target: '19' })] }),
    tailwindcss(),
    preloadPrimaryFont(),
    VitePWA({
      // Keep the virtual registration module resolvable for native builds without emitting a
      // service worker there. The call site itself is compile-time gated by __CAPACITOR__.
      disable: isCapacitor,
      // Activate an available update immediately so long-lived tabs do not remain on an old
      // release. vite-plugin-pwa reloads once after the new worker takes control.
      registerType: 'autoUpdate',
      // Register the SW ourselves in main.tsx instead of letting the plugin inject registerSW.js.
      // That generated snippet calls navigator.serviceWorker.register() with no .catch, so a
      // rejection (common in bots/crawlers and locked-down WebViews) surfaces as an unhandled
      // rejection and floods Sentry (WEB-APP-1). Our own registration swallows the rejection.
      injectRegister: false,
      // Icons live in public/ (generated from the source app-icon.png, matching the native icon).
      manifest: {
        name: 'FreiFahren',
        short_name: 'FreiFahren',
        description:
          'Freifahren ist eine Webapp, die es Nutzern ermöglicht Ticketkontrollen zu melden und sich vor Kontrollen zu warnen.',
        lang: 'de',
        // Keep theme/background in sync with --card in src/index.css and index.html's theme-color.
        theme_color: '#25272b',
        background_color: '#25272b',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
          { src: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
          { src: '/pwa-192x192.png', type: 'image/png', sizes: '192x192' },
          { src: '/pwa-512x512.png', type: 'image/png', sizes: '512x512' },
          {
            src: '/pwa-maskable-512x512.png',
            type: 'image/png',
            sizes: '512x512',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // injectRegister is disabled, so configure the update lifecycle explicitly rather than
        // relying on vite-plugin-pwa's injected registration snippet to do it for us.
        skipWaiting: true,
        clientsClaim: true,
        // Precache the immutable, content-hashed assets: JS/CSS, the IBM Plex woff2 files, and the
        // lazy maplibre chunk (~1 MB, under the 2 MB default cap) so the map engine paints offline
        // too. Cache-first is correct for these — a new build gets new filenames, so they're never
        // stale. The HTML document is deliberately handled by the network-first rule below, not this
        // precache, so a deploy is never served stale.
        globPatterns: ['**/*.{js,css,woff2,svg,png,ico}'],
        // Disable navigateFallback (vite-plugin-pwa defaults it to index.html). Its NavigationRoute is
        // registered *before* runtimeCaching and first-match-wins, so a precache navigateFallback would
        // shadow the network-first rule below and keep serving the stale shell. With it off, the
        // network-first navigation rule is the sole navigation handler; it caches each visited shell, so
        // returning visitors still cold-boot offline (previously-visited pages only — the best-effort web
        // offline of ADR 0005). It only matches navigation requests, so it never touches the cross-origin
        // tile/API fetches.
        navigateFallback: null,
        runtimeCaching: [
          {
            // The HTML document is network-first: a fresh deploy is picked up on the very next load,
            // not one navigation later (the autoUpdate lag) and never needing a manual cache clear.
            // The hashed JS/CSS it references stay precache/cache-first (immutable, so never stale).
            // The last successful shell is cached, so a returning visitor still cold-boots offline.
            // See ADR 0008.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'app-shell',
              // Fall back to the cached shell quickly on a flaky/tunnel connection rather than hanging.
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Style JSON is the one mutable pointer (it names the current immutable /v<sha>/ archive).
            // StaleWhileRevalidate paints instantly from cache but refreshes in the background, so a
            // new tile-server deploy is picked up on the next load — never the 30-day staleness a
            // CacheFirst rule would impose.
            urlPattern: ({ url }) =>
              url.origin === 'https://tiles.freifahren.org' && url.pathname.endsWith('.json'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'map-style',
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Glyph PBFs are immutable, so CacheFirst is safe (currently unused — the basemap has no
            // text layers — but ready for when labels are added).
            urlPattern: ({ url }) =>
              url.origin === 'https://tiles.freifahren.org' && url.pathname.endsWith('.pbf'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-fonts',
              expiration: { maxEntries: 256, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // The PMTiles archive (.pmtiles) is deliberately NOT given a runtime cache rule: it's read
          // via HTTP range requests, and a CacheFirst store could hand a full 200 back to a range
          // request and corrupt the read. Range reads go straight to the network (the immutable
          // /v<sha>/ archive is still cached by the browser's HTTP cache).
        ],
      },
      devOptions: { enabled: false },
    }),
    // Must be last so it sees the final emitted bundle + maps. No-op without an auth token.
    ...(sentryAuthToken
      ? [
          sentryVitePlugin({
            org: 'freifahren-web',
            project: 'web-app',
            authToken: sentryAuthToken,
            // EU region: upload to the de.sentry.io API, matching the org's data region.
            url: 'https://de.sentry.io',
            // Tie uploaded maps to the same release name the SDK reports at runtime (__BUILD_ID__).
            release: { name: BUILD_ID },
            // Don't deploy the maps as public assets — Sentry has them after upload.
            sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
            telemetry: false,
          }),
        ]
      : []),
  ],
  server: {
    port: 1871,
    host: true,
  },
  preview: {
    // Deliberately a different port from `server`: `preview` ships the real service worker, and a
    // SW is scoped per origin (host + port). Sharing 1871 with `bun run dev` (which ships no SW,
    // devOptions.enabled: false) lets a preview SW keep controlling dev and serve a stale precache.
    // Different port = different origin = the preview SW can never bleed into the dev server.
    port: 1872,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Shared city registry (small static data), bundled into the client. Vite does not
      // read tsconfig `paths`, so the alias is declared here too.
      '@freifahren/cities': path.resolve(__dirname, '../cities/src/index.ts'),
    },
  },
});
