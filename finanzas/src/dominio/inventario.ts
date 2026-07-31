/**
 * Inventario físico: comparación del recuento con el stock teórico y generación
 * del asiento de regularización de existencias (300 ↔ 610), valorado a coste medio.
 */
import { aCentimos, aEuros } from './dinero'
import { existenciaEn } from './valoracion'
import type { Apunte, Asiento } from './partida-doble'
import type { MovimientoStock } from './tipos'

export interface Regularizacion {
  teorica: number
  contada: number
  diferencia: number // contada − teórica (unidades)
  costeMedio: number
  valorDiferencia: number // con signo
}

export function calcularRegularizacion(
  articuloId: string,
  almacenId: string,
  cantidadContada: number,
  movs: MovimientoStock[],
): Regularizacion {
  const e = existenciaEn(articuloId, almacenId, movs)
  const diferencia = cantidadContada - e.cantidad
  const valorDiferencia = aEuros(Math.round(diferencia * aCentimos(e.costeMedio)))
  return { teorica: e.cantidad, contada: cantidadContada, diferencia, costeMedio: e.costeMedio, valorDiferencia }
}

/**
 * Asiento de regularización de existencias.
 *  · Aumento (sobra stock): 300 (debe) a 610 (haber).
 *  · Disminución (falta):    610 (debe) a 300 (haber).
 */
export function asientoRegularizacion(reg: Regularizacion, fecha: string, refArticulo: string): Asiento | null {
  const importe = aEuros(Math.abs(aCentimos(reg.valorDiferencia)))
  if (importe === 0) return null
  const apuntes: Apunte[] =
    reg.diferencia > 0
      ? [
          { cuenta: '300', debe: importe, haber: 0, concepto: 'Existencias (regularización)' },
          { cuenta: '610', debe: 0, haber: importe, concepto: 'Variación de existencias' },
        ]
      : [
          { cuenta: '610', debe: importe, haber: 0, concepto: 'Variación de existencias' },
          { cuenta: '300', debe: 0, haber: importe, concepto: 'Existencias (regularización)' },
        ]
  return { fecha, concepto: `Regularización inventario ${refArticulo}`, apuntes }
}
