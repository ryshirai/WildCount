/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

/** Busts public media URLs (`?v=`) so SW / CDN never keep a stale avatar/stamp. */
const assetVersion =
  process.env.VITE_ASSET_VERSION?.trim() ||
  Date.now().toString(36)

export default defineConfig({
  define: {
    __WC_ASSET_VERSION__: JSON.stringify(assetVersion),
  },
  plugins: [
    vue(),
    VitePWA({
      // autoUpdate + virtual:pwa-register (see src/pwa.ts) reloads tabs when a
      // new SW activates. Default inject script only registers — no reload.
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: [
        'favicon.svg',
        'favicon-32.png',
        'icons/apple-touch-icon.png',
        'brand/logo-mark.webp',
      ],
      manifest: {
        name: 'Wild Count',
        short_name: 'Wild Count',
        description:
          '見えている札だけで合計を読み合う、推理・ブラフのリアルタイム対戦。',
        lang: 'ja',
        theme_color: '#0b1220',
        background_color: '#0b1220',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        categories: ['games', 'entertainment'],
        icons: [
          {
            src: '/icons/app-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/app-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/app-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
        // Avatars/stamps stay on the network — a precached 404 or stale body
        // shows as a broken image until hard refresh (esp. newly added animals).
        globIgnores: ['**/avatars/**', '**/stamps/**'],
        // injectRegister:false skips plugin auto-flags; set explicitly.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/avatars/') ||
              url.pathname.startsWith('/stamps/'),
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
    // Phase 1: proxy API + WS to wrangler dev (default :8787)
    proxy: {
      '/api': {
        target: process.env.VITE_WORKER_PROXY ?? 'http://127.0.0.1:8787',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts', 'worker/**/*.test.ts'],
  },
})
