import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Stamped into the bundle so the React Query cache persister can `buster` (drop) a persisted
// cache whose query shapes predate this build, rather than hydrating an incompatible snapshot.
// Date is read at build time only (Node), never at runtime.
const BUILD_ID = new Date().toISOString();

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
  },
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    babel({ presets: [reactCompilerPreset({ target: '19' })] }),
    tailwindcss(),
    preloadPrimaryFont(),
    VitePWA({
      // Silent update: the new service worker takes over and the fresh shell loads on the next
      // navigation, with no prompt UI (AGENTS.md: keep registration/update UI minimal). skipWaiting
      // + clientsClaim are implied by autoUpdate, so no rider gets stuck on a stale shell.
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // Minimal, offline-first manifest reusing the existing favicons (no bespoke maskable art).
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
          { src: '/favicon.svg', type: 'image/svg+xml', sizes: 'any' },
          { src: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
          { src: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
          { src: '/logo-with-text.png', type: 'image/png', sizes: '512x512' },
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
            // Tiles + style are served immutable with a ?v=<hash>, so CacheFirst is safe and gives
            // a zero-network repaint of a previously-viewed area. Bounded so storage can't grow
            // unbounded as a rider pans around.
            urlPattern: ({ url }) => url.origin === 'https://tiles.freifahren.org',
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
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
