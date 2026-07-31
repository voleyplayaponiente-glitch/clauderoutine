/**
 * Previsión de tesorería: proyección del saldo diario a partir de la posición
 * de partida y los flujos previstos (entradas + / salidas −), y detección de
 * los días con tensión de liquidez (por debajo del saldo mínimo de seguridad).
 */
import { aCentimos, aEuros } from './dinero'

export interface Flujo {
  fecha: string // yyyy-mm-dd
  importe: number // + entrada / − salida
  concepto: string
  categoria: string
}

export interface PuntoSaldo {
  fecha: string
  entradas: number
  salidas: number
  saldo: number // saldo al cierre del día
}

function addDias(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

/**
 * Serie diaria de saldos desde `desdeISO` durante `dias` días. Los flujos con
 * fecha anterior al inicio se ignoran; los posteriores al horizonte también.
 */
export function proyectarSaldoDiario(
  saldoInicial: number,
  flujos: Flujo[],
  desdeISO: string,
  dias: number,
): PuntoSaldo[] {
  const porDia = new Map<string, { e: number; s: number }>()
  for (const f of flujos) {
    const acc = porDia.get(f.fecha) ?? { e: 0, s: 0 }
    if (f.importe >= 0) acc.e = aEuros(aCentimos(acc.e) + aCentimos(f.importe))
    else acc.s = aEuros(aCentimos(acc.s) + aCentimos(-f.importe))
    porDia.set(f.fecha, acc)
  }
  const serie: PuntoSaldo[] = []
  let saldoCent = aCentimos(saldoInicial)
  for (let i = 0; i < dias; i++) {
    const fecha = addDias(desdeISO, i)
    const dia = porDia.get(fecha) ?? { e: 0, s: 0 }
    saldoCent += aCentimos(dia.e) - aCentimos(dia.s)
    serie.push({ fecha, entradas: dia.e, salidas: dia.s, saldo: aEuros(saldoCent) })
  }
  return serie
}

export interface Tension {
  hayTension: boolean
  primerDia?: string // primer día por debajo del mínimo
  saldoMinimo: number // saldo más bajo de la serie
  fechaMinimo?: string
}

/** Detecta tensión de liquidez respecto al saldo mínimo de seguridad. */
export function detectarTension(serie: PuntoSaldo[], saldoMinimoSeguridad: number): Tension {
  let primerDia: string | undefined
  let saldoMinimo = Infinity
  let fechaMinimo: string | undefined
  for (const p of serie) {
    if (p.saldo < saldoMinimo) {
      saldoMinimo = p.saldo
      fechaMinimo = p.fecha
    }
    if (!primerDia && p.saldo < saldoMinimoSeguridad) primerDia = p.fecha
  }
  return {
    hayTension: primerDia !== undefined,
    primerDia,
    saldoMinimo: serie.length ? saldoMinimo : 0,
    fechaMinimo,
  }
}
