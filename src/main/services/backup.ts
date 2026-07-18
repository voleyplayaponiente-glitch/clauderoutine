import { copyFileSync, existsSync } from 'fs'
import { dialog } from 'electron'
import { cerrarDb, reabrirDb, rutaBaseDatos } from '../db/database'

/** Exporta (copia) el fichero SQLite completo a la ubicación elegida por el usuario. */
export async function exportarCopia(): Promise<{ ok: boolean; ruta?: string; error?: string }> {
  const stamp = new Date().toISOString().slice(0, 10)
  const res = await dialog.showSaveDialog({
    title: 'Guardar copia de seguridad',
    defaultPath: `copia-gestor-laboral-${stamp}.db`,
    filters: [{ name: 'Base de datos', extensions: ['db'] }]
  })
  if (res.canceled || !res.filePath) return { ok: false }
  try {
    // WAL: forzamos un checkpoint copiando el fichero principal ya consolidado.
    copyFileSync(rutaBaseDatos(), res.filePath)
    return { ok: true, ruta: res.filePath }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

/**
 * Importa/restaura una copia. Sobrescribe la base de datos actual.
 * Cierra la conexión, copia el fichero y la reabre.
 */
export async function importarCopia(): Promise<{ ok: boolean; error?: string }> {
  const res = await dialog.showOpenDialog({
    title: 'Restaurar copia de seguridad',
    filters: [{ name: 'Base de datos', extensions: ['db'] }],
    properties: ['openFile']
  })
  if (res.canceled || !res.filePaths[0]) return { ok: false }
  const origen = res.filePaths[0]
  if (!existsSync(origen)) return { ok: false, error: 'El fichero no existe.' }
  try {
    cerrarDb()
    copyFileSync(origen, rutaBaseDatos())
    reabrirDb()
    return { ok: true }
  } catch (e) {
    // Intentamos reabrir de todas formas para no dejar la app sin BD.
    reabrirDb()
    return { ok: false, error: (e as Error).message }
  }
}
