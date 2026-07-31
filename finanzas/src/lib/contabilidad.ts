/**
 * Genera la lista completa de asientos a partir de los datos operativos:
 * ventas, compras y regularizaciones de inventario. Alimenta los libros
 * contables (sumas y saldos, balance, P&G).
 */
import { asientoVenta, asientoCompra } from '../dominio/asientos'
import { asientoRegularizacion } from '../dominio/inventario'
import { cuadreVenta } from '../dominio/ventas'
import type { Asiento } from '../dominio/partida-doble'
import type { DatosOperativos } from '../dominio/tipos'

/** Todos los asientos del ejercicio (o de todos si `anio` no se indica). */
export function generarAsientos(datos: DatosOperativos, anio?: number): Asiento[] {
  const asientos: Asiento[] = []
  const enAnio = (fecha: string) => anio === undefined || Number(fecha.slice(0, 4)) === anio

  for (const v of datos.ventas) {
    if (v.anuladoEn || !enAnio(v.fecha)) continue
    if (!cuadreVenta(v).cuadra) continue // solo ventas cuadradas
    try {
      asientos.push(asientoVenta(v))
    } catch {
      /* venta descuadrada: se omite del asiento */
    }
  }
  for (const c of datos.compras) {
    if (c.anuladoEn || !enAnio(c.fechaFactura)) continue
    asientos.push(asientoCompra(c))
  }
  for (const m of datos.movimientosStock) {
    if (m.anuladoEn || m.tipo !== 'REGULARIZACION' || !enAnio(m.fecha)) continue
    const reg = { teorica: 0, contada: 0, diferencia: m.cantidad, costeMedio: m.costeUnitario, valorDiferencia: m.cantidad * m.costeUnitario }
    const a = asientoRegularizacion(reg, m.fecha, m.articuloId)
    if (a) asientos.push(a)
  }
  return asientos
}
