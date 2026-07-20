// Copia de seguridad automática: una vez al día se guarda una copia íntegra
// de la base de datos en <datos>/backups/ y se conservan las 30 más recientes.
// Usa la API de backup en caliente de SQLite (copia consistente aunque se esté
// escribiendo), así que no hace falta parar la aplicación.
import { existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs'
import { join } from 'path'
import { getDb, carpetaDatos } from '../main/db/database'

const MAX_COPIAS = 30
const CADA_HORA_MS = 60 * 60 * 1000

const carpetaBackups = (): string => join(carpetaDatos(), 'backups')
const nombreDeHoy = (): string => `copia-auto-${new Date().toISOString().slice(0, 10)}.db`

async function copiarSiTocaHoy(): Promise<void> {
  try {
    const dir = carpetaBackups()
    mkdirSync(dir, { recursive: true })
    const destino = join(dir, nombreDeHoy())
    if (existsSync(destino)) return // la copia de hoy ya está hecha
    await getDb().backup(destino)
    rotar(dir)
    console.log(`💾 Copia de seguridad automática guardada: ${destino}`)
  } catch (e) {
    console.error('⚠️  Falló la copia de seguridad automática:', (e as Error).message)
  }
}

function rotar(dir: string): void {
  const copias = readdirSync(dir)
    .filter((f) => f.startsWith('copia-auto-') && f.endsWith('.db'))
    .sort() // el nombre lleva la fecha ISO: orden alfabético = orden cronológico
  while (copias.length > MAX_COPIAS) unlinkSync(join(dir, copias.shift()!))
}

/** Hace una copia al arrancar (si aún no hay una de hoy) y revisa cada hora. */
export function iniciarBackupAutomatico(): void {
  void copiarSiTocaHoy()
  setInterval(() => void copiarSiTocaHoy(), CADA_HORA_MS)
}
