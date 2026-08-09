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

/** Origen reconocido del fichero, para poder decirlo en la previsualización. */
export type OrigenVentasCsv = 'COLUMNAS' | 'SQUARE_SEMANAL' | 'SQUARE_RESUMEN'

export interface LecturaVentasCsv {
  origen: OrigenVentasCsv
  /**
   * El informe de Square no trae fechas y el nombre del fichero tampoco: hay
   * que preguntárselas a la persona. DIA para el resumen de un día, SEMANA
   * para el de día de la semana (se pide el primer día).
   */
  necesitaPeriodo?: 'DIA' | 'SEMANA'
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
 * Lee el CSV completo. `texto` es el fichero ya decodificado; `nombreFichero`
 * hace falta para los informes de Square, que no llevan las fechas dentro.
 */
export function leerVentasCsv(texto: string, nombreFichero = ''): LecturaVentasCsv {
  const descartadas: LecturaVentasCsv['descartadas'] = []
  const avisos: string[] = []
  const filas = parsearCSV(texto, detectarSeparador(texto))
  if (filas.length === 0) return { origen: 'COLUMNAS', filas: [], descartadas, columnas: [], avisos: ['El fichero está vacío.'] }

  // Square exporta el resumen TRANSPUESTO (una fila por métrica): se reconoce
  // y se lee aparte, porque no tiene nada que ver con un CSV por columnas.
  if (esResumenSemanalSquare(filas)) return leerResumenSemanalSquare(filas, nombreFichero)
  if (esResumenSquare(filas)) return leerResumenSquare(filas, nombreFichero)

  const iCab = filaCabecera(filas)
  if (iCab === -1) {
    return {
      origen: 'COLUMNAS',
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
  return { origen: 'COLUMNAS', filas: salida, descartadas, columnas: reconocidas, avisos }
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

// ───────────────── Informe «Resumen de ventas» de Square ─────────────────

/**
 * Square exporta el resumen **transpuesto**: cada fila es una métrica («Ventas
 * netas», «Impuestos», «Efectivo»…) y cada columna un **día de la semana**.
 * Y no lleva fechas dentro: el periodo va en el nombre del fichero
 * (`resumenventas2026080120260807.csv`).
 *
 * Eso obliga a dos cosas, y ninguna es negociable:
 *  · La fecha de cada columna sale de cruzar el día de la semana con el rango
 *    del nombre. **Solo vale si el rango es de 7 días justos**; si abarca más,
 *    «lunes» es la suma de varios lunes y convertirlo en un día concreto sería
 *    inventarse las cifras. En ese caso no se importa nada y se explica.
 *  · El fichero no dice de qué tienda es: se elige en la previsualización.
 */
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

export function esResumenSemanalSquare(filas: string[][]): boolean {
  const tope = Math.min(filas.length, 6)
  for (let i = 0; i < tope; i++) {
    const n = (filas[i] ?? []).map(normalizar)
    if (n.filter((c) => DIAS_SEMANA.includes(c)).length >= 5) return true
  }
  return false
}

/**
 * Periodo incrustado en el nombre del fichero. Square lo escribe de varias
 * maneras según de dónde se descargue —`resumenventas2026080120260807.csv` y
 * `resumen-ventas-2026-08-01-2026-08-01 (1).csv` son el mismo informe—, así que
 * se buscan **todas** las fechas del nombre y se toman las dos primeras.
 * Con una sola, el periodo es ese único día.
 */
export function rangoDeNombre(nombre: string): { desde: string; hasta: string } | undefined {
  const fechas: string[] = []
  for (const m of nombre.matchAll(/(\d{4})[-_.](\d{2})[-_.](\d{2})|(\d{4})(\d{2})(\d{2})/g)) {
    const iso = m[1] ? `${m[1]}-${m[2]}-${m[3]}` : `${m[4]}-${m[5]}-${m[6]}`
    // Se descarta lo que parece una fecha pero no lo es (mes 13, día 40…).
    const d = new Date(iso + 'T00:00:00Z')
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) continue
    fechas.push(iso)
    if (fechas.length === 2) break
  }
  if (fechas.length === 0) return undefined
  const [desde, hasta = desde] = fechas
  return desde <= hasta ? { desde, hasta } : { desde: hasta, hasta: desde }
}

/** Las fechas del rango, una por día. Vacío si el rango es absurdo. */
function fechasDelRango(desde: string, hasta: string): string[] {
  const fechas: string[] = []
  const fin = Date.parse(hasta)
  for (let t = Date.parse(desde); t <= fin && fechas.length <= 40; t += 86_400_000) {
    fechas.push(new Date(t).toISOString().slice(0, 10))
  }
  return fechas
}

/** Fila cuya primera celda es exactamente esa métrica. */
function metrica(filas: string[][], nombre: string): string[] | undefined {
  return filas.find((f) => normalizar(f[0] ?? '') === nombre)
}

export function leerResumenSemanalSquare(filas: string[][], nombreFichero: string): LecturaVentasCsv {
  const avisos: string[] = []
  const descartadas: LecturaVentasCsv['descartadas'] = []

  const iCab = filas.findIndex((f) => f.map(normalizar).filter((c) => DIAS_SEMANA.includes(c)).length >= 5)
  const cabecera = filas[iCab].map(normalizar)

  const rango = rangoDeNombre(nombreFichero)
  if (!rango) {
    return {
      origen: 'SQUARE_SEMANAL',
      filas: [],
      descartadas,
      columnas: [],
      necesitaPeriodo: 'SEMANA',
      avisos: [
        'Este informe no lleva las fechas dentro y el nombre del fichero tampoco las dice. Indica abajo el primer día de la ' +
          'semana que abarca y se reparten los siete días.',
      ],
    }
  }

  const fechas = fechasDelRango(rango.desde, rango.hasta)
  if (fechas.length !== 7) {
    return {
      origen: 'SQUARE_SEMANAL',
      filas: [],
      descartadas,
      columnas: [],
      avisos: [
        `Este informe agrupa por día de la semana y el periodo del fichero es de ${fechas.length} días ` +
          `(${rango.desde} a ${rango.hasta}). Con más de una semana, «lunes» es la suma de varios lunes y no se puede repartir ` +
          'por fechas sin inventar cifras. Descarga el resumen de UNA semana, o mejor el informe por días.',
      ],
    }
  }

  // Cada día de la semana aparece una sola vez en 7 días: la fecha es única.
  const fechaDe = new Map<string, string>()
  for (const f of fechas) fechaDe.set(DIAS_SEMANA[new Date(f + 'T00:00:00Z').getUTCDay()], f)

  const fNetas = metrica(filas, 'ventas netas')
  const fImpuestos = metrica(filas, 'impuestos')
  const fBrutas = metrica(filas, 'ventas brutas') ?? metrica(filas, 'total de las ventas')
  const fEfectivo = metrica(filas, 'efectivo')
  const fTarjeta = metrica(filas, 'tarjeta')
  const fOtros = metrica(filas, 'otros')
  const fTickets = metrica(filas, 'transacciones de ventas')

  if (!fNetas && !fBrutas) {
    return {
      origen: 'SQUARE_SEMANAL',
      filas: [],
      descartadas,
      columnas: [],
      avisos: ['No se encuentran las filas «Ventas netas» ni «Ventas brutas». ¿Es un resumen de ventas de Square?'],
    }
  }

  // Los importes de Square vienen en formato español y con el símbolo €.
  const muestras: string[] = []
  for (const f of [fNetas, fImpuestos, fBrutas, fEfectivo, fTarjeta, fOtros]) {
    if (f) muestras.push(...f.slice(1))
  }
  const convencion = detectarConvencionNumerica(muestras)
  const val = (f: string[] | undefined, i: number) => (f ? numero(f[i], convencion) : undefined)

  const salida: FilaVentaCsv[] = []
  cabecera.forEach((dia, i) => {
    if (!DIAS_SEMANA.includes(dia)) return
    const fecha = fechaDe.get(dia)
    if (!fecha) return

    const base = val(fNetas, i)
    const cuota = val(fImpuestos, i)
    const total = val(fBrutas, i)
    if (base === undefined && total === undefined) {
      descartadas.push({ linea: iCab + 1, texto: dia, motivo: 'Sin importe legible' })
      return
    }
    // Un día a cero es un día cerrado: no se registra una venta vacía.
    if ((total ?? base ?? 0) === 0) {
      descartadas.push({ linea: iCab + 1, texto: `${dia} (${fecha})`, motivo: 'Sin ventas ese día' })
      return
    }

    const cobros: { forma: FormaCobro; importe: number }[] = []
    const efectivo = val(fEfectivo, i) ?? 0
    if (efectivo !== 0) cobros.push({ forma: 'EFECTIVO', importe: efectivo })
    const tarjeta = (val(fTarjeta, i) ?? 0) + (val(fOtros, i) ?? 0)
    if (tarjeta !== 0) cobros.push({ forma: 'TARJETA', importe: tarjeta })

    salida.push({
      fecha,
      base,
      cuota,
      total,
      numTickets: val(fTickets, i),
      cobros,
    })
  })

  salida.sort((a, b) => a.fecha.localeCompare(b.fecha))

  avisos.push(
    `Resumen semanal de Square. Las fechas salen del periodo del nombre del fichero (${rango.desde} a ${rango.hasta}) ` +
      'cruzado con el día de la semana de cada columna.',
  )
  if (fOtros) {
    avisos.push(
      'La fila «Otros» de Square es el cobro por datáfono: entra como cobro con tarjeta y se asigna al datáfono principal de la tienda.',
    )
  }
  avisos.push('El fichero no dice de qué tienda es: elígela abajo.')

  const columnas = [
    fNetas && 'base: «Ventas netas»',
    fImpuestos && 'IVA: «Impuestos»',
    fBrutas && 'total: «Ventas brutas»',
    fEfectivo && 'efectivo: «Efectivo»',
    fTarjeta && 'tarjeta: «Tarjeta»',
    fOtros && 'tarjeta: «Otros»',
    fTickets && 'tickets: «Transacciones de ventas»',
  ].filter(Boolean) as string[]

  return { origen: 'SQUARE_SEMANAL', filas: salida, descartadas, columnas, avisos }
}

/**
 * Variante «Resumen» de Square: el mismo informe transpuesto pero con **una
 * sola columna de valores** — un periodo y una tienda. La fecha vuelve a salir
 * del nombre del fichero, y solo se importa si el periodo es **de un día**:
 * un resumen de varios días agregados no es una venta diaria y repartirlo
 * sería inventarse las cifras.
 */
export function esResumenSquare(filas: string[][]): boolean {
  const titulo = normalizar(filas[0]?.[0] ?? '')
  const tieneMetricas = metrica(filas, 'ventas netas') !== undefined || metrica(filas, 'ventas brutas') !== undefined
  return tieneMetricas && (titulo.startsWith('resumen de ventas') || tieneMetricas)
}

export function leerResumenSquare(filas: string[][], nombreFichero: string): LecturaVentasCsv {
  const descartadas: LecturaVentasCsv['descartadas'] = []
  const rango = rangoDeNombre(nombreFichero)

  if (!rango) {
    return {
      origen: 'SQUARE_RESUMEN',
      filas: [],
      descartadas,
      columnas: [],
      necesitaPeriodo: 'DIA',
      avisos: ['Este resumen no lleva la fecha dentro y el nombre del fichero tampoco la dice. Indícala abajo.'],
    }
  }
  if (rango.desde !== rango.hasta) {
    return {
      origen: 'SQUARE_RESUMEN',
      filas: [],
      descartadas,
      columnas: [],
      avisos: [
        `Este resumen agrega todo el periodo ${rango.desde} a ${rango.hasta} en una sola columna, así que no se puede repartir ` +
          'por días sin inventar cifras. Descárgalo de un solo día, o usa el resumen por día de la semana (una semana justa).',
      ],
    }
  }

  const fNetas = metrica(filas, 'ventas netas')
  const fImpuestos = metrica(filas, 'impuestos')
  const fBrutas = metrica(filas, 'ventas brutas') ?? metrica(filas, 'total de las ventas')
  const fEfectivo = metrica(filas, 'efectivo')
  const fTarjeta = metrica(filas, 'tarjeta')
  const fOtros = metrica(filas, 'otros')
  const fDesconocido = metrica(filas, 'origen del pago desconocido')
  const fTickets = metrica(filas, 'transacciones de ventas') ?? metrica(filas, 'numero total de ventas')

  // La columna de valores es la primera que trae algo detrás de la etiqueta.
  const i = 1
  const muestras: string[] = []
  for (const f of [fNetas, fImpuestos, fBrutas, fEfectivo, fTarjeta, fOtros]) if (f?.[i]) muestras.push(f[i])
  const convencion = detectarConvencionNumerica(muestras)
  const val = (f: string[] | undefined) => (f ? numero(f[i], convencion) : undefined)

  const base = val(fNetas)
  const cuota = val(fImpuestos)
  const total = val(fBrutas)
  if (base === undefined && total === undefined) {
    return {
      origen: 'SQUARE_RESUMEN',
      filas: [],
      descartadas,
      columnas: [],
      avisos: ['No se han podido leer «Ventas netas» ni «Ventas brutas» del resumen.'],
    }
  }
  if ((total ?? base ?? 0) === 0) {
    return {
      origen: 'SQUARE_RESUMEN',
      filas: [],
      descartadas: [{ linea: 1, texto: rango.desde, motivo: 'Sin ventas ese día' }],
      columnas: [],
      avisos: [`El ${rango.desde} no tiene ventas: no se registra un día vacío.`],
    }
  }

  const cobros: { forma: FormaCobro; importe: number }[] = []
  const efectivo = val(fEfectivo) ?? 0
  if (efectivo !== 0) cobros.push({ forma: 'EFECTIVO', importe: efectivo })
  // «Origen del pago desconocido» es un detalle DENTRO de «Otros»: sumarlo
  // aparte duplicaría el cobro.
  const tarjeta = (val(fTarjeta) ?? 0) + (val(fOtros) ?? 0)
  if (tarjeta !== 0) cobros.push({ forma: 'TARJETA', importe: tarjeta })

  const avisos = [`Resumen de Square de un solo día (${rango.desde}). El fichero no dice de qué tienda es: elígela abajo.`]
  if (fOtros) {
    avisos.push(
      fDesconocido
        ? 'Square lo llama «Otros / Origen del pago desconocido» porque el datáfono no es suyo. Entra como cobro con tarjeta y ' +
          'se asigna al datáfono principal de la tienda.'
        : 'La fila «Otros» de Square es el cobro por datáfono: entra como cobro con tarjeta y se asigna al datáfono principal de la tienda.',
    )
  }

  const columnas = [
    fNetas && 'base: «Ventas netas»',
    fImpuestos && 'IVA: «Impuestos»',
    fBrutas && 'total: «Ventas brutas»',
    fEfectivo && 'efectivo: «Efectivo»',
    fOtros && 'tarjeta: «Otros»',
    fTickets && 'tickets: «Transacciones de ventas»',
  ].filter(Boolean) as string[]

  return {
    origen: 'SQUARE_RESUMEN',
    filas: [{ fecha: rango.desde, base, cuota, total, numTickets: val(fTickets), cobros }],
    descartadas,
    columnas,
    avisos,
  }
}
