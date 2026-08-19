import { parsearImporte, type Centimos } from '../dinero.js'
import type { FechaISO } from '../fechas.js'
import { huellaTexto } from './apuntes.js'
import { leerFecha } from './fechas-texto.js'

/**
 * Leer una nómina española.
 *
 * Aquí no hay estándar que valga: cada gestoría maqueta el recibo a su manera y
 * el orden de las columnas cambia. Lo único que se repite en todas es la
 * **aritmética**: devengos − deducciones = líquido. Este lector se apoya en eso
 * en vez de en la posición de los números, y cuando la cuenta no cuadra
 * devuelve `null` y lo dice, en lugar de rellenar el hueco con el número que
 * más se le parezca.
 */

export interface LecturaNomina {
  empresa: string | null
  cif: string | null
  periodo: { desde: FechaISO; hasta: FechaISO } | null
  /** Total devengado. */
  bruto: Centimos | null
  /** Retención a cuenta del IRPF. */
  irpf: Centimos | null
  /** Cotizaciones a la Seguridad Social a cargo del trabajador. */
  cotizaciones: Centimos | null
  /** Lo que queda tras devengos − deducciones. Es lo que entra en la cuenta. */
  neto: Centimos | null
  avisos: string[]
}

const CLAVES_NOMINA = [
  'recibo individual justificativo',
  'total devengado',
  'total devengos',
  'liquido a percibir',
  'cotizacion',
  'base de cotizacion',
  'aportacion del trabajador',
  'retencion a cuenta del irpf',
]

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/** ¿Este texto es una nómina? Se pide más de una señal: «IRPF» a secas también
 *  sale en un extracto bancario. */
export function pareceNomina(texto: string): number {
  const limpio = normalizar(texto)
  const aciertos = CLAVES_NOMINA.filter((clave) => limpio.includes(clave)).length
  return aciertos
}

/** Todos los importes de una línea, en el orden en que aparecen. */
function numerosDe(linea: string): Centimos[] {
  const encontrados = linea.match(/-?\d{1,3}(?:\.\d{3})*,\d{2}\b|-?\d+,\d{2}\b/g) ?? []
  const valores: Centimos[] = []
  for (const bruto of encontrados) {
    const valor = parsearImporte(bruto)
    if (valor !== null) valores.push(valor)
  }
  return valores
}

/** El último importe de la línea, que en un recibo es siempre la columna de la
 *  derecha: el resto son el porcentaje y la base sobre la que se aplica. */
function ultimoNumero(linea: string): Centimos | null {
  const valores = numerosDe(linea)
  return valores.length > 0 ? valores[valores.length - 1]! : null
}

