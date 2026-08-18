import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Sella cada compilación con una versión y la publica en `version.json`.
 *
 * Es lo que permite avisar de «hay una versión nueva» **sin service worker**, y
 * eso importa más de lo que parece: los navegadores no dan service worker fuera
 * de https o localhost, y Norte vive en `http://<ip-del-umbrel>:3012`. Un aviso
 * basado en el service worker no saltaría nunca ahí, que es justo donde hace
 * falta. Comprobado en Chromium: en la IP de red, `navigator.serviceWorker` ni
 * existe.
 */
function versionDeCompilacion(): Plugin {
  const version = process.env.NORTE_VERSION ?? process.env.GITHUB_SHA ?? String(Date.now())
  return {
    name: 'norte-version',
    config: () => ({ define: { __NORTE_VERSION__: JSON.stringify(version) } }),
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version }),
      })
    },
  }
}

/**
 * La app cuelga siempre de la raíz del servidor (nginx en el Umbrel), así que
 * la base es relativa y no hay ninguna variante de GitHub Pages que mantener.
 */
export default defineConfig({
  base: './',
  plugins: [
    react(),
    versionDeCompilacion(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Norte — control presupuestario',
        short_name: 'Norte',
        description: 'Tu dinero, en una pantalla. Tus datos, en tu servidor.',
        theme_color: '#0b0e13',
        background_color: '#0b0e13',
        display: 'standalone',
        lang: 'es',
        start_url: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2}'],
        // La API nunca se cachea: un saldo viejo servido desde el service worker
        // es exactamente la clase de mentira que esta app no puede permitirse.
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],
  server: {
    port: 5173,
    // En desarrollo el navegador habla con Vite y Vite reenvía /api al servidor.
    // Mismo origen que en producción: ni CORS ni cookies de terceros que ajustar.
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${process.env.NORTE_PUERTO ?? 3012}`,
        changeOrigin: false,
      },
    },
  },
})
