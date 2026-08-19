import { comprobarCentimos, type Centimos } from './dinero.js'
import { aISO, diasDelMes, type FechaISO } from './fechas.js'

/**
 * Tarjetas de crédito: ciclos y coste real del aplazado.
 *
 * Dos números que casi ninguna app enseña y que aquí son el centro:
 *
 *  1. **Los días de financiación gratis que te quedan.** Una tarjeta de pago
 *     total es un préstamo sin intereses de entre 20 y 55 días; saber en qué
 *     punto del ciclo estás cambia cuándo compras algo caro.
 *  2. **Cuánto acabas pagando por lo aplazado.** El «pago mínimo» de un
 *     revolving es el producto financiero que más caro sale de España, y la
 *     única forma honesta de contarlo es con la cifra final al lado.
 */

export interface ConfiguracionCiclo {
  /** Día del mes en que cierra el ciclo. */
  diaCorte: number
  /** Día del mes en que se carga el recibo. */
  diaPago: number
}

export interface Ciclo {
  /** Primer día de compras del ciclo. */
  desde: FechaISO
  /** Día de corte: la última compra que entra en este recibo. */
  hasta: FechaISO
  /** Cuándo se cobra. */
  fechaPago: FechaISO
}

export class ErrorTarjeta extends Error {}

/** Un día 31 en un mes de 30 es el 30. Los bancos hacen esto y si no se hace
 *  aquí, el ciclo de febrero se va al mes siguiente. */
function diaValido(anio: number, mes: number, dia: number): Date {
  return new Date(anio, mes, Math.min(dia, diasDelMes(anio, mes)))
}

function comprobarDia(dia: number, nombre: string): void {
  if (!Number.isInteger(dia) || dia < 1 || dia > 31) {
    throw new ErrorTarjeta(`El ${nombre} tiene que ser un día del mes, entre 1 y 31.`)
  }
}

function diasEntre(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

/**
 * El ciclo en el que cae una fecha, el anterior (ya cortado y pendiente de
 * pago) y los días de financiación que quedan.
 *
 * El día de pago es **la primera vez que llega el día de pago después del
 * corte**, no «el mes siguiente»: con corte el 25 y pago el 5, el recibo es el
 * 5 del mes siguiente; con corte el 5 y pago el 25, es el 25 del mismo mes.
 */
export function cicloDe(
  config: ConfiguracionCiclo,
  hoy: Date,
): { actual: Ciclo; anterior: Ciclo; diasHastaCorte: number; diasGratisSiComprasHoy: number } {
  comprobarDia(config.diaCorte, 'día de corte')
  comprobarDia(config.diaPago, 'día de pago')

  const ahora = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())

  // El corte de este mes; si ya ha pasado, el ciclo en curso cierra el mes que
  // viene.
  const corteDeEsteMes = diaValido(ahora.getFullYear(), ahora.getMonth(), config.diaCorte)
  const desplazamiento = ahora > corteDeEsteMes ? 1 : 0
  const corte = diaValido(ahora.getFullYear(), ahora.getMonth() + desplazamiento, config.diaCorte)
  const corteAnterior = diaValido(ahora.getFullYear(), ahora.getMonth() + desplazamiento - 1, config.diaCorte)
  const corteAnteAnterior = diaValido(ahora.getFullYear(), ahora.getMonth() + desplazamiento - 2, config.diaCorte)

  const pagoDe = (fechaCorte: Date): Date => {
    const mismoMes = diaValido(fechaCorte.getFullYear(), fechaCorte.getMonth(), config.diaPago)
    return mismoMes > fechaCorte
      ? mismoMes
      : diaValido(fechaCorte.getFullYear(), fechaCorte.getMonth() + 1, config.diaPago)
  }

  const diaSiguiente = (fecha: Date): Date =>
    new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + 1)

  const actual: Ciclo = {
    desde: aISO(diaSiguiente(corteAnterior)),
    hasta: aISO(corte),
    fechaPago: aISO(pagoDe(corte)),
  }
  const anterior: Ciclo = {
    desde: aISO(diaSiguiente(corteAnteAnterior)),
    hasta: aISO(corteAnterior),
    fechaPago: aISO(pagoDe(corteAnterior)),
  }

  return {
    actual,
    anterior,
    diasHastaCorte: diasEntre(ahora, corte),
    // Lo que compres hoy se paga el día de pago del ciclo en curso.
    diasGratisSiComprasHoy: diasEntre(ahora, pagoDe(corte)),
  }
}

/** Cuánto de la tarjeta está usado, de 0 a 100. Por encima del 30 % empieza a
 *  pesar en el historial crediticio, aunque se pague todo a fin de mes. */
