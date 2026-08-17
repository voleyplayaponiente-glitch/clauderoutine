import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'

// Servida bajo /clauderoutine/finanzas/ en GitHub Pages; rutas relativas en local.
const base = process.env.GITHUB_PAGES ? '/clauderoutine/finanzas/' : './'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Gestión Financiera',
        short_name: 'Finanzas',
        description: 'Gestión financiera integral: ventas, compras, caja, banco, tesorería',
        theme_color: '#0a84ff',
        background_color: '#f5f5f7',
        display: 'standalone',
        lang: 'es',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // `mjs` incluido a propósito: el worker de pdf.js se sirve con esa
      // extensión y sin él la lectura de PDF no funcionaba sin conexión.
      workbox: { globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2}'] },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
} as any)
