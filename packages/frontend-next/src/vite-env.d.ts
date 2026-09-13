/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Build-time constant injected by `define` in vite.config.ts; used to bust the persisted
// React Query cache across deploys.
declare const __BUILD_ID__: string;

// Build-time flag (true only for `bun run build:ios`); gates native-only code out of the web bundle.
declare const __CAPACITOR__: boolean;

// Markdown under src/content is compiled at build time by the `announcements-markdown` plugin in
// vite.config.ts, which emits two modules per file. `tsc -b` runs before vite, so both shapes have
// to be declared here.
declare module '*.md' {
  /** The rendered HTML body, empty when the file was frontmatter only. */
  const html: string;
  export default html;
}

declare module '*.md?meta' {
  const meta: {
    slug: string;
    lang: string;
    title: string;
    description: string;
    date: string;
    hasBody: boolean;
  };
  export default meta;
}
