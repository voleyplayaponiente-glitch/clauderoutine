/**
 * Clasificación de importes por tramos de vencimiento (aging), reutilizable
 * para deudas (acreedores) y deudores. Separa lo vencido de lo por vencer.
 */
import { aCentimos, aEuros } from './dinero'

export type Tramo = 'VENCIDO' | 'D0_30' | 'D31_60' | 'D61_90' | 'D90_MAS' | 'LARGO_PLAZO'

export const TRAMOS_ORDEN: Tramo[] = ['VENCIDO', 'D0_30', 'D31_60', 'D61_90', 'D90_MAS', 'LARGO_PLAZO']

export const ETIQUETA_TRAMO: Record<Tramo, string> = {
  VENCIDO: 'Vencido',
  D0_30: '0–30 días',
  D31_60: '31–60 días',
  D61_90: '61–90 días',
  D90_MAS: '+90 días',
  LARGO_PLAZO: 'Largo plazo',
}

function dias(desde: string, hasta: string): number {
  return Math.round((new Date(hasta + 'T00:00:00').getTime() - new Date(desde + 'T00:00:00').getTime()) / 86400000)
}

/** Tramo de un vencimiento respecto a hoy. Sin fecha → largo plazo. */
export function clasificarTramo(fechaVencimiento: string | undefined, hoyISO: string): Tramo {
  if (!fechaVencimiento) return 'LARGO_PLAZO'
  const d = dias(hoyISO, fechaVencimiento)
  if (d < 0) return 'VENCIDO'
  if (d <= 30) return 'D0_30'
  if (d <= 60) return 'D31_60'
  if (d <= 90) return 'D61_90'
  if (d <= 365) return 'D90_MAS'
  return 'LARGO_PLAZO'
}

export interface ItemVencimiento {
  importe: number
  fechaVencimiento?: string
}

/** Suma por tramo. */
export function agruparPorTramo(items: ItemVencimiento[], hoyISO: string): Record<Tramo, number> {
  const acc: Record<Tramo, number> = { VENCIDO: 0, D0_30: 0, D31_60: 0, D61_90: 0, D90_MAS: 0, LARGO_PLAZO: 0 }
  for (const it of items) {
    const t = clasificarTramo(it.fechaVencimiento, hoyISO)
    acc[t] = aEuros(aCentimos(acc[t]) + aCentimos(it.importe))
  }
  return acc
}

/** Días de antigüedad de un saldo vencido (0 si aún no ha vencido). */
export function diasVencido(fechaVencimiento: string | undefined, hoyISO: string): number {
  if (!fechaVencimiento) return 0
  const d = dias(fechaVencimiento, hoyISO)
  return d > 0 ? d : 0
}

/**
 * Provisión por insolvencia sugerida según los días vencido:
 *  · > 180 días → 100 %  · > 90 → 50 %  · > umbral → 25 %  · resto 0 %.
 */
export function provisionSugerida(importe: number, diasVenc: number, umbralDias: number): number {
  let pct = 0
  if (diasVenc > 180) pct = 1
  else if (diasVenc > 90) pct = 0.5
  else if (diasVenc > umbralDias) pct = 0.25
  return aEuros(Math.round(aCentimos(importe) * pct))
}
