/**
 * Libros contables derivados de los asientos: balance de sumas y saldos,
 * clasificación PGC, Cuenta de Pérdidas y Ganancias y Balance de Situación.
 * El balance de sumas y saldos CUADRA por construcción (Σdebe = Σhaber) y el
 * Balance de Situación cuadra con la P&G al incluir el resultado en el PN.
 */
import { aCentimos, aEuros } from './dinero'
import type { Asiento } from './partida-doble'

export type NaturalezaCuenta = 'ACTIVO' | 'PASIVO' | 'PN' | 'INGRESO' | 'GASTO'

export interface SaldoCuenta {
  cuenta: string
  debe: number
  haber: number
  saldo: number // debe − haber (deudor positivo)
}

/** Balance de sumas y saldos a partir de todos los asientos. */
export function sumasYSaldos(asientos: Asiento[]): {
  cuentas: SaldoCuenta[]
  totalDebe: number
  totalHaber: number
  cuadra: boolean
} {
  const porCuenta = new Map<string, { debe: number; haber: number }>()
  for (const a of asientos) {
    for (const ap of a.apuntes) {
      const acc = porCuenta.get(ap.cuenta) ?? { debe: 0, haber: 0 }
      acc.debe += aCentimos(ap.debe)
      acc.haber += aCentimos(ap.haber)
      porCuenta.set(ap.cuenta, acc)
    }
  }
  const cuentas: SaldoCuenta[] = [...porCuenta.entries()]
    .map(([cuenta, { debe, haber }]) => ({ cuenta, debe: aEuros(debe), haber: aEuros(haber), saldo: aEuros(debe - haber) }))
    .sort((a, b) => a.cuenta.localeCompare(b.cuenta))
  let td = 0
  let th = 0
  for (const c of cuentas) {
    td += aCentimos(c.debe)
    th += aCentimos(c.haber)
  }
  return { cuentas, totalDebe: aEuros(td), totalHaber: aEuros(th), cuadra: td === th }
}

/** Clasifica una cuenta PGC por su código (y saldo para los grupos 4 y 5). */
export function clasificar(codigo: string, saldo: number): NaturalezaCuenta {
  const g = Number(codigo[0])
  if (g === 6) return 'GASTO'
  if (g === 7) return 'INGRESO'
  if (g === 2 || g === 3) return 'ACTIVO'
  if (g === 1) {
    // 10–13 patrimonio neto; resto (14–19) pasivo no corriente.
    const dos = Number(codigo.slice(0, 2))
    return dos >= 10 && dos <= 13 ? 'PN' : 'PASIVO'
  }
  // Grupos 4 y 5: según el signo del saldo (deudor → activo; acreedor → pasivo).
  return saldo >= 0 ? 'ACTIVO' : 'PASIVO'
}

export interface CuentaPyG {
  cuenta: string
  importe: number
}

/** Cuenta de Pérdidas y Ganancias: ingresos − gastos = resultado. */
export function cuentaPyG(saldos: SaldoCuenta[]): {
  ingresos: number
  gastos: number
  resultado: number
  lineasIngreso: CuentaPyG[]
  lineasGasto: CuentaPyG[]
} {
  let ingresos = 0
  let gastos = 0
  const lineasIngreso: CuentaPyG[] = []
  const lineasGasto: CuentaPyG[] = []
  for (const c of saldos) {
    const nat = clasificar(c.cuenta, c.saldo)
    if (nat === 'INGRESO') {
      const imp = aEuros(-aCentimos(c.saldo)) // ingreso = haber − debe
      ingresos = aEuros(aCentimos(ingresos) + aCentimos(imp))
      lineasIngreso.push({ cuenta: c.cuenta, importe: imp })
    } else if (nat === 'GASTO') {
      gastos = aEuros(aCentimos(gastos) + aCentimos(c.saldo))
      lineasGasto.push({ cuenta: c.cuenta, importe: c.saldo })
    }
  }
  return { ingresos, gastos, resultado: aEuros(aCentimos(ingresos) - aCentimos(gastos)), lineasIngreso, lineasGasto }
}

export interface MasaBalance {
  cuenta: string
  importe: number
}

/** Balance de Situación. Incluye el resultado en el PN para que cuadre. */
export function balanceSituacion(saldos: SaldoCuenta[]): {
  activo: MasaBalance[]
  pasivo: MasaBalance[]
  patrimonioNeto: MasaBalance[]
  totalActivo: number
  totalPasivoPN: number
  resultado: number
  cuadra: boolean
} {
  const activo: MasaBalance[] = []
  const pasivo: MasaBalance[] = []
  const patrimonioNeto: MasaBalance[] = []
  const { resultado } = cuentaPyG(saldos)

  for (const c of saldos) {
    const nat = clasificar(c.cuenta, c.saldo)
    if (nat === 'ACTIVO' && c.saldo !== 0) activo.push({ cuenta: c.cuenta, importe: c.saldo })
    else if (nat === 'PASIVO' && c.saldo !== 0) pasivo.push({ cuenta: c.cuenta, importe: aEuros(-aCentimos(c.saldo)) })
    else if (nat === 'PN' && c.saldo !== 0) patrimonioNeto.push({ cuenta: c.cuenta, importe: aEuros(-aCentimos(c.saldo)) })
  }
  patrimonioNeto.push({ cuenta: '129 Resultado del ejercicio', importe: resultado })

  const totalActivo = aEuros(activo.reduce((s, x) => s + aCentimos(x.importe), 0))
  const totalPN = aEuros(patrimonioNeto.reduce((s, x) => s + aCentimos(x.importe), 0))
  const totalPasivo = aEuros(pasivo.reduce((s, x) => s + aCentimos(x.importe), 0))
  const totalPasivoPN = aEuros(aCentimos(totalPasivo) + aCentimos(totalPN))
  return { activo, pasivo, patrimonioNeto, totalActivo, totalPasivoPN, resultado, cuadra: aCentimos(totalActivo) === aCentimos(totalPasivoPN) }
}
