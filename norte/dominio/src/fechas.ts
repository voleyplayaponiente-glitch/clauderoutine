/**
 * Fechas.
 *
 * Todo se maneja como **fecha local sin hora** en formato `aaaa-mm-dd`. Un
 * gasto no tiene hora ni huso: pasó el día 5. Guardar `2026-08-05T00:00:00Z` y
 * enseñarlo en Madrid convierte el día 5 en el 4 por la noche, y eso descuadra
 * un mes entero cuando el gasto cae en día 1.
 */

export type FechaISO = string

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const

export function aISO(fecha: Date): FechaISO {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

export function deISO(iso: FechaISO): Date {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return new Date(anio!, (mes ?? 1) - 1, dia ?? 1)
}

export function sumarDias(fecha: Date, dias: number): Date {
  const otra = new Date(fecha)
  otra.setDate(otra.getDate() + dias)
  return otra
}

export function sumarMeses(fecha: Date, meses: number): Date {
  const otra = new Date(fecha.getFullYear(), fecha.getMonth() + meses, 1)
  // El 31 de enero + 1 mes no es el 31 de febrero: se queda en el último día
  // del mes destino. Sin esto, una cuota mensual del 31 se salta febrero.
  const ultimo = diasDelMes(otra.getFullYear(), otra.getMonth())
  otra.setDate(Math.min(fecha.getDate(), ultimo))
  return otra
}

export function diasDelMes(anio: number, mes: number): number {
  return new Date(anio, mes + 1, 0).getDate()
}

export function inicioDeMes(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1)
}

export function finDeMes(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0)
}

/** ¿Es sábado o domingo? Los festivos locales no se contemplan a propósito:
 *  varían por comunidad y municipio, y fallar por Navidad es menos grave que
 *  fingir que se saben los de Alicante. */
export function esFinDeSemana(fecha: Date): boolean {
  const dia = fecha.getDay()
  return dia === 0 || dia === 6
}

/**
 * El último día hábil del mes. Muchas nóminas y recibos caen ahí, y no es un
 * número fijo: en un mes que acaba en sábado, es el viernes 30.
 */
export function ultimoDiaHabilDelMes(anio: number, mes: number): Date {
  const fecha = new Date(anio, mes + 1, 0)
  while (esFinDeSemana(fecha)) fecha.setDate(fecha.getDate() - 1)
  return fecha
}

export function nombreDelDia(fecha: Date): string {
  return DIAS[fecha.getDay()]!
}

/** Índice del día de la semana por su nombre en español, con o sin tilde. */
export function indiceDelDia(nombre: string): number | null {
  const limpio = nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
  const indice = DIAS.findIndex(
    (d) => d.normalize('NFD').replace(/[̀-ͯ]/g, '') === limpio,
  )
  return indice === -1 ? null : indice
}
