/**
 * Motor de importación universal (parte pura y testeable): definición de
 * destinos, sugerencia automática de mapeo de columnas y validación de filas.
 * La construcción de entidades y la lectura de ficheros viven en la capa lib.
 */
import { parsearNumeroEs } from './parseo-es'

export type TipoCampo = 'texto' | 'numero' | 'entero' | 'fecha'

export interface CampoDestino {
  key: string
  etiqueta: string
  obligatorio: boolean
  tipo: TipoCampo
  sinonimos: string[]
}

export interface DefinicionDestino {
  id: string
  nombre: string
  descripcion: string
  campos: CampoDestino[]
}

/** Destinos de importación soportados. */
export const DESTINOS: DefinicionDestino[] = [
  {
    id: 'articulos',
    nombre: 'Artículos',
    descripcion: 'Maestro de artículos: referencia, descripción, PVP, stock…',
    campos: [
      { key: 'referencia', etiqueta: 'Referencia', obligatorio: true, tipo: 'texto', sinonimos: ['ref', 'referencia', 'codigo', 'sku'] },
      { key: 'descripcion', etiqueta: 'Descripción', obligatorio: true, tipo: 'texto', sinonimos: ['descripcion', 'nombre', 'articulo', 'producto'] },
      { key: 'ean', etiqueta: 'EAN', obligatorio: false, tipo: 'texto', sinonimos: ['ean', 'codigo barras', 'barcode'] },
      { key: 'familia', etiqueta: 'Familia', obligatorio: false, tipo: 'texto', sinonimos: ['familia', 'categoria'] },
      { key: 'pvp', etiqueta: 'PVP', obligatorio: false, tipo: 'numero', sinonimos: ['pvp', 'precio', 'precio venta'] },
      { key: 'stockMinimo', etiqueta: 'Stock mínimo', obligatorio: false, tipo: 'entero', sinonimos: ['stock minimo', 'minimo', 'min'] },
    ],
  },
  {
    id: 'terceros',
    nombre: 'Proveedores / clientes',
    descripcion: 'Terceros: nombre, CIF, IBAN, condiciones de pago…',
    campos: [
      { key: 'nombre', etiqueta: 'Nombre', obligatorio: true, tipo: 'texto', sinonimos: ['nombre', 'razon social', 'proveedor', 'cliente'] },
      { key: 'cif', etiqueta: 'CIF / NIF', obligatorio: false, tipo: 'texto', sinonimos: ['cif', 'nif', 'dni'] },
      { key: 'iban', etiqueta: 'IBAN', obligatorio: false, tipo: 'texto', sinonimos: ['iban', 'cuenta'] },
      { key: 'condicionesPagoDias', etiqueta: 'Días de pago', obligatorio: false, tipo: 'entero', sinonimos: ['dias', 'pago', 'condiciones', 'vencimiento'] },
    ],
  },
  {
    id: 'movimientos-banco',
    nombre: 'Movimientos bancarios',
    descripcion: 'Extracto bancario en Excel/CSV: fecha, concepto, importe.',
    campos: [
      { key: 'fecha', etiqueta: 'Fecha', obligatorio: true, tipo: 'fecha', sinonimos: ['fecha', 'fecha operacion', 'date'] },
      { key: 'concepto', etiqueta: 'Concepto', obligatorio: true, tipo: 'texto', sinonimos: ['concepto', 'descripcion', 'detalle'] },
      { key: 'importe', etiqueta: 'Importe', obligatorio: true, tipo: 'numero', sinonimos: ['importe', 'cantidad', 'euros', 'amount'] },
      { key: 'referencia', etiqueta: 'Referencia', obligatorio: false, tipo: 'texto', sinonimos: ['referencia', 'ref', 'documento'] },
    ],
  },
]

export function destinoPorId(id: string): DefinicionDestino | undefined {
  return DESTINOS.find((d) => d.id === id)
}

function normalizar(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Sugiere un mapeo campo→índice de columna a partir de las cabeceras.
 * Devuelve -1 para los campos sin correspondencia clara.
 */
export function sugerirMapeo(cabeceras: string[], def: DefinicionDestino): Record<string, number> {
  const norm = cabeceras.map(normalizar)
  const mapeo: Record<string, number> = {}
  const usados = new Set<number>()
  for (const campo of def.campos) {
    const claves = [campo.key, ...campo.sinonimos].map(normalizar)
    let idx = -1
    // Coincidencia exacta primero.
    for (let i = 0; i < norm.length; i++) {
      if (!usados.has(i) && claves.includes(norm[i])) { idx = i; break }
    }
    // Coincidencia parcial (la cabecera contiene la clave o viceversa).
    if (idx === -1) {
      for (let i = 0; i < norm.length; i++) {
        if (usados.has(i)) continue
        if (claves.some((c) => c.length > 2 && (norm[i].includes(c) || c.includes(norm[i])))) { idx = i; break }
      }
    }
    if (idx !== -1) usados.add(idx)
    mapeo[campo.key] = idx
  }
  return mapeo
}

/** dd/mm/aaaa o aaaa-mm-dd (con - o /) → ISO; null si no es fecha. */
export function parsearFechaFlexible(entrada: string): string | null {
  const s = (entrada || '').trim()
  if (s === '') return null
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/.exec(s)
  if (m) {
    const a = m[3].length === 2 ? `20${m[3]}` : m[3]
    return `${a}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  return null
}

export type EstadoFila = 'ok' | 'aviso' | 'error'

export interface CeldaValidada {
  raw: string
  valor: string | number | null
  error?: string
}

export interface FilaValidada {
  estado: EstadoFila
  valores: Record<string, string | number | null>
  celdas: Record<string, CeldaValidada>
  mensajes: string[]
  duplicado?: boolean
}

function validarCelda(raw: string, tipo: TipoCampo, obligatorio: boolean): CeldaValidada {
  const v = (raw ?? '').trim()
  if (v === '') {
    return { raw, valor: null, error: obligatorio ? 'Obligatorio' : undefined }
  }
  if (tipo === 'texto') return { raw, valor: v }
  if (tipo === 'fecha') {
    const iso = parsearFechaFlexible(v)
    return iso ? { raw, valor: iso } : { raw, valor: null, error: 'Fecha no válida' }
  }
  const n = parsearNumeroEs(v)
  if (n === null) return { raw, valor: null, error: 'Número no válido' }
  if (tipo === 'entero') return { raw, valor: Math.round(n) }
  return { raw, valor: n }
}

/** Valida una fila cruda contra el destino y el mapeo. */
export function validarFila(
  filaCruda: string[],
  def: DefinicionDestino,
  mapeo: Record<string, number>,
): FilaValidada {
  const valores: Record<string, string | number | null> = {}
  const celdas: Record<string, CeldaValidada> = {}
  const mensajes: string[] = []
  let hayError = false

  for (const campo of def.campos) {
    const idx = mapeo[campo.key]
    const raw = idx >= 0 ? filaCruda[idx] ?? '' : ''
    const celda = validarCelda(raw, campo.tipo, campo.obligatorio)
    celdas[campo.key] = celda
    valores[campo.key] = celda.valor
    if (celda.error) {
      hayError = true
      mensajes.push(`${campo.etiqueta}: ${celda.error}`)
    }
  }

  return { estado: hayError ? 'error' : 'ok', valores, celdas, mensajes }
}
