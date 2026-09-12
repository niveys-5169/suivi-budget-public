import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    root: 'public',
    plugins: [
      react(),
      // PWA: installable app, app-shell precache, runtime cache for Firestore.
      // Disabled in dev (devOptions.enabled: false) to avoid SW cache during HMR.
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['icon.svg', 'icon-maskable.svg', 'icons/*.png'],
        manifest: {
          name: 'AURUM — Suivi Budget',
          short_name: 'AURUM',
          description: 'Private Wealth Management — finance personnelle premium.',
          lang: 'fr-FR',
          theme_color: '#0B0B14',
          background_color: '#0B0B14',
          display: 'standalone',
          display_override: ['standalone', 'minimal-ui'],
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          prefer_related_applications: false,
          icons: [
            // PNG icons — required by iOS (SVG not supported for home screen icon)
            { src: 'icons/icon-60.png', sizes: '60x60', type: 'image/png' },
            { src: 'icons/icon-76.png', sizes: '76x76', type: 'image/png' },
            { src: 'icons/icon-80.png', sizes: '80x80', type: 'image/png' },
            { src: 'icons/icon-87.png', sizes: '87x87', type: 'image/png' },
            { src: 'icons/icon-120.png', sizes: '120x120', type: 'image/png' },
            { src: 'icons/icon-152.png', sizes: '152x152', type: 'image/png' },
            { src: 'icons/icon-167.png', sizes: '167x167', type: 'image/png' },
            { src: 'icons/icon-180.png', sizes: '180x180', type: 'image/png' },
            { src: 'icons/icon-1024.png', sizes: '1024x1024', type: 'image/png' },
            // Maskable icon — for Android adaptive icons
            {
              src: 'icons/icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
            // SVG fallback for browsers that support it
            { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          navigateFallback: '/index.html',
          runtimeCaching: [
            {
              // Google Fonts — long-lived, cache aggressively.
              urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'aurum-fonts',
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
            {
              // Firestore reads: stale-while-revalidate so app shows last-known data offline.
              urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'aurum-firestore',
                networkTimeoutSeconds: 4,
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        devOptions: { enabled: false },
      }),
      // Run `npm run analyze` to generate dist/stats.html and open it in the browser.
      process.env.ANALYZE === 'true' &&
        visualizer({
          open: true,
          filename: '../dist/stats.html',
          gzipSize: true,
          brotliSize: true,
        }),
      // Sentry source-map upload — only active when VITE_SENTRY_DSN is set (production).
      env.VITE_SENTRY_DSN &&
        sentryVitePlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
          sourcemaps: { filesToDeleteAfterUpload: ['../dist/**/*.map'] },
          release: { name: process.env.VITE_SENTRY_RELEASE },
          telemetry: false,
        }),
    ].filter(Boolean),
    server: {
      port: 3000,
      allowedHosts: ['sb-944xt91lg6c6.vercel.run'],
      headers: {
        'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
        'Cross-Origin-Embedder-Policy': 'unsafe-none',
      },
    },
    build: {
      outDir: '../dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          main: 'public/index.html',
        },
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('firebase')) return 'vendor-firebase';
              if (id.includes('recharts') || id.includes('d3')) return 'vendor-charts';
              if (id.includes('framer-motion')) return 'vendor-motion';
              if (id.includes('react-intl')) return 'vendor-intl';
            }
          },
        },
      },
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },
  };
});
