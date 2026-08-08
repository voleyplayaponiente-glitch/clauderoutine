/**
 * Lectura de extractos bancarios que NO vienen en Norma 43: hojas de Excel/CSV
 * descargadas de la banca electrónica y PDF con capa de texto.
 *
 * Regla del proyecto: **nunca inventar un dato que no se puede leer**. Cuando
 * una fila no se entiende, se marca con su motivo y el usuario decide; jamás se
 * rellena por aproximación. Todo lo leído se previsualiza antes de aplicarse.
 */
import { parsearImporte, detectarConvencionNumerica, type ConvencionNumerica } from './parseo-es'
import { parsearFechaFlexible } from './importacion'

export interface MovimientoExtracto {
  fecha: string // ISO
  concepto: string
  importe: number // + entrada / − salida
  /** Texto original de la fila, para que el usuario pueda comprobar de dónde sale. */
  origen: string
}

export interface ResultadoExtracto {
  movimientos: MovimientoExtracto[]
  /** Filas que no se han podido interpretar, con el motivo. */
  descartadas: { origen: string; motivo: string }[]
}

// ───────────────────────────── Hojas (Excel / CSV) ─────────────────────────────

export interface MapeoColumnas {
  fecha: number
  concepto: number
  /** Columna de importe con signo. −1 si el extracto usa debe/haber separados. */
  importe: number
  debe: number
  haber: number
  /** Columna con el detalle añadido («Más datos», beneficiario…). −1 si no hay. */
  extra: number
  /** Fila donde empiezan los datos (la siguiente a la de cabeceras). */
  primeraFila: number
}

function normalizar(s: string): string {
  return (s ?? '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

const SINONIMOS = {
  fecha: ['fecha', 'fecha operacion', 'f. operacion', 'fecha contable', 'fecha de operacion', 'date', 'f operacion'],
  valor: ['fecha valor', 'f. valor', 'valor', 'f valor'],
  concepto: ['concepto', 'descripcion', 'detalle', 'movimiento', 'observaciones', 'concepto ampliado', 'description'],
  importe: ['importe', 'importe eur', 'importe (eur)', 'cantidad', 'amount', 'importe movimiento'],
  debe: ['debe', 'cargo', 'cargos', 'salida', 'pagos', 'debito'],
  haber: ['haber', 'abono', 'abonos', 'entrada', 'ingresos', 'credito'],
  extra: ['mas datos', 'datos adicionales', 'beneficiario', 'ordenante', 'concepto ampliado', 'ampliacion'],
}

function buscarColumna(cabecera: string[], claves: string[]): number {
  const norm = cabecera.map(normalizar)
  // Primero coincidencia exacta, luego por inclusión (evita que "fecha valor"
  // gane a "fecha" cuando existen las dos).
  for (const c of claves) {
    const i = norm.indexOf(c)
    if (i !== -1) return i
  }
  for (const c of claves) {
    const i = norm.findIndex((h) => h !== '' && h.includes(c))
    if (i !== -1) return i
  }
  return -1
}

/**
 * Localiza la fila de cabeceras y las columnas. Los extractos de banca suelen
 * traer varias filas de rótulos antes de la tabla, así que se busca la primera
 * fila que contenga a la vez algo parecido a «fecha» y a un importe.
 */
export function detectarColumnas(filas: string[][]): MapeoColumnas | undefined {
  const tope = Math.min(filas.length, 25)
  for (let i = 0; i < tope; i++) {
    const fila = filas[i] ?? []
    const fecha = buscarColumna(fila, SINONIMOS.fecha)
    const concepto = buscarColumna(fila, SINONIMOS.concepto)
    const importe = buscarColumna(fila, SINONIMOS.importe)
    const debe = buscarColumna(fila, SINONIMOS.debe)
    const haber = buscarColumna(fila, SINONIMOS.haber)
    const extra = buscarColumna(fila, SINONIMOS.extra)
    const hayImporte = importe !== -1 || (debe !== -1 && haber !== -1)
    if (fecha !== -1 && hayImporte) {
      return { fecha, concepto, importe, debe, haber, extra, primeraFila: i + 1 }
    }
  }
  return undefined
}

/** Convierte las filas de una hoja en movimientos, usando el mapeo detectado. */
export function filasAMovimientos(filas: string[][], mapeo: MapeoColumnas): ResultadoExtracto {
  const movimientos: MovimientoExtracto[] = []
  const descartadas: { origen: string; motivo: string }[] = []

  // Los bancos exportan unas veces en español (3.000,00) y otras en anglosajón
  // (3,000.00). Se deduce del propio fichero antes de convertir nada: dar por
  // supuesta una convención convierte tres mil euros en tres.
  const columnasImporte = [mapeo.importe, mapeo.debe, mapeo.haber].filter((c) => c !== -1)
  const muestras: string[] = []
  for (let i = mapeo.primeraFila; i < filas.length; i++) {
    for (const c of columnasImporte) muestras.push((filas[i]?.[c] ?? '').toString())
  }
  const convencion: ConvencionNumerica = detectarConvencionNumerica(muestras)

  for (let i = mapeo.primeraFila; i < filas.length; i++) {
    const fila = filas[i] ?? []
    const origen = fila.join(' | ').trim()
    if (origen === '' || fila.every((c) => (c ?? '').toString().trim() === '')) continue

    const crudaFecha = (fila[mapeo.fecha] ?? '').toString().trim()
    const fecha = parsearFechaFlexible(crudaFecha)
    if (!fecha) {
      // Las filas de totales o de pie no son un error: se ignoran en silencio
      // solo si tampoco tienen importe; si lo tienen, se avisa.
      const tieneAlgo = fila.some((c) => (c ?? '').toString().trim() !== '')
      if (tieneAlgo) descartadas.push({ origen, motivo: `Fecha no reconocida: "${crudaFecha}"` })
      continue
    }

    let importe: number | null = null
    if (mapeo.importe !== -1) {
      importe = parsearImporte((fila[mapeo.importe] ?? '').toString(), convencion)
    } else {
      const debe = parsearImporte((fila[mapeo.debe] ?? '').toString(), convencion) ?? 0
      const haber = parsearImporte((fila[mapeo.haber] ?? '').toString(), convencion) ?? 0
      // El debe sale de la cuenta: negativo. Se toma el valor absoluto por si el
      // banco ya lo trae con signo.
      if (debe === 0 && haber === 0) importe = null
      else importe = Math.abs(haber) - Math.abs(debe)
    }

    if (importe === null || !Number.isFinite(importe)) {
      descartadas.push({ origen, motivo: 'Importe no reconocido' })
      continue
    }

    const base = mapeo.concepto !== -1 ? (fila[mapeo.concepto] ?? '').toString().trim() : ''
    const detalle = mapeo.extra !== -1 ? (fila[mapeo.extra] ?? '').toString().trim() : ''
    // «Más datos» suele llevar el beneficiario o el ordenante: sin él, muchos
    // apuntes quedan como un código sin significado.
    const concepto = [base, detalle].filter((x) => x !== '').join(' · ')
    movimientos.push({
      fecha,
      concepto: concepto || 'Movimiento bancario',
      importe: Math.round(importe * 100) / 100,
      origen,
    })
  }

  return { movimientos, descartadas }
}

/** Atajo: hoja completa → movimientos. Devuelve undefined si no reconoce la tabla. */
export function leerHoja(filas: string[][]): { mapeo: MapeoColumnas; resultado: ResultadoExtracto } | undefined {
  const mapeo = detectarColumnas(filas)
  if (!mapeo) return undefined
  return { mapeo, resultado: filasAMovimientos(filas, mapeo) }
}

// ─────────────────────────────── PDF (líneas de texto) ───────────────────────────────

/**
 * Fecha al principio de la línea. Además de los formatos numéricos admite el
 * mes en letra («1 Jul 2026»), que es como lo imprime la banca digital.
 */
const RE_FECHA_INICIO =
  /^\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}\s+[A-Za-zÁÉÍÓÚáéíóú]{3,10}\.?\s+\d{2,4})\s+/

