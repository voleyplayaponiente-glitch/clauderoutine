/**
 * Libros registro de IVA (repercutido y soportado), resumen para el modelo 303
 * y resumen para el modelo 347 (operaciones con terceros por encima del umbral).
 */
import { aCentimos, aEuros } from './dinero'
import { totalesCompra } from './compras'
import { brutoVenta } from './ventas'
import type { Venta, Compra, Tercero } from './tipos'

export interface LineaIvaLibro {
  fecha: string
  concepto: string
  base: number
  tipo: number
  cuota: number
}

export function libroRepercutido(ventas: Venta[]): LineaIvaLibro[] {
  const filas: LineaIvaLibro[] = []
  for (const v of ventas) {
    if (v.anuladoEn) continue
    for (const l of v.lineasIva) {
      if (l.cuota === 0 && l.base === 0) continue
      filas.push({ fecha: v.fecha, concepto: `Ventas ${v.fecha}`, base: l.base, tipo: l.tipo, cuota: l.cuota })
    }
  }
  return filas.sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export function libroSoportado(compras: Compra[], nombreTercero: (id: string) => string): LineaIvaLibro[] {
  const filas: LineaIvaLibro[] = []
  for (const c of compras) {
    if (c.anuladoEn || !c.deducible) continue
    for (const l of c.lineasIva) {
      if (l.cuota === 0 && l.base === 0) continue
      filas.push({ fecha: c.fechaFactura, concepto: `${c.numFactura} · ${nombreTercero(c.terceroId)}`, base: l.base, tipo: l.tipo, cuota: l.cuota })
    }
  }
  return filas.sort((a, b) => a.fecha.localeCompare(b.fecha))
}

function suma(filas: { base: number; cuota: number }[]): { base: number; cuota: number } {
  let base = 0
  let cuota = 0
  for (const f of filas) {
    base += aCentimos(f.base)
    cuota += aCentimos(f.cuota)
  }
  return { base: aEuros(base), cuota: aEuros(cuota) }
}

/** Resumen del modelo 303: IVA devengado − IVA deducible = a ingresar / a compensar. */
export function resumen303(repercutido: LineaIvaLibro[], soportado: LineaIvaLibro[]): {
  baseRepercutida: number
  ivaRepercutido: number
  baseSoportada: number
  ivaSoportado: number
  resultado: number // + a ingresar / − a compensar
} {
  const r = suma(repercutido)
  const s = suma(soportado)
  return {
    baseRepercutida: r.base,
    ivaRepercutido: r.cuota,
    baseSoportada: s.base,
    ivaSoportado: s.cuota,
    resultado: aEuros(aCentimos(r.cuota) - aCentimos(s.cuota)),
  }
}

export interface Registro347 {
  terceroId: string
  nombre: string
  compras: number
  ventas: number
  total: number
}

/**
 * Modelo 347: terceros cuyo volumen anual de operaciones supera el umbral
 * (3.005,06 € por defecto). Agrupa compras por proveedor.
 */
export function modelo347(
  compras: Compra[],
  ventasPorTercero: Record<string, number>,
  terceros: Tercero[],
  anio: number,
  umbral = 3005.06,
): Registro347[] {
  const acc = new Map<string, { compras: number; ventas: number }>()
  for (const c of compras) {
    if (c.anuladoEn || Number(c.fechaFactura.slice(0, 4)) !== anio) continue
    const cur = acc.get(c.terceroId) ?? { compras: 0, ventas: 0 }
    cur.compras = aEuros(aCentimos(cur.compras) + aCentimos(totalesCompra(c).total))
    acc.set(c.terceroId, cur)
  }
  for (const [id, importe] of Object.entries(ventasPorTercero)) {
    const cur = acc.get(id) ?? { compras: 0, ventas: 0 }
    cur.ventas = aEuros(aCentimos(cur.ventas) + aCentimos(importe))
    acc.set(id, cur)
  }
  const nombre = (id: string) => terceros.find((t) => t.id === id)?.nombre ?? '—'
  return [...acc.entries()]
    .map(([terceroId, v]) => ({ terceroId, nombre: nombre(terceroId), compras: v.compras, ventas: v.ventas, total: aEuros(aCentimos(v.compras) + aCentimos(v.ventas)) }))
    .filter((r) => Math.abs(r.total) > umbral)
    .sort((a, b) => b.total - a.total)
}

/** Total de ventas brutas (para importes de resumen). */
export function totalVentas(ventas: Venta[]): number {
  return aEuros(ventas.filter((v) => !v.anuladoEn).reduce((s, v) => s + aCentimos(brutoVenta(v)), 0))
}
