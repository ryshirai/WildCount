/// <reference types="vitest/config" />
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

/** Busts public media URLs (`?v=`) so SW / CDN never keep a stale avatar/stamp. */
const assetVersion =
  process.env.VITE_ASSET_VERSION?.trim() ||
  Date.now().toString(36)

/**
 * Emits `dist/version.json` so clients can detect a new deploy without relying
 * on Service Worker update timing. Must stay out of SW precache (see PWA config).
 */
function wildCountVersionJson(): Plugin {
  return {
    name: 'wildcount-version-json',
    apply: 'build',
    writeBundle(options) {
      const dir = options.dir
      if (!dir) return
      writeFileSync(
        join(dir, 'version.json'),
        `${JSON.stringify({ v: assetVersion })}\n`,
        'utf8',
      )
    },
  }
}

export default defineConfig({
  define: {
    __WC_ASSET_VERSION__: JSON.stringify(assetVersion),
  },
  plugins: [
    vue(),
    wildCountVersionJson(),
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
        // IMPORTANT: do NOT bind navigations to a precached index.html.
        // createHandlerBoundToURL always serves the shell from SW cache, so a
        // normal reload never sees a new deploy until the SW itself updates.
        // Online multiplayer needs fresh HTML; Pages `_redirects` covers SPA
        // deep links. Offline shell is a non-goal for Phase 1.
        // Override vite-plugin-pwa default (`index.html`).
        navigateFallback: undefined,
        // No html — keep entry HTML on the network (no-cache via _headers).
        globPatterns: ['**/*.{js,css,ico,png,svg,webp,woff2}'],
        // Avatars/stamps + deploy probe stay on the network.
        globIgnores: ['**/avatars/**', '**/stamps/**', '**/version.json'],
        // injectRegister:false skips plugin auto-flags; set explicitly.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname === '/version.json',
            handler: 'NetworkOnly',
          },
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
