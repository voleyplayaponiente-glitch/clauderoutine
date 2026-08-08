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

/**
 * JSON.parse que descarta las claves capaces de contaminar el prototipo
 * (`__proto__`, `constructor`, `prototype`). Todo JSON que entra en la app
 * (backups, configuración importada) debe pasar por aquí.
 */
const CLAVES_PELIGROSAS = new Set(['__proto__', 'constructor', 'prototype'])
export function parseJsonSeguro(texto: string): unknown {
  return JSON.parse(texto, (clave, valor) => (CLAVES_PELIGROSAS.has(clave) ? undefined : valor))
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

/**
 * Elimina las credenciales de los conectores (token, secreto del servidor) para
 * que NUNCA salgan en un fichero de backup en claro. Al restaurar se re-introducen.
 */
export function redactarCredenciales(config: Configuracion): Configuracion {
  return {
    ...config,
    conectores: (config.conectores ?? []).map((c) => ({ ...c, token: undefined, secretoServidor: undefined })),
  }
}

/** Construye un backup con su checksum. `fecha` se pasa desde fuera (motor puro). */
export function construirBackup(config: Configuracion, datos: DatosOperativos, fecha: string): Backup {
  const limpia = redactarCredenciales(config)
  return { version: VERSION_BACKUP, tipo: 'backup-completo', fecha, checksum: calcularChecksum({ config: limpia, datos }), config: limpia, datos }
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

/**
 * ¿El backup pertenece a la misma sociedad que está activa? Con varias empresas
 * en el grupo, restaurar en la equivocada machacaría la contabilidad de otra
 * entidad jurídica, así que hay que avisar antes de sobrescribir.
 *
 * Manda el CIF (identifica a la sociedad); si alguno falta se compara la razón
 * social normalizada. Si no hay ni CIF ni nombre en ninguno de los dos lados no
 * se puede afirmar que difieran, y no se alarma sin motivo.
 */
export function mismaEmpresa(
  backup: { cif?: string; razonSocial?: string },
  activa: { cif?: string; razonSocial?: string },
): boolean {
  const norm = (s?: string) => (s ?? '').toUpperCase().replace(/[\s.,-]/g, '')
  const cifA = norm(backup.cif)
  const cifB = norm(activa.cif)
  if (cifA !== '' && cifB !== '') return cifA === cifB
  const nomA = norm(backup.razonSocial)
  const nomB = norm(activa.razonSocial)
  if (nomA !== '' && nomB !== '') return nomA === nomB
  return true
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
