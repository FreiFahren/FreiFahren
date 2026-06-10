/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Build-time constant injected by `define` in vite.config.ts; used to bust the persisted
// React Query cache across deploys.
declare const __BUILD_ID__: string;
