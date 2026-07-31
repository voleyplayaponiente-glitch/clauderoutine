/** Saldos de cuentas de tesorería (caja y banco) y utilidades de arqueo. */
import { aCentimos, aEuros } from './dinero'
import type { CuentaTesoreria, MovimientoTesoreria, Denominacion } from './tipos'

/** Denominaciones del euro: billetes y monedas. */
export const DENOMINACIONES_EUR: number[] = [500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01]

/** Saldo actual = saldo inicial + suma de movimientos (no anulados). */
export function saldoCuenta(cuenta: CuentaTesoreria, movimientos: MovimientoTesoreria[]): number {
  let cent = aCentimos(cuenta.saldoInicial)
  for (const m of movimientos) {
    if (m.cuentaId !== cuenta.id || m.anuladoEn) continue
    cent += aCentimos(m.importe)
  }
  return aEuros(cent)
}

/** Tesorería total: suma de saldos de todas las cuentas. */
export function tesoreriaTotal(cuentas: CuentaTesoreria[], movimientos: MovimientoTesoreria[]): number {
  return aEuros(cuentas.reduce((c, cta) => c + aCentimos(saldoCuenta(cta, movimientos)), 0))
}

/** Total contado de un arqueo a partir de las denominaciones. */
export function totalArqueo(denominaciones: Denominacion[]): number {
  return aEuros(
    denominaciones.reduce((c, d) => c + aCentimos(aEuros(aCentimos(d.valor) * Math.max(0, Math.trunc(d.cantidad)))), 0),
  )
}

export interface ResultadoArqueo {
  saldoContado: number
  saldoTeorico: number
  diferencia: number // contado − teórico
  superaUmbral: boolean
  requiereExplicacion: boolean
}

/** Compara lo contado con lo teórico; marca si supera el umbral tolerado. */
export function evaluarArqueo(
  denominaciones: Denominacion[],
  saldoTeorico: number,
  umbralTolerado: number,
): ResultadoArqueo {
  const saldoContado = totalArqueo(denominaciones)
  const diferencia = aEuros(aCentimos(saldoContado) - aCentimos(saldoTeorico))
  const supera = Math.abs(diferencia) > Math.abs(umbralTolerado)
  return {
    saldoContado,
    saldoTeorico,
    diferencia,
    superaUmbral: supera,
    requiereExplicacion: supera,
  }
}
