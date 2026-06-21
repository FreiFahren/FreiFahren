import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { sentryVitePlugin } from '@sentry/vite-plugin';

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
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    babel({ presets: [reactCompilerPreset({ target: '19' })] }),
    tailwindcss(),
    preloadPrimaryFont(),
    // `false` is a valid (skipped) Vite plugin slot — keeps the SW out of Capacitor builds.
    !isCapacitor &&
      VitePWA({
        // Silent update: the new service worker takes over and the fresh shell loads on the next
        // navigation, with no prompt UI (AGENTS.md: keep registration/update UI minimal). skipWaiting
        // + clientsClaim are implied by autoUpdate, so no rider gets stuck on a stale shell.
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        // Icons are generated into public/ from packages/app's app-icon.png (matches the native icon).
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
          // Precache the app shell: HTML, hashed JS/CSS, the IBM Plex woff2 files, and the lazy
          // maplibre chunk (~1 MB, under the 2 MB default cap) so the map engine paints offline too.
          globPatterns: ['**/*.{js,css,html,woff2,svg,png,ico}'],
          // Offline SPA navigations resolve to the precached shell. Navigation routing only matches
          // navigation requests, so it doesn't touch the cross-origin tile/API fetches, nor does it
          // clash with wrangler's server-side single-page-application fallback (that only runs online).
          navigateFallback: '/index.html',
          runtimeCaching: [
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
    },
  },
});
