/**
 * Capa de importación con efectos: lectura de ficheros (Excel/CSV/PDF),
 * construcción de entidades a partir de filas validadas y clave de duplicado.
 */
import { parsearCSV } from '../dominio/csv'
import { nuevoId } from '../dominio/id'
import type { DatosOperativos, Articulo, Tercero, MovimientoTesoreria } from '../dominio/tipos'

export type OrigenFichero = 'EXCEL' | 'CSV' | 'PDF' | 'DESCONOCIDO'

export interface FicheroLeido {
  cabeceras: string[]
  filas: string[][]
  origen: OrigenFichero
}

export function detectarTipo(nombre: string): OrigenFichero {
  const ext = nombre.toLowerCase().split('.').pop() ?? ''
  if (['xlsx', 'xls', 'xlsm'].includes(ext)) return 'EXCEL'
  if (['csv', 'tsv', 'txt'].includes(ext)) return 'CSV'
  if (ext === 'pdf') return 'PDF'
  return 'DESCONOCIDO'
}

/** Lee un fichero a matriz de strings. La primera fila son las cabeceras. */
export async function leerFichero(file: File): Promise<FicheroLeido> {
  const origen = detectarTipo(file.name)
  if (origen === 'PDF') {
    // Nunca inventamos datos de un PDF: se avisa para completar a mano.
    throw new Error('Los PDF de factura se completan a mano junto al documento (no se extraen automáticamente en la v1).')
  }
  let matriz: string[][]
  if (origen === 'EXCEL') {
    // Carga diferida de SheetJS: solo pesa cuando se importa un Excel.
    const XLSX = await import('xlsx')
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array', cellDates: false })
    const hoja = wb.Sheets[wb.SheetNames[0]]
    matriz = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: false, defval: '' }) as string[][]
    matriz = matriz.filter((f) => f.some((c) => String(c).trim() !== ''))
  } else {
    matriz = parsearCSV(await file.text())
  }
  if (matriz.length === 0) return { cabeceras: [], filas: [], origen }
  return { cabeceras: matriz[0].map((c) => String(c)), filas: matriz.slice(1).map((f) => f.map((c) => String(c))), origen }
}

type Valores = Record<string, string | number | null>

/** Construye una entidad a partir de los valores validados de una fila. */
export function construirEntidad(
  destinoId: string,
  v: Valores,
  origen: OrigenFichero,
  ctx: { cuentaId?: string },
): { id: string } {
  const trazaOrigen = origen === 'EXCEL' ? 'EXCEL' : origen === 'CSV' ? 'CSV' : 'MANUAL'
  const base = { id: nuevoId(), creadoEn: new Date().toISOString(), creadoPor: 'importacion', origen: trazaOrigen as any }

  if (destinoId === 'articulos') {
    const a: Articulo = {
      ...base,
      referencia: String(v.referencia ?? ''),
      descripcion: String(v.descripcion ?? ''),
      ean: v.ean ? String(v.ean) : undefined,
      familia: v.familia ? String(v.familia) : undefined,
      pvp: Number(v.pvp ?? 0),
      stockMinimo: Number(v.stockMinimo ?? 0),
      stockOptimo: 0,
    }
    return a
  }
  if (destinoId === 'terceros') {
    const t: Tercero = {
      ...base,
      nombre: String(v.nombre ?? ''),
      cif: String(v.cif ?? ''),
      esProveedor: true,
      esCliente: false,
      esVinculada: false,
      iban: v.iban ? String(v.iban) : undefined,
      condicionesPagoDias: v.condicionesPagoDias != null ? Number(v.condicionesPagoDias) : 30,
    }
    return t
  }
  // movimientos-banco
  const m: MovimientoTesoreria = {
    ...base,
    cuentaId: ctx.cuentaId ?? '',
    fecha: String(v.fecha ?? ''),
    concepto: String(v.concepto ?? ''),
    importe: Number(v.importe ?? 0),
    clase: 'OTRO',
    conciliado: false,
    referencia: v.referencia ? String(v.referencia) : undefined,
  }
  return m
}

/** Clave para detectar duplicados de una fila contra lo ya registrado. */
export function claveDuplicado(destinoId: string, v: Valores, ctx: { cuentaId?: string }): string {
  if (destinoId === 'articulos') return `ref:${String(v.referencia ?? '').toLowerCase().trim()}`
  if (destinoId === 'terceros') return `t:${String(v.cif || v.nombre || '').toLowerCase().trim()}`
  return `m:${ctx.cuentaId ?? ''}|${v.fecha}|${v.importe}|${String(v.referencia ?? '')}`
}

/** Conjunto de claves ya existentes para detectar duplicados. */
export function clavesExistentes(destinoId: string, datos: DatosOperativos, ctx: { cuentaId?: string }): Set<string> {
  const claves = new Set<string>()
  if (destinoId === 'articulos') {
    for (const a of datos.articulos) if (!a.anuladoEn) claves.add(`ref:${a.referencia.toLowerCase().trim()}`)
  } else if (destinoId === 'terceros') {
    for (const t of datos.terceros) if (!t.anuladoEn) claves.add(`t:${(t.cif || t.nombre).toLowerCase().trim()}`)
  } else {
    for (const m of datos.movimientos) if (!m.anuladoEn && m.cuentaId === ctx.cuentaId) claves.add(`m:${m.cuentaId}|${m.fecha}|${m.importe}|${m.referencia ?? ''}`)
  }
  return claves
}