export function utilizacion(dispuesto: Centimos, limite: Centimos): number {
  if (limite <= 0) return 0
  return (dispuesto / limite) * 100
}

// ─────────────────────────────────────────────────────────── Pago aplazado

export interface Aplazado {
  saldo: Centimos
  /** Nominal anual en tanto por ciento: 24 se escribe 24. */
  tinAnual: number
  /** Cuota fija mensual. Si viene, manda sobre el mínimo por porcentaje. */
  cuotaFija?: Centimos
  /** Porcentaje del saldo que se paga cada mes. */
  minimoPorcentaje?: number
  /** Suelo del pago mínimo en céntimos. */
  minimoSuelo?: Centimos
}

export interface SimulacionAplazado {
  /** `null` cuando la deuda no se acaba nunca con ese pago. */
  meses: number | null
  interesTotal: Centimos
  pagadoTotal: Centimos
  primeraCuota: Centimos
  /** Cuánto se acaba pagando por cada euro dispuesto. */
  porCadaEuro: number | null
  nuncaSeLiquida: boolean
  /** Cuánto habría que pagar al mes, como mínimo, para que baje algo. */
  cuotaMinimaViable: Centimos
}

/** Cien años. Más allá, la respuesta útil no es un número: es «así no se acaba». */
const TOPE_MESES = 1200

/**
 * Simula un saldo aplazado mes a mes.
 *
 * El interés se devenga **antes** de calcular el pago mínimo, que es como lo
 * hacen los contratos: por eso el mínimo del primer mes de un 3 % sobre 3.000 €
 * no son 90 € sino 91,80 €.
 *
 * Cuando la cuota no supera al interés se devuelve `meses: null` y
 * `nuncaSeLiquida`. Es el caso que de verdad importa contar: con 3.000 € al
 * 24 % y 60 € al mes, la deuda no baja **jamás**, y ningún número grande
 * transmite eso tan bien como decirlo.
 */
export function simularAplazado(aplazado: Aplazado): SimulacionAplazado {
  comprobarCentimos(aplazado.saldo)
  if (aplazado.saldo < 0) throw new ErrorTarjeta('El saldo aplazado no puede ser negativo.')
  if (aplazado.cuotaFija === undefined && aplazado.minimoPorcentaje === undefined) {
    throw new ErrorTarjeta('Hace falta una cuota fija o un porcentaje mínimo para simular.')
  }

  const i = aplazado.tinAnual / 100 / 12
  let saldo = aplazado.saldo
  let interesTotal = 0
  let pagadoTotal = 0
  let primeraCuota = 0
  let meses = 0

  while (saldo > 0 && meses < TOPE_MESES) {
    meses++
    const interes = Math.round(saldo * i)
    saldo += interes
    interesTotal += interes

    const porPorcentaje =
      aplazado.minimoPorcentaje === undefined
        ? 0
        : Math.max(aplazado.minimoSuelo ?? 0, Math.round((saldo * aplazado.minimoPorcentaje) / 100))
    const cuota = Math.min(saldo, aplazado.cuotaFija ?? porPorcentaje)
    if (meses === 1) primeraCuota = cuota

    if (cuota <= interes) {
      return {
        meses: null,
        interesTotal: comprobarCentimos(interesTotal),
        pagadoTotal: comprobarCentimos(pagadoTotal),
        primeraCuota: comprobarCentimos(primeraCuota),
        porCadaEuro: null,
        nuncaSeLiquida: true,
        cuotaMinimaViable: comprobarCentimos(interes + 1),
      }
    }

    saldo -= cuota
    pagadoTotal += cuota
  }

  const seLiquida = saldo <= 0
  return {
    meses: seLiquida ? meses : null,
    interesTotal: comprobarCentimos(interesTotal),
    pagadoTotal: comprobarCentimos(pagadoTotal),
    primeraCuota: comprobarCentimos(primeraCuota),
    porCadaEuro: seLiquida && aplazado.saldo > 0 ? pagadoTotal / aplazado.saldo : null,
    nuncaSeLiquida: !seLiquida,
    cuotaMinimaViable: comprobarCentimos(Math.round(aplazado.saldo * i) + 1),
  }
}

/**
 * Lo que cuesta de más aplazar en vez de pagar el recibo entero.
 *
 * Es la comparación que hace que se entienda: no «pagarás 4.627 €», sino
 * «pagarás 1.627 € de más por los mismos 3.000 € de compras».
 */
export function sobrecosteDeAplazar(aplazado: Aplazado): {
  simulacion: SimulacionAplazado
  sobrecoste: Centimos | null
} {
  const simulacion = simularAplazado(aplazado)
  return {
    simulacion,
    sobrecoste: simulacion.meses === null ? null : comprobarCentimos(simulacion.interesTotal),
  }
}
