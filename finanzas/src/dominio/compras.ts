/** Cálculos de una compra/gasto: base, cuota, retención y total a pagar. */
import { aCentimos, aEuros } from './dinero'
import { baseTotal, cuotaTotal } from './ventas'
import type { Compra } from './tipos'

export interface TotalesCompra {
  base: number
  cuota: number
  retencion: number
  total: number // lo que se paga al proveedor = base + cuota − retención
}

export function totalesCompra(compra: Pick<Compra, 'lineasIva' | 'retencion'>): TotalesCompra {
  const base = baseTotal(compra.lineasIva)
  const cuota = cuotaTotal(compra.lineasIva)
  const retencion = compra.retencion || 0
  const total = aEuros(aCentimos(base) + aCentimos(cuota) - aCentimos(retencion))
  return { base, cuota, retencion, total }
}

/** IVA soportado deducible (0 si la compra está marcada como no deducible). */
export function ivaDeducible(compra: Pick<Compra, 'lineasIva' | 'deducible'>): number {
  return compra.deducible ? cuotaTotal(compra.lineasIva) : 0
}
