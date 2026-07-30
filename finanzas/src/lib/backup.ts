/**
 * Export/import de la configuración en JSON abierto (nunca dependencia del
 * proveedor). En la Fase 10 se ampliará al backup completo de todos los datos.
 */
import type { Configuracion } from '../dominio/tipos'

export function exportarConfigJson(config: Configuracion): void {
  const contenido = JSON.stringify({ version: 1, tipo: 'configuracion', config }, null, 2)
  const blob = new Blob([contenido], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `configuracion-finanzas-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importarConfigJson(fichero: File): Promise<Configuracion> {
  const texto = await fichero.text()
  const datos = JSON.parse(texto)
  const config = datos?.config ?? datos
  if (!config || typeof config !== 'object' || !('empresa' in config)) {
    throw new Error('El fichero no contiene una configuración válida')
  }
  return config as Configuracion
}
