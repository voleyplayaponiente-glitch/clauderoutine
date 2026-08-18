import { comprobarCentimos, type Centimos } from './dinero.js'
import { deISO, type FechaISO } from './fechas.js'

/**
 * Reglas de un movimiento.
 *
 * El **signo es el único criterio**: negativo sale dinero, positivo entra. No
 * hay una columna «tipo» que pueda decir lo contrario, porque en cuanto hay dos
 * fuentes de verdad para lo mismo acaban discrepando y el saldo deja de cuadrar.
 */

export type EstadoMovimiento = 'previsto' | 'confirmado'

export interface MovimientoEntrada {
  importe: Centimos
  fecha: FechaISO
  concepto: string
  cuentaId: string
}

export type Validacion = { valido: true } | { valido: false; campo: string; mensaje: string }

/** Ni 1970 ni el año 2200: una fecha así siempre es un dedo, no una intención. */
const DESDE = new Date(2000, 0, 1)
const AÑOS_ADELANTE = 5

export function validarMovimiento(entrada: MovimientoEntrada, hoy: Date): Validacion {
  if (!entrada.cuentaId) {
    return { valido: false, campo: 'cuentaId', mensaje: 'Elige a qué cuenta va el movimiento.' }
  }

  const concepto = (entrada.concepto ?? '').trim()
  if (!concepto) {
    return { valido: false, campo: 'concepto', mensaje: 'Escribe un concepto: «Café», «Luz»…' }
  }
  if (concepto.length > 200) {
    return { valido: false, campo: 'concepto', mensaje: 'El concepto no puede pasar de 200 caracteres.' }
  }

  try {
    comprobarCentimos(entrada.importe)
  } catch {
    return { valido: false, campo: 'importe', mensaje: 'Ese importe no es válido.' }
  }
  if (entrada.importe === 0) {
    // Un movimiento de 0 € no dice nada y esconde el error de quien lo metió.
    return { valido: false, campo: 'importe', mensaje: 'El importe no puede ser cero.' }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(entrada.fecha ?? '')) {
    return { valido: false, campo: 'fecha', mensaje: 'La fecha no tiene un formato válido.' }
  }
  const fecha = deISO(entrada.fecha)
  if (Number.isNaN(fecha.getTime())) {
    return { valido: false, campo: 'fecha', mensaje: 'Esa fecha no existe.' }
  }
  const tope = new Date(hoy.getFullYear() + AÑOS_ADELANTE, hoy.getMonth(), hoy.getDate())
  if (fecha < DESDE || fecha > tope) {
    return {
      valido: false,
      campo: 'fecha',
      mensaje: 'Esa fecha se sale de lo razonable. Comprueba el año.',
    }
  }

  return { valido: true }
}

export interface MovimientoSaldo {
  importe: Centimos
  estado: EstadoMovimiento
}

/**
 * Saldo de una cuenta.
 *
 * **Los previstos no cuentan.** Un recibo que aún no ha pasado no es dinero que
 * ya no tengas: si se sumara, el saldo de la app no cuadraría con el del banco,
 * y ese desajuste es lo primero que hace desconfiar de una aplicación de
 * cuentas. Para lo que va a pasar está la proyección, que es otra cosa y se
 * enseña como tal.
 */
export function saldoDeCuenta(saldoInicial: Centimos, movimientos: MovimientoSaldo[]): Centimos {
  return movimientos
    .filter((m) => m.estado === 'confirmado')
    .reduce((total, m) => total + m.importe, comprobarCentimos(saldoInicial))
}

/** Lo que se espera tener contando también lo previsto hasta una fecha. */
export function saldoProyectado(saldoInicial: Centimos, movimientos: MovimientoSaldo[]): Centimos {
  return movimientos.reduce((total, m) => total + m.importe, comprobarCentimos(saldoInicial))
}

export interface ResumenPeriodo {
  ingresos: Centimos
  gastos: Centimos
  balance: Centimos
  /** Lo que aún no ha pasado, aparte. Nunca mezclado con lo anterior. */
  previsto: { ingresos: Centimos; gastos: Centimos }
}

/**
 * Ingresos, gastos y balance de un conjunto de movimientos.
 *
 * **Lo previsto va aparte, no sumado.** Decir «has gastado 1.703 €» cuando
 * 1.700 son un alquiler que se pagará el mes que viene es exactamente la clase
 * de mentira que esta app no se permite; y además contradiría al saldo, que sí
 * los excluye. Se devuelven las dos cifras y la interfaz enseña cada una como
 * lo que es.
 *
 * Los gastos van en **positivo** aunque se guarden en negativo: «has gastado
 * 1.240 €» se lee mejor que «has gastado −1.240 €».
 */
export function resumir(movimientos: MovimientoSaldo[]): ResumenPeriodo {
  let ingresos = 0
  let gastos = 0
  let previstoIngresos = 0
  let previstoGastos = 0

  for (const m of movimientos) {
    const esPrevisto = m.estado === 'previsto'
    if (m.importe > 0) {
      if (esPrevisto) previstoIngresos += m.importe
      else ingresos += m.importe
    } else {
      if (esPrevisto) previstoGastos += -m.importe
      else gastos += -m.importe
    }
  }
  return {
    ingresos,
    gastos,
    balance: ingresos - gastos,
    previsto: { ingresos: previstoIngresos, gastos: previstoGastos },
  }
}

/**
 * Tasa de ahorro: el primero de los KPIs del encargo.
 * `(ingresos − gastos) / ingresos`. Sin ingresos no es cero: es que **no se
 * puede calcular**, y devolver 0 % ahí sería pintar un semáforo rojo sobre una
 * división por cero.
 */
export function tasaDeAhorro(resumen: ResumenPeriodo): number | null {
  if (resumen.ingresos <= 0) return null
  return (resumen.ingresos - resumen.gastos) / resumen.ingresos
}
