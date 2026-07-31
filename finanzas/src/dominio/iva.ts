/**
 * Cálculo de IVA. Separación estricta base / cuota / total en toda entrada,
 * calculable en cualquier dirección (escribo el total y me sale la base).
 * Los tipos NO están hardcodeados: se pasan como parámetro (vienen de Configuración).
 */
import { redondear2, aCentimos, aEuros } from './dinero'

/** Régimen de IVA de una operación. */
export type RegimenIva =
  | 'GENERAL' // sujeta y con repercusión (21/10/4/0…)
  | 'EXENTO' // sujeta pero exenta (art. 20)
  | 'NO_SUJETO' // fuera del ámbito del impuesto
  | 'ISP' // inversión del sujeto pasivo: no se repercute, se autorrepercute

export interface DesgloseIva {
  base: number
  tipo: number // porcentaje aplicado (0 si exento/no sujeto)
  cuota: number
  total: number
  regimen: RegimenIva
}

function cuotaDesdeBase(base: number, tipo: number, regimen: RegimenIva): number {
  if (regimen !== 'GENERAL') return 0
  // Cuota redondeada a céntimo sobre la base.
  return aEuros(Math.round(aCentimos(base) * (tipo / 100)))
}

/** Conozco la BASE y el TIPO → calculo cuota y total. */
export function desdeBase(base: number, tipo: number, regimen: RegimenIva = 'GENERAL'): DesgloseIva {
  const b = redondear2(base)
  const cuota = cuotaDesdeBase(b, tipo, regimen)
  return { base: b, tipo: regimen === 'GENERAL' ? tipo : 0, cuota, total: aEuros(aCentimos(b) + aCentimos(cuota)), regimen }
}

/** Conozco el TOTAL (IVA incluido) y el TIPO → despejo la base. */
export function desdeTotal(total: number, tipo: number, regimen: RegimenIva = 'GENERAL'): DesgloseIva {
  const t = redondear2(total)
  if (regimen !== 'GENERAL' || tipo === 0) {
    return { base: t, tipo: 0, cuota: 0, total: t, regimen }
  }
  // base = total / (1 + tipo/100), redondeada; la cuota es el resto para que cuadre.
  const baseCent = Math.round(aCentimos(t) / (1 + tipo / 100))
  const base = aEuros(baseCent)
  const cuota = aEuros(aCentimos(t) - baseCent)
  return { base, tipo, cuota, total: t, regimen }
}

/** Conozco la CUOTA y el TIPO → deduzco la base y el total. */
export function desdeCuota(cuota: number, tipo: number): DesgloseIva {
  if (tipo === 0) throw new Error('No se puede deducir la base desde la cuota con tipo 0')
  const c = redondear2(cuota)
  const base = aEuros(Math.round(aCentimos(c) / (tipo / 100)))
  return { base, tipo, cuota: c, total: aEuros(aCentimos(base) + aCentimos(c)), regimen: 'GENERAL' }
}

/** Suma de varias líneas con posible tipo distinto: agrupa cuota por tipo. */
export function agruparPorTipo(lineas: DesgloseIva[]): {
  base: number
  cuota: number
  total: number
  porTipo: Record<string, { base: number; cuota: number }>
} {
  const porTipo: Record<string, { base: number; cuota: number }> = {}
  let base = 0
  let cuota = 0
  for (const l of lineas) {
    const clave = l.regimen === 'GENERAL' ? String(l.tipo) : l.regimen
    porTipo[clave] ??= { base: 0, cuota: 0 }
    porTipo[clave].base = aEuros(aCentimos(porTipo[clave].base) + aCentimos(l.base))
    porTipo[clave].cuota = aEuros(aCentimos(porTipo[clave].cuota) + aCentimos(l.cuota))
    base = aEuros(aCentimos(base) + aCentimos(l.base))
    cuota = aEuros(aCentimos(cuota) + aCentimos(l.cuota))
  }
  return { base, cuota, total: aEuros(aCentimos(base) + aCentimos(cuota)), porTipo }
}
