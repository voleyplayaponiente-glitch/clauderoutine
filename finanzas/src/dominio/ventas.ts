/** Cálculos de una venta diaria: totales, ticket medio y cuadre de cobros. */
import { aCentimos, aEuros, redondear2 } from './dinero'
import type { Venta, LineaIva } from './tipos'

export function baseTotal(lineas: LineaIva[]): number {
  return aEuros(lineas.reduce((c, l) => c + aCentimos(l.base), 0))
}

export function cuotaTotal(lineas: LineaIva[]): number {
  return aEuros(lineas.reduce((c, l) => c + aCentimos(l.cuota), 0))
}

/** Importe bruto (con IVA) de la venta. */
export function brutoVenta(venta: Pick<Venta, 'lineasIva'>): number {
  return aEuros(aCentimos(baseTotal(venta.lineasIva)) + aCentimos(cuotaTotal(venta.lineasIva)))
}

export function totalCobros(venta: Pick<Venta, 'cobros'>): number {
  return aEuros(venta.cobros.reduce((c, x) => c + aCentimos(x.importe), 0))
}

/** Ticket medio = bruto / nº de tickets (0 si no hay tickets). */
export function ticketMedio(venta: Pick<Venta, 'lineasIva' | 'numTickets'>): number {
  if (venta.numTickets <= 0) return 0
  return redondear2(brutoVenta(venta) / venta.numTickets)
}

export interface CuadreVenta {
  cuadra: boolean
  bruto: number
  cobrado: number
  diferencia: number // bruto − cobrado
}

/**
 * El total cobrado (por todas las formas) debe igualar el bruto. Si no cuadra,
 * NO se oculta: se devuelve la diferencia para avisar al usuario.
 */
export function cuadreVenta(venta: Pick<Venta, 'lineasIva' | 'cobros'>): CuadreVenta {
  const bruto = brutoVenta(venta)
  const cobrado = totalCobros(venta)
  const diferencia = aEuros(aCentimos(bruto) - aCentimos(cobrado))
  return { cuadra: diferencia === 0, bruto, cobrado, diferencia }
}
