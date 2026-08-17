import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Igual que en el dominio: sin esto Vite encuentra el postcss.config.js de la
  // raíz del repositorio (la app de vóley) y estos tests no llegan a arrancar.
  css: { postcss: { plugins: [] } },
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['test/preparar.ts'],
    setupFiles: ['test/entorno.ts'],
    // Todos los ficheros de test comparten una base de datos. En paralelo se
    // pisarían el `limpiarBd` unos a otros y el fallo aparecería un día sí y
    // otro no, que es la peor clase de test.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