/**
 * Importe dentro de la línea. Acepta las dos convenciones (1.234,56 y 1,234.56)
 * y el signo separado del número, como en «- 30,00 €» o «+ 3.908,50 €».
 */
const RE_IMPORTES = /([+-]\s*)?(\d{1,3}(?:[.,]\d{3})*[.,]\d{2}|\d+[.,]\d{2})(?:\s*€)?/g

/**
 * Interpreta las líneas de texto de un PDF de extracto. Se queda con las líneas
 * que empiezan por fecha y acaban en importe; el resto se ignora (cabeceras,
 * pies, publicidad). No se adivina nada: si una línea no encaja, no entra.
 *
 * Cuando la línea trae dos importes (movimiento y saldo), el saldo es el último
 * y el movimiento el penúltimo, que es como lo imprimen los bancos.
 */
export function lineasAMovimientos(lineas: string[]): ResultadoExtracto {
  const movimientos: MovimientoExtracto[] = []
  const descartadas: { origen: string; motivo: string }[] = []

  // Igual que en las hojas: la convención se deduce del documento entero.
  const muestras: string[] = []
  for (const l of lineas) for (const m of l.matchAll(RE_IMPORTES)) muestras.push(m[2])
  const convencion: ConvencionNumerica = detectarConvencionNumerica(muestras)

  for (const bruta of lineas) {
    const linea = bruta.replace(/\s+/g, ' ').trim()
    if (linea === '') continue

    const mFecha = RE_FECHA_INICIO.exec(linea)
    if (!mFecha) continue // no parece una línea de movimiento

    const fecha = parsearFechaFlexible(mFecha[1])
    if (!fecha) {
      descartadas.push({ origen: linea, motivo: `Fecha no reconocida: "${mFecha[1]}"` })
      continue
    }

    const importes = [...linea.matchAll(RE_IMPORTES)].map((m) => ({
      texto: m[0],
      valor: `${(m[1] ?? '').replace(/\s/g, '')}${m[2]}`,
      indice: m.index ?? 0,
    }))
    if (importes.length === 0) {
      descartadas.push({ origen: linea, motivo: 'La línea empieza por fecha pero no tiene ningún importe' })
      continue
    }

    // Con dos o más importes el último suele ser el saldo acumulado.
    const elegido = importes.length >= 2 ? importes[importes.length - 2] : importes[0]
    const importe = parsearImporte(elegido.valor, convencion)
    if (importe === null) {
      descartadas.push({ origen: linea, motivo: `Importe no reconocido: "${elegido.texto}"` })
      continue
    }

    // El concepto es lo que queda entre la fecha y el primer importe.
    const desde = mFecha[0].length
    const posImporte = importes[0].indice
    let concepto = (posImporte > desde ? linea.slice(desde, posImporte) : linea.slice(desde)).trim()
    // Muchos extractos repiten la fecha valor justo después de la de operación.
    concepto = concepto.replace(RE_FECHA_INICIO, '').trim()

    movimientos.push({
      fecha,
      concepto: concepto || 'Movimiento bancario',
      importe: Math.round(importe * 100) / 100,
      origen: linea,
    })
  }

  return { movimientos, descartadas }
}

/** Suma de los movimientos leídos, para contrastarla con el extracto en pantalla. */
export function totalExtracto(movimientos: MovimientoExtracto[]): number {
  return Math.round(movimientos.reduce((s, m) => s + m.importe * 100, 0)) / 100
}
