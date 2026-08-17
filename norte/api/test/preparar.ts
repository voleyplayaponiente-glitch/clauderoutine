import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Antes de nada, poner la base de datos de test al día con las migraciones.
 * Así un `npm test` recién clonado el repositorio funciona sin pasos previos, y
 * nadie prueba contra un esquema viejo sin enterarse.
 */
export default function preparar() {
  const raiz = resolve(import.meta.dirname, '..')
  const fichero = resolve(raiz, '.env')
  if (existsSync(fichero)) process.loadEnvFile(fichero)

  const url = process.env.DATABASE_URL_TEST
  if (!url) throw new Error('Falta DATABASE_URL_TEST para preparar la base de datos de pruebas.')

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: raiz,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'inherit',
  })
}
