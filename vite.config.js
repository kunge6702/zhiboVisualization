import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Cache all static assets (hashed JS/CSS, inlined fonts, HTML, SVG icon).
        globPatterns: ['**/*.{js,css,html,woff,woff2,svg}'],
        // SPA offline fallback: any navigation request returns the app shell.
        navigateFallback: '/index.html',
      },
      manifest: {
        name: '信号路由规划',
        short_name: 'SR规划',
        description: '直播信号路由规划与校验工具',
        theme_color: '#0a0e14',
        background_color: '#0a0e14',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        lang: 'zh-CN',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
})
