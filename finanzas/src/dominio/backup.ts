/**
 * Copia de seguridad completa y verificación de integridad. El backup incluye
 * un checksum sobre su contenido para detectar corrupción o manipulación antes
 * de restaurar. Formato abierto (JSON) para no depender del proveedor.
 */
import type { Configuracion, DatosOperativos } from './tipos'

export const VERSION_BACKUP = 1

export interface Backup {
  version: number
  tipo: 'backup-completo'
  fecha: string
  checksum: string
  config: Configuracion
  datos: DatosOperativos
}

/** Serialización determinista (claves ordenadas) para un checksum estable. */
export function stableStringify(valor: unknown): string {
  if (valor === null || typeof valor !== 'object') return JSON.stringify(valor)
  if (Array.isArray(valor)) return `[${valor.map(stableStringify).join(',')}]`
  const claves = Object.keys(valor as Record<string, unknown>).sort()
  return `{${claves.map((k) => `${JSON.stringify(k)}:${stableStringify((valor as Record<string, unknown>)[k])}`).join(',')}}`
}

/** Hash djb2 en hexadecimal sobre la serialización determinista. */
export function calcularChecksum(obj: unknown): string {
  const s = stableStringify(obj)
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h.toString(16).padStart(8, '0')
}

/** Construye un backup con su checksum. `fecha` se pasa desde fuera (motor puro). */
export function construirBackup(config: Configuracion, datos: DatosOperativos, fecha: string): Backup {
  return { version: VERSION_BACKUP, tipo: 'backup-completo', fecha, checksum: calcularChecksum({ config, datos }), config, datos }
}

/** Verifica que el backup es estructuralmente válido y su checksum coincide. */
export function verificarIntegridad(b: unknown): { valido: boolean; motivo?: string } {
  if (!b || typeof b !== 'object') return { valido: false, motivo: 'El fichero no es un objeto válido' }
  const bk = b as Partial<Backup>
  if (bk.tipo !== 'backup-completo') return { valido: false, motivo: 'No es un backup completo' }
  if (!bk.config || !bk.datos) return { valido: false, motivo: 'Faltan datos o configuración' }
  if (!bk.checksum) return { valido: false, motivo: 'El backup no tiene checksum' }
  const recalculado = calcularChecksum({ config: bk.config, datos: bk.datos })
  if (recalculado !== bk.checksum) return { valido: false, motivo: 'El checksum no coincide: el backup está corrupto o alterado' }
  return { valido: true }
}

/** Recuento de registros por colección, para mostrar antes de restaurar. */
export function resumenBackup(datos: DatosOperativos): { clave: string; etiqueta: string; n: number }[] {
  const et: Record<string, string> = {
    terceros: 'Terceros', ventas: 'Ventas', compras: 'Compras', cuentasTesoreria: 'Cuentas', movimientos: 'Mov. tesorería',
    arqueos: 'Arqueos', almacenes: 'Almacenes', articulos: 'Artículos', movimientosStock: 'Mov. stock',
    deudas: 'Deudas', deudores: 'Deudores', presupuestos: 'Presupuestos', importaciones: 'Importaciones', recurrentes: 'Recurrentes',
  }
  return Object.entries(et).map(([clave, etiqueta]) => ({ clave, etiqueta, n: Array.isArray((datos as any)[clave]) ? (datos as any)[clave].length : 0 }))
}
