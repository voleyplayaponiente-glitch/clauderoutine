/**
 * Generación de asientos de partida doble para ventas y compras. Es la
 * "partida doble interna": el usuario no la ve, pero cada operación produce
 * un asiento cuadrado que alimentará el balance y la P&G.
 *
 * Las cuentas por defecto se pueden sobreescribir desde el mapeo de Configuración.
 */
import { aCentimos, aEuros } from './dinero'
import { cuadreVenta, baseTotal, cuotaTotal } from './ventas'
import { totalesCompra } from './compras'
import type { Apunte, Asiento } from './partida-doble'
import type { Venta, Compra, FormaCobro } from './tipos'

/** Cuenta de tesorería/cliente según la forma de cobro. */
export function cuentaCobro(forma: FormaCobro): string {
  switch (forma) {
    case 'EFECTIVO':
      return '570'
    case 'APLAZADO':
      return '430'
    default:
      return '572' // tarjeta, bizum, transferencia, pasarela → banco
  }
}

/** Asiento de una venta diaria. Lanza si la venta no cuadra (cobros ≠ bruto). */
export function asientoVenta(
  venta: Venta,
  opts: { cuentaVentas?: string; cuentaIvaRepercutido?: string } = {},
): Asiento {
  const cuadre = cuadreVenta(venta)
  if (!cuadre.cuadra) {
    throw new Error(
      `La venta no cuadra: bruto ${cuadre.bruto} € ≠ cobrado ${cuadre.cobrado} € (dif. ${cuadre.diferencia} €)`,
    )
  }
  const cuentaVentas = opts.cuentaVentas ?? '700'
  const cuentaIva = opts.cuentaIvaRepercutido ?? '477'
  const apuntes: Apunte[] = []

  // Debe: cobros agrupados por cuenta.
  const porCuenta = new Map<string, number>()
  for (const c of venta.cobros) {
    if (c.importe <= 0) continue
    const cuenta = cuentaCobro(c.forma)
    porCuenta.set(cuenta, aEuros(aCentimos(porCuenta.get(cuenta) ?? 0) + aCentimos(c.importe)))
  }
  for (const [cuenta, importe] of porCuenta) {
    apuntes.push({ cuenta, debe: importe, haber: 0, concepto: 'Cobro venta', centroCosteId: venta.centroCosteId })
  }

  // Haber: base a ventas, cuota a IVA repercutido.
  const base = baseTotal(venta.lineasIva)
  const cuota = cuotaTotal(venta.lineasIva)
  if (base > 0) apuntes.push({ cuenta: cuentaVentas, debe: 0, haber: base, concepto: 'Ventas', centroCosteId: venta.centroCosteId })
  if (cuota > 0) apuntes.push({ cuenta: cuentaIva, debe: 0, haber: cuota, concepto: 'IVA repercutido' })

  return { fecha: venta.fecha, concepto: `Ventas del día ${venta.fecha}`, apuntes }
}

/** Asiento de una compra/gasto. */
export function asientoCompra(
  compra: Compra,
  opts: { cuentaProveedor?: string; cuentaIvaSoportado?: string; cuentaRetencion?: string } = {},
): Asiento {
  const { base, cuota, retencion, total } = totalesCompra(compra)
  const cuentaGasto = compra.cuentaGasto ?? (compra.naturaleza === 'MERCADERIA' ? '600' : '629')
  const cuentaProveedor = opts.cuentaProveedor ?? (compra.naturaleza === 'MERCADERIA' ? '400' : '410')
  const cuentaIva = opts.cuentaIvaSoportado ?? '472'
  const cuentaRetencion = opts.cuentaRetencion ?? '4751'
  const apuntes: Apunte[] = []

  // Debe: gasto/compra (base) + IVA soportado (cuota).
  if (base > 0) apuntes.push({ cuenta: cuentaGasto, debe: base, haber: 0, concepto: 'Compra/gasto', centroCosteId: compra.centroCosteId, terceroId: compra.terceroId })
  if (cuota > 0) apuntes.push({ cuenta: cuentaIva, debe: cuota, haber: 0, concepto: 'IVA soportado' })

  // Haber: retención (si procede) + total a pagar al proveedor.
  if (retencion > 0) apuntes.push({ cuenta: cuentaRetencion, debe: 0, haber: retencion, concepto: 'Retención' })
  if (total > 0) apuntes.push({ cuenta: cuentaProveedor, debe: 0, haber: total, concepto: 'Proveedor', terceroId: compra.terceroId })

  return { fecha: compra.fechaFactura, concepto: `Factura ${compra.numFactura}`, apuntes }
}
