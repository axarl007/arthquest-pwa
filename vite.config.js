import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Served at https://axarl007.github.io/arthquest-pwa/ — base must match the
// repo name so built asset URLs resolve under the GitHub Pages subpath.
const BASE = '/arthquest-pwa/';

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-icons/icon.svg'],
      manifest: {
        id: BASE,
        name: 'ArthQuest',
        short_name: 'ArthQuest',
        description: 'Offline-first budgeting and savings quests, in Indian rupees.',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0b0f18',
        theme_color: '#0b0f18',
        icons: [
          { src: 'pwa-icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'pwa-icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,woff,png,svg,ico}'],
        // The Material Symbols icon font ships as one ~4MB woff2 (the full
        // glyph set) — raise the default 2MB precache cap so it's still
        // cached for full offline use rather than silently excluded.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // App data lives in localStorage, not network requests, so a
        // cache-first precache of the built app shell is sufficient —
        // there's no API traffic to runtime-cache.
        navigateFallback: `${BASE}index.html`,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: false,
  },
});
