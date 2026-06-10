import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';

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
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    babel({ presets: [reactCompilerPreset({ target: '19' })] }),
    tailwindcss(),
    preloadPrimaryFont(),
  ],
  server: {
    port: 1871,
  },
  preview: {
    port: 1871,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
