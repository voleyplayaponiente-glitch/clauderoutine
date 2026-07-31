/**
 * Cuadros de amortización: sistema francés (cuota constante) y lineal (capital
 * constante). Devuelve el desglose capital/intereses por periodo. Opera en
 * euros con redondeo a céntimo y ajusta el último periodo para cerrar a cero.
 */
import { aCentimos, aEuros, redondear2 } from './dinero'

export type Periodicidad = 'MENSUAL' | 'TRIMESTRAL' | 'ANUAL'
export type SistemaAmortizacion = 'FRANCES' | 'LINEAL'

export interface Cuota {
  numero: number
  fecha: string
  cuota: number
  interes: number
  capital: number
  pendiente: number // capital vivo tras la cuota
}

const MESES_POR_PERIODO: Record<Periodicidad, number> = { MENSUAL: 1, TRIMESTRAL: 3, ANUAL: 12 }
const PERIODOS_POR_ANIO: Record<Periodicidad, number> = { MENSUAL: 12, TRIMESTRAL: 4, ANUAL: 1 }

function sumarMeses(iso: string, meses: number): string {
  const d = new Date(iso + 'T00:00:00')
  const dia = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + meses)
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(dia, ultimo))
  return d.toISOString().slice(0, 10)
}

export interface ParamsAmortizacion {
  principal: number
  tipoAnual: number // % nominal anual
  nPeriodos: number
  periodicidad: Periodicidad
  fechaInicio: string
  sistema: SistemaAmortizacion
}

export function generarCuadro(p: ParamsAmortizacion): Cuota[] {
  const { principal, tipoAnual, nPeriodos, periodicidad, fechaInicio, sistema } = p
  if (nPeriodos <= 0 || principal <= 0) return []
  const i = tipoAnual / 100 / PERIODOS_POR_ANIO[periodicidad]
  const meses = MESES_POR_PERIODO[periodicidad]
  const cuotas: Cuota[] = []
  let pendienteCent = aCentimos(principal)

  // Cuota constante (francés): C = P·i / (1 − (1+i)^−n).
  const cuotaFija = i === 0 ? redondear2(principal / nPeriodos) : redondear2((principal * i) / (1 - Math.pow(1 + i, -nPeriodos)))
  const capitalLineal = redondear2(principal / nPeriodos)

  for (let n = 1; n <= nPeriodos; n++) {
    const pendiente = aEuros(pendienteCent)
    const interes = redondear2(pendiente * i)
    let capital: number
    let cuota: number
    if (n === nPeriodos) {
      // Último periodo: amortiza todo lo pendiente y cierra a cero.
      capital = pendiente
      cuota = redondear2(capital + interes)
    } else if (sistema === 'FRANCES') {
      cuota = cuotaFija
      capital = redondear2(cuota - interes)
    } else {
      capital = capitalLineal
      cuota = redondear2(capital + interes)
    }
    pendienteCent -= aCentimos(capital)
    cuotas.push({ numero: n, fecha: sumarMeses(fechaInicio, n * meses), cuota, interes, capital, pendiente: aEuros(Math.max(0, pendienteCent)) })
  }
  return cuotas
}

export interface ResumenCuadro {
  totalIntereses: number
  totalCapital: number
  totalPagado: number
  pendienteA: (hoyISO: string) => number
}

export function resumenCuadro(cuadro: Cuota[]): ResumenCuadro {
  let interes = 0
  let capital = 0
  for (const c of cuadro) {
    interes = aEuros(aCentimos(interes) + aCentimos(c.interes))
    capital = aEuros(aCentimos(capital) + aCentimos(c.capital))
  }
  return {
    totalIntereses: interes,
    totalCapital: capital,
    totalPagado: aEuros(aCentimos(interes) + aCentimos(capital)),
    pendienteA: (hoyISO: string) => {
      // Capital pendiente = suma del capital de las cuotas aún no vencidas.
      let pend = 0
      for (const c of cuadro) if (c.fecha > hoyISO) pend = aEuros(aCentimos(pend) + aCentimos(c.capital))
      return pend
    },
  }
}
