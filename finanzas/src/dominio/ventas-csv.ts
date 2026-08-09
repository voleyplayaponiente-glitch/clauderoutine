/**
 * Lectura de un CSV de ventas diarias.
 *
 * No hay un formato único: cada TPV exporta a su manera. Así que las columnas
 * se localizan **por el nombre de la cabecera**, no por su posición, y lo que
 * no se entiende se descarta diciendo por qué. Nada se inventa: si una fila no
 * tiene fecha o no tiene importe, no entra.
 *
 * El importe se puede dar de dos maneras y las dos valen:
 *  · **Base + IVA** (o base y tipo), que es lo que necesita la contabilidad.
 *  · **Total con IVA**, del que se desglosa la base al tipo indicado.
 * Si el CSV trae el desglose de cobros (efectivo, tarjeta, bizum…), se usa. Si
 * no, el cobro se deja en blanco: **no se supone que se cobró todo en efectivo**.
 */
import { parsearCSV, detectarSeparador } from './csv'
import { parsearImporte, detectarConvencionNumerica, type ConvencionNumerica } from './parseo-es'
import { parsearFechaFlexible } from './importacion'
import { aCentimos, aEuros } from './dinero'
import type { FormaCobro } from './tipos'

export interface FilaVentaCsv {
  fecha: string
  /** Texto del punto de venta tal cual venía, para poder emparejarlo. */
  puntoTexto?: string
  base?: number
  cuota?: number
  total?: number
  tipoIva?: number
  numTickets?: number
  unidades?: number
  cobros: { forma: FormaCobro; importe: number }[]
}

export interface LecturaVentasCsv {
  filas: FilaVentaCsv[]
  descartadas: { linea: number; texto: string; motivo: string }[]
  /** Cabeceras que se han reconocido, para enseñarlas antes de importar. */
  columnas: string[]
  avisos: string[]
}

/** Cabeceras admitidas para cada dato. Se comparan sin tildes ni mayúsculas. */
const SINONIMOS: Record<string, string[]> = {
  fecha: ['fecha', 'dia', 'día', 'date', 'fecha venta', 'fecha de venta'],
  punto: ['punto de venta', 'punto', 'tienda', 'local', 'centro', 'establecimiento', 'sede', 'shop', 'store'],
  base: ['base', 'base imponible', 'neto', 'importe neto', 'subtotal', 'sin iva'],
  cuota: ['iva', 'cuota', 'cuota iva', 'importe iva'],
  total: ['total', 'importe', 'importe total', 'total venta', 'ventas', 'bruto', 'total con iva'],
  tipoIva: ['tipo iva', '% iva', 'porcentaje iva', 'tipo'],
  tickets: ['tickets', 'numero de tickets', 'nº tickets', 'n tickets', 'ventas nº', 'operaciones', 'ticket'],
  unidades: ['unidades', 'uds', 'articulos', 'artículos', 'cantidad'],
  efectivo: ['efectivo', 'caja', 'cash', 'metalico', 'metálico'],
  tarjeta: ['tarjeta', 'datafono', 'datáfono', 'tpv', 'card'],
  bizum: ['bizum'],
  transferencia: ['transferencia', 'transf'],
  pasarela: ['pasarela', 'online', 'web', 'stripe', 'paypal', 'redsys'],
}

const COBROS: { clave: string; forma: FormaCobro }[] = [
  { clave: 'efectivo', forma: 'EFECTIVO' },
  { clave: 'tarjeta', forma: 'TARJETA' },
  { clave: 'bizum', forma: 'BIZUM' },
  { clave: 'transferencia', forma: 'TRANSFERENCIA' },
  { clave: 'pasarela', forma: 'PASARELA' },
]