export function leerNomina(texto: string): LecturaNomina {
  const lineas = texto
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l !== '')
  const avisos: string[] = []

  // ── Periodo ───────────────────────────────────────────────────────────────
  let periodo: LecturaNomina['periodo'] = null
  for (const linea of lineas) {
    const rango = linea.match(
      /(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\s*(?:-|–|a|al)\s*(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/,
    )
    if (!rango) continue
    const desde = leerFecha(rango[1]!)
    const hasta = leerFecha(rango[2]!)
    if (desde && hasta && desde <= hasta) {
      periodo = { desde, hasta }
      break
    }
  }
  if (!periodo) avisos.push('No he encontrado el periodo de liquidación; tendrás que ponerlo tú.')

  // ── Empresa ───────────────────────────────────────────────────────────────
  let empresa: string | null = null
  for (const linea of lineas.slice(0, 25)) {
    if (/(S\.?\s?L\.?\s?U?\.?|S\.?\s?A\.?\s?U?\.?|S\.?\s?COOP\.?|S\.?L\.?N\.?E\.?)$/i.test(linea) && linea.length <= 90) {
      empresa = linea
      break
    }
  }
  const cif = texto.match(/\b[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]\b/)?.[0] ?? null

  // ── Líquido ───────────────────────────────────────────────────────────────
  let neto: Centimos | null = null
  for (const linea of lineas) {
    if (/l[ií]quido|neto\s+a\s+percibir|total\s+a\s+percibir/i.test(normalizar(linea))) {
      neto = ultimoNumero(linea)
      if (neto !== null) break
    }
  }
  if (neto === null) {
    // El recibo real que sirvió de patrón no escribe «líquido» en ningún sitio:
    // marca la cifra con el símbolo del euro, y es la única de la página que lo
    // lleva. Sirve como segunda vía, no como primera.
    const conEuro = lineas.flatMap((l) => l.match(/-?[\d.,]+\s*€/g) ?? [])
    if (conEuro.length === 1) neto = parsearImporte(conEuro[0]!.replace('€', ''))
  }

  // ── Devengos y deducciones ────────────────────────────────────────────────
  // Se busca la pareja de números contiguos cuya resta da exactamente el
  // líquido. Es una comprobación, no una adivinanza: si no hay ninguna, es que
  // no se ha entendido el recibo y se dice.
  let bruto: Centimos | null = null
  if (neto !== null) {
    let mejor: { bruto: Centimos } | null = null
    for (const linea of lineas) {
      const valores = numerosDe(linea)
      for (let i = 0; i + 1 < valores.length; i++) {
        if (valores[i]! - valores[i + 1]! === neto && valores[i]! > 0) {
          if (!mejor || valores[i]! > mejor.bruto) mejor = { bruto: valores[i]! }
        }
      }
    }
    bruto = mejor?.bruto ?? null
  }
  if (bruto === null) {
    avisos.push('No he sabido cuadrar el total devengado con el líquido; revísalo antes de guardar.')
  }

  // ── IRPF y Seguridad Social ───────────────────────────────────────────────
  let irpf: Centimos | null = null
  let cotizaciones: Centimos | null = null
  for (const linea of lineas) {
    const limpia = normalizar(linea)
    // «Coste SS Empresa» y los acumulados del año no son deducciones de este
    // mes: sumarlos doblaría la retención.
    if (/empresa|acum\.|acumulad/.test(limpia)) continue
    if (/retencion a cuenta del irpf|irpf\b/.test(limpia) && !/base|especie/.test(limpia)) {
      const valor = ultimoNumero(linea)
      if (valor !== null) irpf = (irpf ?? 0) + valor
    } else if (/cotizacion|cotiz\./.test(limpia)) {
      const valor = ultimoNumero(linea)
      if (valor !== null) cotizaciones = (cotizaciones ?? 0) + valor
    }
  }

  return { empresa, cif, periodo, bruto, irpf, cotizaciones, neto, avisos }
}

/**
 * El movimiento que propone una nómina: un ingreso por el líquido, el último
 * día del periodo.
 *
 * Si no se ha podido leer el líquido no se propone nada. Es deliberado: una
 * nómina a medias en la cuenta corriente es peor que ninguna, porque el saldo
 * queda mal y nadie sabe por qué.
 */
export function apunteDeNomina(lectura: LecturaNomina): {
  fecha: FechaISO
  concepto: string
  importe: Centimos
  huella: string
} | null {
  if (lectura.neto === null || lectura.neto <= 0 || !lectura.periodo) return null
  const empresa = lectura.empresa ? ` · ${lectura.empresa}` : ''
  return {
    fecha: lectura.periodo.hasta,
    concepto: `Nómina ${lectura.periodo.desde.slice(0, 7)}${empresa}`,
    importe: lectura.neto,
    // La huella lleva el mes y la empresa, no el importe: si el mes que viene
    // se sube la misma nómina corregida, tiene que reconocerse como la misma y
    // no colarse como un segundo sueldo.
    huella: `nomina:${lectura.periodo.desde.slice(0, 7)}:${huellaTexto(lectura.cif ?? lectura.empresa ?? 'sin-empresa')}`,
  }
}
