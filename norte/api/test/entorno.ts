import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Carga el `.env` en cada proceso de test. Node 22 sabe hacerlo solo, así que
 * no hace falta `dotenv`.
 */
const fichero = resolve(import.meta.dirname, '../.env')
if (existsSync(fichero)) process.loadEnvFile(fichero)

// La base de datos de test es OTRA, siempre. Apuntar los tests a la de
// desarrollo los haría borrar los datos de quien esté trabajando.
const urlTest = process.env.DATABASE_URL_TEST
if (!urlTest) {
  throw new Error(
    'Falta DATABASE_URL_TEST. Los tests necesitan una base de datos propia: nunca se ejecutan ' +
      'contra DATABASE_URL, porque lo primero que hacen es vaciarla.',
  )
}
process.env.DATABASE_URL = urlTest
process.env.NODE_ENV = 'test'
process.env.NORTE_SECRETO_SESION ??= 'secreto-de-pruebas-suficientemente-largo-0123456789'