function normalizar(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[.:_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Índice de la primera columna cuya cabecera coincide con alguno de los sinónimos. */
function buscar(cabecera: string[], claves: string[]): number {
  const n = cabecera.map(normalizar)
  // Coincidencia exacta primero: «total» no debe llevarse «total tarjeta».
  for (const c of claves) {
    const i = n.indexOf(c)
    if (i !== -1) return i
  }
  for (let i = 0; i < n.length; i++) {
    if (n[i] !== '' && claves.some((c) => n[i].includes(c))) return i
  }
  return -1
}

/** La fila de cabeceras es la primera que tiene fecha y algún importe. */
function filaCabecera(filas: string[][]): number {
  const tope = Math.min(filas.length, 25)
  for (let i = 0; i < tope; i++) {
    const f = filas[i] ?? []
    if (buscar(f, SINONIMOS.fecha) === -1) continue
    if (buscar(f, SINONIMOS.total) === -1 && buscar(f, SINONIMOS.base) === -1) continue
    return i
  }
  return -1
}

function numero(v: string | undefined, convencion: ConvencionNumerica): number | undefined {
  if (v === undefined || v.trim() === '') return undefined
  const n = parsearImporte(v, convencion)
  return n === null ? undefined : n
}

/**
 * Lee el CSV completo. `texto` es el fichero ya decodificado.
 */
export function leerVentasCsv(texto: string): LecturaVentasCsv {
  const descartadas: LecturaVentasCsv['descartadas'] = []
  const avisos: string[] = []
  const filas = parsearCSV(texto, detectarSeparador(texto))
  if (filas.length === 0) return { filas: [], descartadas, columnas: [], avisos: ['El fichero está vacío.'] }

  const iCab = filaCabecera(filas)
  if (iCab === -1) {
    return {
      filas: [],
      descartadas,
      columnas: [],
      avisos: [
        'No se ha encontrado la fila de cabeceras. Hace falta al menos una columna de fecha y otra de importe (total o base). Revisa el fichero.',
      ],
    }
  }

  const cabecera = filas[iCab]
  const col = {
    fecha: buscar(cabecera, SINONIMOS.fecha),
    punto: buscar(cabecera, SINONIMOS.punto),
    base: buscar(cabecera, SINONIMOS.base),
    cuota: buscar(cabecera, SINONIMOS.cuota),
    total: buscar(cabecera, SINONIMOS.total),
    tipoIva: buscar(cabecera, SINONIMOS.tipoIva),
    tickets: buscar(cabecera, SINONIMOS.tickets),
    unidades: buscar(cabecera, SINONIMOS.unidades),
  }
  const colCobros = COBROS.map((c) => ({ ...c, i: buscar(cabecera, SINONIMOS[c.clave]) })).filter((c) => c.i !== -1)

  // La convención numérica se deduce del propio fichero, nunca se supone.
  const cuerpo = filas.slice(iCab + 1)
  const muestras: string[] = []
  for (const f of cuerpo) {
    for (const i of [col.base, col.cuota, col.total, ...colCobros.map((c) => c.i)]) {
      if (i !== -1 && f[i]) muestras.push(f[i])
    }
  }
  const convencion = detectarConvencionNumerica(muestras)

  const reconocidas = Object.entries(col)
    .filter(([, i]) => i !== -1)
    .map(([k, i]) => `${k}: «${cabecera[i]}»`)
    .concat(colCobros.map((c) => `${c.clave}: «${cabecera[c.i]}»`))

  const salida: FilaVentaCsv[] = []
  cuerpo.forEach((f, k) => {
    const linea = iCab + k + 2 // 1-indexado y contando la cabecera
    const crudo = f.join(';')
    if (f.every((c) => (c ?? '').trim() === '')) return

    const fecha = parsearFechaFlexible((f[col.fecha] ?? '').trim())
    if (!fecha) {
      descartadas.push({ linea, texto: crudo, motivo: 'Sin fecha válida' })
      return
    }

    const base = numero(f[col.base], convencion)
    const cuota = numero(f[col.cuota], convencion)
    const total = numero(f[col.total], convencion)
    const tipoIva = col.tipoIva !== -1 ? numero(f[col.tipoIva], convencion) : undefined

    if (base === undefined && total === undefined) {
      descartadas.push({ linea, texto: crudo, motivo: 'Sin importe legible' })
      return
    }

    const cobros = colCobros
      .map((c) => ({ forma: c.forma, importe: numero(f[c.i], convencion) ?? 0 }))
      .filter((c) => c.importe !== 0)

    salida.push({
      fecha,
      puntoTexto: col.punto !== -1 ? (f[col.punto] ?? '').trim() || undefined : undefined,
      base,
      cuota,
      total,
      tipoIva,
      numTickets: col.tickets !== -1 ? numero(f[col.tickets], convencion) : undefined,
      unidades: col.unidades !== -1 ? numero(f[col.unidades], convencion) : undefined,
      cobros,
    })
  })

  if (salida.length === 0 && descartadas.length > 0) {
    avisos.push('Se ha leído la cabecera pero ninguna fila es aprovechable. Mira los motivos del descarte.')
  }
  if (colCobros.length === 0) {
    avisos.push('El fichero no trae desglose de cobros (efectivo, tarjeta…). Habrá que repartirlos a mano en cada día.')
  }
  return { filas: salida, descartadas, columnas: reconocidas, avisos }
}

/**
 * Base y cuota de una fila, con el tipo de IVA que toque. Si solo viene el
 * total, se desglosa hacia atrás — y se avisa de que es un desglose, no un dato
 * leído.
 */
export function baseYCuota(f: FilaVentaCsv, tipoPorDefecto: number): { base: number; cuota: number; desglosado: boolean } {
  const tipo = f.tipoIva ?? tipoPorDefecto
  if (f.base !== undefined) {
    const cuota = f.cuota ?? aEuros(Math.round(aCentimos(f.base) * (tipo / 100)))
    return { base: f.base, cuota, desglosado: f.cuota === undefined }
  }
  const total = f.total ?? 0
  const base = aEuros(Math.round((aCentimos(total) * 100) / (100 + tipo)))
  return { base, cuota: aEuros(aCentimos(total) - aCentimos(base)), desglosado: true }
}

/**
 * Empareja el texto del punto de venta del CSV con los centros de coste dados
 * de alta. Compara sin tildes ni mayúsculas, por código o por nombre, y admite
 * que uno contenga al otro («GV ALICANTE» ↔ «VAPESSENCE GV ALICANTE»).
 * Si no hay una coincidencia clara devuelve undefined: **no se adivina**.
 */
export function emparejarPunto(
  texto: string | undefined,
  centros: { id: string; codigo: string; nombre: string }[],
): string | undefined {
  if (!texto) return undefined
  const t = normalizar(texto)
  if (t === '') return undefined
  const exacto = centros.find((c) => normalizar(c.codigo) === t || normalizar(c.nombre) === t)
  if (exacto) return exacto.id
  const contiene = centros.filter((c) => {
    const n = normalizar(c.nombre)
    return n.includes(t) || t.includes(n)
  })
  return contiene.length === 1 ? contiene[0].id : undefined
}
