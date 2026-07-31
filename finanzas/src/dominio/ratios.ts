/**
 * Ratios financieros. Se separa la DEUDA COMERCIAL de la DEUDA FISCAL, porque
 * si la empresa paga a proveedores al contado el periodo medio de pago calculado
 * sobre el total de acreedores queda distorsionado por las deudas trimestrales
 * con Hacienda. Se muestran ambos.
 */
import { redondear2 } from './dinero'

/** Fondo de maniobra = activo corriente − pasivo corriente. */
export function fondoManiobra(activoCorriente: number, pasivoCorriente: number): number {
  return redondear2(activoCorriente - pasivoCorriente)
}

/** Ratio de liquidez = activo corriente / pasivo corriente. */
export function ratioLiquidez(activoCorriente: number, pasivoCorriente: number): number {
  if (pasivoCorriente === 0) return 0
  return redondear2(activoCorriente / pasivoCorriente)
}

/** Ratio de tesorería (prueba ácida) = (tesorería + realizable) / pasivo corriente. */
export function ratioTesoreria(tesoreria: number, realizable: number, pasivoCorriente: number): number {
  if (pasivoCorriente === 0) return 0
  return redondear2((tesoreria + realizable) / pasivoCorriente)
}

/** Periodo medio de cobro (días) = saldo clientes / ventas · días del periodo. */
export function periodoMedioCobro(saldoClientes: number, ventasPeriodo: number, diasPeriodo: number): number {
  if (ventasPeriodo <= 0) return 0
  return Math.round((saldoClientes / ventasPeriodo) * diasPeriodo)
}

/**
 * Periodo medio de pago (días) SOLO sobre deuda comercial (proveedores),
 * excluyendo la deuda fiscal para no distorsionar el ratio.
 */
export function periodoMedioPago(saldoProveedores: number, comprasPeriodo: number, diasPeriodo: number): number {
  if (comprasPeriodo <= 0) return 0
  return Math.round((saldoProveedores / comprasPeriodo) * diasPeriodo)
}
