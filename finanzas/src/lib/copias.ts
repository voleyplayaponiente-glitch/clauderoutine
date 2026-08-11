/**
 * Copias de seguridad completas: descarga en JSON (formato abierto) y Excel,
 * lectura y verificación de un backup, y snapshots automáticos diarios en
 * IndexedDB con retención configurable.
 */
import { construirBackup, verificarIntegridad, type Backup } from '../dominio/backup'
import { cargarSnapshots, guardarSnapshots } from './db'
import { parseJsonSeguro } from './backup'
import type { Configuracion, DatosOperativos } from '../dominio/tipos'
import type { Grupo } from '../dominio/grupo'

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

export function descargarBackupJson(config: Configuracion, datos: DatosOperativos, fecha: string, grupo?: Grupo): void {
  const backup = construirBackup(config, datos, fecha, grupo)
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
  const backup = parseJsonSeguro(await file.text())
  const r = verificarIntegridad(backup)
  if (!r.valido) throw new Error(r.motivo ?? 'Backup no válido')
  return backup as Backup
}

/** ¿Este backup tiene algo dentro? Sirve para no pisar el histórico con nada. */
function tieneContenido(b: Backup): boolean {
  const datos = b.datos as unknown as Record<string, unknown>
  const hayOperaciones = Object.values(datos ?? {}).some((v) => Array.isArray(v) && v.length > 0)
  const hayEmpresa = (b.config?.empresa?.razonSocial ?? '').trim() !== '' || (b.config?.empresa?.cif ?? '').trim() !== ''
  return hayOperaciones || hayEmpresa
}

/**
 * Crea un snapshot diario si aún no existe uno de hoy, respetando la retención.
 *
 * **Nunca guarda un snapshot vacío habiendo otros con datos.** Si la app arranca
 * sin cargar los datos —el navegador ha limpiado el sitio, se abre en otro
 * perfil, o falla la lectura— el snapshot de ese día sería un backup en blanco
 * que ocupa un hueco de la retención y **empuja fuera a los buenos**. En pocos
 * arranques así, el histórico se vacía justo cuando más falta hace.
 */
export async function crearSnapshotDiario(config: Configuracion, datos: DatosOperativos, fecha: string, grupo?: Grupo): Promise<void> {
  const snapshots = await cargarSnapshots()
  if (snapshots.some((s) => s.fecha.slice(0, 10) === fecha.slice(0, 10))) return
  const nuevo = construirBackup(config, datos, fecha, grupo)
  if (!tieneContenido(nuevo) && snapshots.some(tieneContenido)) return
  const lista = [nuevo, ...snapshots].slice(0, RETENCION_DIARIOS)
  await guardarSnapshots(lista)
}

export async function listarSnapshots(): Promise<Backup[]> {
  return cargarSnapshots()
}
