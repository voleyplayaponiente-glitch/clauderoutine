/** Indicadores de stock: valor de inventario, alertas y stock muerto. */
import { aCentimos, aEuros } from './dinero'
import { existenciaTotal } from './valoracion'
import type { Articulo, MovimientoStock } from './tipos'

export interface ResumenArticulo {
  articulo: Articulo
  cantidad: number
  costeMedio: number
  valorCoste: number
  valorPvp: number
  bajoMinimo: boolean
  ultimoMovimiento?: string // fecha ISO
}

export function resumenArticulo(
  articulo: Articulo,
  movs: MovimientoStock[],
  almacenes: string[],
): ResumenArticulo {
  const e = existenciaTotal(articulo.id, movs, almacenes)
  const propios = movs.filter((m) => m.articuloId === articulo.id && !m.anuladoEn)
  const ultimo = propios.reduce<string | undefined>((acc, m) => (!acc || m.fecha > acc ? m.fecha : acc), undefined)
  return {
    articulo,
    cantidad: e.cantidad,
    costeMedio: e.costeMedio,
    valorCoste: e.valor,
    valorPvp: aEuros(Math.round(e.cantidad * aCentimos(articulo.pvp))),
    bajoMinimo: e.cantidad < articulo.stockMinimo,
    ultimoMovimiento: ultimo,
  }
}

export interface TotalesInventario {
  valorCoste: number
  valorPvp: number
  referencias: number
  bajoMinimo: number
}

export function totalesInventario(resumenes: ResumenArticulo[]): TotalesInventario {
  let coste = 0
  let pvp = 0
  let bajo = 0
  for (const r of resumenes) {
    coste += aCentimos(r.valorCoste)
    pvp += aCentimos(r.valorPvp)
    if (r.bajoMinimo) bajo++
  }
  return { valorCoste: aEuros(coste), valorPvp: aEuros(pvp), referencias: resumenes.length, bajoMinimo: bajo }
}

/** Días sin movimiento (excluyendo el aprovisionamiento de apertura). */
export function diasSinMovimiento(articuloId: string, movs: MovimientoStock[], hoyISO: string): number | null {
  const fechas = movs
    .filter((m) => m.articuloId === articuloId && !m.anuladoEn && !m.esAprovisionamientoApertura)
    .map((m) => m.fecha)
    .sort()
  if (fechas.length === 0) return null
  const ultima = fechas[fechas.length - 1]
  const dias = Math.round((new Date(hoyISO + 'T00:00:00').getTime() - new Date(ultima + 'T00:00:00').getTime()) / 86400000)
  return dias
}

/** ¿Es stock muerto? Sin movimiento (salvo apertura) en más de N días y con stock. */
export function esStockMuerto(
  resumen: ResumenArticulo,
  movs: MovimientoStock[],
  hoyISO: string,
  diasUmbral: number,
): boolean {
  if (resumen.cantidad <= 0) return false
  const dias = diasSinMovimiento(resumen.articulo.id, movs, hoyISO)
  return dias !== null && dias > diasUmbral
}
