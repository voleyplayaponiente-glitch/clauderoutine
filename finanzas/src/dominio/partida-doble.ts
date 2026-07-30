/**
 * Partida doble. Todo asiento debe cuadrar: Σdebe = Σhaber. El descuadre nunca
 * se oculta; esta función lo detecta y devuelve la diferencia exacta.
 */
import { aCentimos, aEuros } from './dinero'

export interface Apunte {
  cuenta: string // código PGC, p. ej. "700"
  debe: number
  haber: number
  concepto?: string
  centroCosteId?: string
  terceroId?: string
}

export interface Asiento {
  fecha: string // ISO yyyy-mm-dd
  concepto: string
  apuntes: Apunte[]
}

export interface ResultadoCuadre {
  cuadra: boolean
  totalDebe: number
  totalHaber: number
  diferencia: number // debe − haber (en euros); 0 si cuadra
}

/** Comprueba el cuadre de un asiento operando en céntimos (exacto). */
export function comprobarCuadre(apuntes: Apunte[]): ResultadoCuadre {
  let debeCent = 0
  let haberCent = 0
  for (const a of apuntes) {
    if (a.debe < 0 || a.haber < 0) throw new Error('Un apunte no puede tener importe negativo')
    if (a.debe > 0 && a.haber > 0) throw new Error('Un apunte no puede tener debe y haber a la vez')
    debeCent += aCentimos(a.debe)
    haberCent += aCentimos(a.haber)
  }
  const difCent = debeCent - haberCent
  return {
    cuadra: difCent === 0,
    totalDebe: aEuros(debeCent),
    totalHaber: aEuros(haberCent),
    diferencia: aEuros(difCent),
  }
}

/** Valida un asiento completo; lanza con un mensaje claro si no cuadra. */
export function validarAsiento(asiento: Asiento): void {
  if (!asiento.apuntes || asiento.apuntes.length < 2) {
    throw new Error('Un asiento necesita al menos dos apuntes')
  }
  const r = comprobarCuadre(asiento.apuntes)
  if (!r.cuadra) {
    throw new Error(
      `Asiento descuadrado en ${r.diferencia} € (debe ${r.totalDebe} / haber ${r.totalHaber})`,
    )
  }
}

/** Saldo de una cuenta a partir de una lista de apuntes (deudor positivo). */
export function saldoCuenta(cuenta: string, apuntes: Apunte[]): number {
  let cent = 0
  for (const a of apuntes) {
    if (a.cuenta !== cuenta) continue
    cent += aCentimos(a.debe) - aCentimos(a.haber)
  }
  return aEuros(cent)
}
