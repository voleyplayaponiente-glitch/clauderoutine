import { defineConfig } from 'vitest/config'

export default defineConfig({
  // El `postcss.config.js` de la raíz del repo (la app de vóley) lo encuentra
  // Vite subiendo directorios y revienta estos tests, que no tienen CSS alguno.
  // Declarándolo aquí en vacío, deja de buscar.
  css: { postcss: { plugins: [] } },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
