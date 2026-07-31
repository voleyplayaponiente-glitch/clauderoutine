/**
 * Copias de seguridad completas: descarga en JSON (formato abierto) y Excel,
 * lectura y verificación de un backup, y snapshots automáticos diarios en
 * IndexedDB con retención configurable.
 */
import { construirBackup, verificarIntegridad, type Backup } from '../dominio/backup'
import { cargarSnapshots, guardarSnapshots } from './db'
import type { Configuracion, DatosOperativos } from '../dominio/tipos'

const RETENCION_DIARIOS = 7

function descargar(contenido: string, nombre: string, tipo: string) {
  const blob = new Blob([contenido], { type: tipo })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

export function descargarBackupJson(config: Configuracion, datos: DatosOperativos, fecha: string): void {
  const backup = construirBackup(config, datos, fecha)
  descargar(JSON.stringify(backup, null, 2), `backup-finanzas-${fecha}.json`, 'application/json')
}

/** Exporta todos los datos a un Excel con una hoja por colección. */
export async function descargarBackupExcel(datos: DatosOperativos, fecha: string): Promise<void> {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  for (const [clave, valor] of Object.entries(datos)) {
    if (!Array.isArray(valor) || valor.length === 0) continue
    const ws = XLSX.utils.json_to_sheet(valor as any[])
    XLSX.utils.book_append_sheet(wb, ws, clave.slice(0, 31))
  }
  if (wb.SheetNames.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([['Sin datos']])
    XLSX.utils.book_append_sheet(wb, ws, 'Vacío')
  }
  XLSX.writeFile(wb, `backup-finanzas-${fecha}.xlsx`)
}

/** Lee y valida un backup desde un fichero. Lanza si la integridad falla. */
export async function leerBackup(file: File): Promise<Backup> {
  const backup = JSON.parse(await file.text())
  const r = verificarIntegridad(backup)
  if (!r.valido) throw new Error(r.motivo ?? 'Backup no válido')
  return backup as Backup
}

/** Crea un snapshot diario si aún no existe uno de hoy, respetando la retención. */
export async function crearSnapshotDiario(config: Configuracion, datos: DatosOperativos, fecha: string): Promise<void> {
  const snapshots = await cargarSnapshots()
  if (snapshots.some((s) => s.fecha.slice(0, 10) === fecha.slice(0, 10))) return
  const nuevo = construirBackup(config, datos, fecha)
  const lista = [nuevo, ...snapshots].slice(0, RETENCION_DIARIOS)
  await guardarSnapshots(lista)
}

export async function listarSnapshots(): Promise<Backup[]> {
  return cargarSnapshots()
}
