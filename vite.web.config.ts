import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Build de la versión WEB (navegador). Genera dist-web/ que sirve el servidor Node.
export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  base: '/',
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
      '@renderer': resolve(__dirname, 'src/renderer/src')
    }
  },
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, 'dist-web'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/renderer/web.html')
    }
  }
})
