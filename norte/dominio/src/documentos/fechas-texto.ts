import { aISO, type FechaISO } from '../fechas.js'

/**
 * Leer la fecha de un extracto.
 *
 * Los cuatro ficheros reales con los que se escribió esto traían tres formas
 * distintas de la misma fecha: `18/08/2026` como texto, `19 Agosto 2026` en
 * prosa y un número de serie de Excel. Y una cuarta que no se ve: el `.xls`
 * antiguo guarda las fechas como número, así que si el lector solo entendiera
 * cadenas, media hoja quedaría fuera.
 */

const MESES: Record<string, number> = {
  ene: 1, enero: 1,
  feb: 2, febrero: 2,
  mar: 3, marzo: 3,
  abr: 4, abril: 4,
  may: 5, mayo: 5,
  jun: 6, junio: 6,
  jul: 7, julio: 7,
  ago: 8, agosto: 8,
  sep: 9, sept: 9, septiembre: 9, setiembre: 9,
  oct: 10, octubre: 10,
  nov: 11, noviembre: 11,
  dic: 12, diciembre: 12,
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/** Un año de dos cifras: 26 es 2026, 98 es 1998. El corte en 70 es el mismo que
 *  usa la Norma 43 y cubre de sobra cualquier extracto que alguien conserve. */
function anioCompleto(anio: number): number {
  if (anio >= 100) return anio
  return anio < 70 ? 2000 + anio : 1900 + anio
}

function componer(dia: number, mes: number, anio: number): FechaISO | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  const fecha = new Date(anio, mes - 1, dia)
  // Rebota el 31 de febrero en vez de convertirlo en el 3 de marzo.
  if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) {
    return null
  }
  return aISO(fecha)
}

/**
 * El número de serie de Excel. El día 1 es el 1 de enero de 1900, pero Excel
 * arrastra desde Lotus 1-2-3 un 29 de febrero de 1900 que nunca existió, así
 * que la referencia práctica es el 30 de diciembre de 1899.
 */
export function fechaDeSerieExcel(serie: number): FechaISO | null {
  if (!Number.isFinite(serie)) return null
  // Fuera de 1970–2100 no es una fecha: es un importe o un número de contrato
  // que ha caído en la columna equivocada.
  if (serie < 25569 || serie > 73415) return null
  const dias = Math.floor(serie)
  const fecha = new Date(Date.UTC(1899, 11, 30 + dias))
  return aISO(new Date(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()))
}

/** Devuelve `null` cuando no lo sabe. Adivinar una fecha descoloca un mes. */
export function leerFecha(valor: unknown): FechaISO | null {
  if (valor == null) return null
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? null : aISO(valor)
  }
  if (typeof valor === 'number') return fechaDeSerieExcel(valor)
  if (typeof valor !== 'string') return null

  const texto = valor.trim()
  if (texto === '') return null

  // aaaa-mm-dd (ISO) y aaaa/mm/dd
  const iso = texto.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T ].*)?$/)
  if (iso) return componer(Number(iso[3]), Number(iso[2]), Number(iso[1]))

  // dd/mm/aaaa, dd-mm-aa, dd.mm.aaaa
  const es = texto.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:\s.*)?$/)
  if (es) return componer(Number(es[1]), Number(es[2]), anioCompleto(Number(es[3])))

  // «19 Agosto 2026», «19 de agosto de 2026», «19-ago-2026»
  const prosa = normalizar(texto).match(/^(\d{1,2})[\s-]+(?:de[\s-]+)?([a-z]+)\.?[\s-]+(?:de[\s-]+)?(\d{2,4})\b/)
  if (prosa) {
    const mes = MESES[prosa[2]!]
    if (mes) return componer(Number(prosa[1]), mes, anioCompleto(Number(prosa[3])))
  }

  // aammdd, tal cual viene en la Norma 43.
  const compacta = texto.match(/^(\d{2})(\d{2})(\d{2})$/)
  if (compacta) {
    return componer(Number(compacta[3]), Number(compacta[2]), anioCompleto(Number(compacta[1])))
  }

  return null
}

/** La primera fecha que aparezca dentro de una línea de texto. */
export function buscarFecha(linea: string): { fecha: FechaISO; texto: string } | null {
  const encontrada = linea.match(/\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/)
  if (!encontrada) return null
  const fecha = leerFecha(encontrada[0])
  return fecha ? { fecha, texto: encontrada[0] } : null
}
