/**
 * Valoración de existencias por COSTE MEDIO PONDERADO (por artículo y almacén).
 * En cada entrada se recalcula la media; las salidas se valoran al coste medio
 * vigente y no lo alteran. Opera con cantidades y euros de forma estable.
 */
import { aCentimos, aEuros, redondear2 } from './dinero'
import type { MovimientoStock } from './tipos'

export interface Existencia {
  cantidad: number
  costeMedio: number // coste unitario medio
  valor: number // cantidad × costeMedio
}

/** Ordena por fecha y, a igualdad, por orden de creación (estable). */
function ordenar(movs: MovimientoStock[]): MovimientoStock[] {
  return [...movs].sort((a, b) => (a.fecha === b.fecha ? a.creadoEn.localeCompare(b.creadoEn) : a.fecha.localeCompare(b.fecha)))
}

/**
 * Calcula la existencia resultante de una lista de movimientos (ya filtrada
 * por artículo y almacén). Ignora los anulados.
 */
export function valorar(movs: MovimientoStock[]): Existencia {
  let cantidad = 0
  let costeMedio = 0
  for (const m of ordenar(movs)) {
    if (m.anuladoEn) continue
    if (m.cantidad > 0) {
      // Entrada: nueva media ponderada.
      const valorPrevio = aCentimos(aEuros(Math.round(cantidad * aCentimos(costeMedio))))
      const valorEntrada = aCentimos(aEuros(Math.round(m.cantidad * aCentimos(m.costeUnitario))))
      cantidad += m.cantidad
      costeMedio = cantidad > 0 ? redondear2(aEuros(valorPrevio + valorEntrada) / cantidad) : 0
    } else if (m.cantidad < 0) {
      // Salida: reduce cantidad al coste medio vigente (no altera la media).
      cantidad = Math.max(0, cantidad + m.cantidad)
    }
  }
  const valor = redondear2(aEuros(Math.round(cantidad * aCentimos(costeMedio))))
  return { cantidad, costeMedio, valor }
}

/** Existencia de un artículo en un almacén concreto. */
export function existenciaEn(articuloId: string, almacenId: string, movs: MovimientoStock[]): Existencia {
  return valorar(movs.filter((m) => m.articuloId === articuloId && m.almacenId === almacenId))
}

/** Existencia total de un artículo sumando todos los almacenes. */
export function existenciaTotal(
  articuloId: string,
  movs: MovimientoStock[],
  almacenes: string[],
): Existencia {
  let cantidad = 0
  let valorCent = 0
  for (const almId of almacenes) {
    const e = existenciaEn(articuloId, almId, movs)
    cantidad += e.cantidad
    valorCent += aCentimos(e.valor)
  }
  const valor = aEuros(valorCent)
  return { cantidad, costeMedio: cantidad > 0 ? redondear2(valor / cantidad) : 0, valor }
}
