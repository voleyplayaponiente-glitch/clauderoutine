import { comprobarCentimos, type Centimos } from './dinero.js'
import { aISO, deISO, sumarMeses, type FechaISO } from './fechas.js'

/**
 * Préstamos: cuadros de amortización, amortización anticipada y estrategias.
 *
 * Todo el módulo trabaja en **céntimos enteros** y redondea al céntimo en cada
 * periodo, que es lo que hace de verdad un banco. Calcular en euros con
 * decimales y redondear al final da cuadros que no cuadran con el recibo, y un
 * cuadro que no cuadra con el recibo no sirve para nada.
 *
 * La última cuota **se ajusta** para que el saldo cierre exactamente en cero:
 * los redondeos de trescientos sesenta meses no suman una cifra redonda, y el
 * banco tampoco te deja debiendo cuatro céntimos.
 */

export type Sistema = 'frances' | 'aleman' | 'americano'

export interface Prestamo {
  principal: Centimos
  /** Tipo nominal ANUAL en tanto por ciento: 3,90 se escribe 3.9. */
  tinAnual: number
  meses: number
  sistema?: Sistema
  /** Fecha del primer recibo. */
  primerPago: FechaISO
}

export interface Cuota {
  numero: number
  fecha: FechaISO
  cuota: Centimos
  interes: Centimos
  capital: Centimos
  /** Lo que queda por pagar DESPUÉS de esta cuota. */
  saldoVivo: Centimos
}

export class ErrorPrestamo extends Error {}

/** El tipo mensual a partir del nominal anual. */
function tipoMensual(tinAnual: number): number {
  if (!Number.isFinite(tinAnual) || tinAnual < 0) {
    throw new ErrorPrestamo('El tipo de interés no puede ser negativo.')
  }
  return tinAnual / 100 / 12
}

function comprobar(prestamo: Prestamo): void {
  comprobarCentimos(prestamo.principal)
  if (prestamo.principal <= 0) throw new ErrorPrestamo('El principal tiene que ser mayor que cero.')
  if (!Number.isInteger(prestamo.meses) || prestamo.meses <= 0) {
    throw new ErrorPrestamo('El plazo tiene que ser un número entero de meses.')
  }
  if (prestamo.meses > 720) throw new ErrorPrestamo('Sesenta años de plazo no es un préstamo.')
}

/**
 * Cuota constante del sistema francés.
 *
 *     cuota = P · i · (1+i)^n / ((1+i)^n − 1)
 *
 * Con interés cero la fórmula se indefine y la cuota es el principal entre el
 * plazo, que es lo que corresponde: un préstamo familiar sin intereses es un
 * préstamo, no un caso raro.
 */
export function cuotaFrancesa(principal: Centimos, tinAnual: number, meses: number): Centimos {
  const i = tipoMensual(tinAnual)
  if (i === 0) return comprobarCentimos(Math.round(principal / meses))
  const factor = Math.pow(1 + i, meses)
  return comprobarCentimos(Math.round((principal * i * factor) / (factor - 1)))
}

export function generarCuadro(prestamo: Prestamo): Cuota[] {
  comprobar(prestamo)
  const sistema = prestamo.sistema ?? 'frances'
  const i = tipoMensual(prestamo.tinAnual)
  const primero = deISO(prestamo.primerPago)

  const cuotaFija = sistema === 'frances' ? cuotaFrancesa(prestamo.principal, prestamo.tinAnual, prestamo.meses) : 0
  const capitalConstante = sistema === 'aleman' ? Math.round(prestamo.principal / prestamo.meses) : 0

  const filas: Cuota[] = []
  let saldo = prestamo.principal

  for (let numero = 1; numero <= prestamo.meses; numero++) {
    const interes = Math.round(saldo * i)
    const ultima = numero === prestamo.meses

    let capital: number
    if (ultima) {
      // La última se lleva lo que quede, venga de donde venga el redondeo.
      capital = saldo
    } else if (sistema === 'frances') {
      capital = cuotaFija - interes
    } else if (sistema === 'aleman') {
      capital = capitalConstante
    } else {
      // Americano: solo intereses hasta el final.
      capital = 0
    }

    saldo -= capital
    filas.push({
      numero,
      fecha: aISO(sumarMeses(primero, numero - 1)),
      cuota: comprobarCentimos(capital + interes),
      interes: comprobarCentimos(interes),
      capital: comprobarCentimos(capital),
      saldoVivo: comprobarCentimos(saldo),
    })
  }
  return filas
}

export interface ResumenCuadro {
  cuotas: number
  totalPagado: Centimos
  totalIntereses: Centimos
  /** Cuánto se paga por cada euro prestado. 1,52 = pagas un 52 % de más. */
  porCadaEuro: number
  ultimaFecha: FechaISO | null
}

export function resumirCuadro(cuadro: Cuota[], principal: Centimos): ResumenCuadro {
  const totalPagado = cuadro.reduce((total, c) => total + c.cuota, 0)
  const totalIntereses = cuadro.reduce((total, c) => total + c.interes, 0)
  return {
    cuotas: cuadro.length,
    totalPagado: comprobarCentimos(totalPagado),
    totalIntereses: comprobarCentimos(totalIntereses),
    porCadaEuro: principal > 0 ? totalPagado / principal : 0,
    ultimaFecha: cuadro[cuadro.length - 1]?.fecha ?? null,
  }
}

/**
 * TAE a partir del TIN, con capitalización mensual.
 *
 *     TAE = (1 + TIN/12)^12 − 1
 *
 * Es la conversión pura, **sin comisiones ni seguros**. La TAE que exige la
 * ley los incluye, así que este número es el suelo, no la TAE del contrato: se
 * dice en la pantalla en vez de dejar creer que son lo mismo.
 */
export function taeDesdeTin(tinAnual: number, pagosPorAnio = 12): number {
  const i = tinAnual / 100 / pagosPorAnio
  return (Math.pow(1 + i, pagosPorAnio) - 1) * 100
}

export function tinDesdeTae(taeAnual: number, pagosPorAnio = 12): number {
  return (Math.pow(1 + taeAnual / 100, 1 / pagosPorAnio) - 1) * pagosPorAnio * 100
}

// ────────────────────────────────────────────────── Amortización anticipada

export type ModoAmortizacion = 'reducir_plazo' | 'reducir_cuota'

export interface Anticipada {
  /** Se amortiza justo después de pagar esta cuota (0 = antes de la primera). */
  trasCuota: number
  importe: Centimos
  modo: ModoAmortizacion
  /** Comisión de amortización anticipada en tanto por ciento del importe. */
  comisionPorcentaje?: number
}

export interface ResultadoAnticipada {
  cuadro: Cuota[]
  comision: Centimos
  interesAhorrado: Centimos
  /** Lo que de verdad se ahorra: el interés menos la comisión. */
  ahorroNeto: Centimos
  cuotasAhorradas: number
  nuevaCuota: Centimos
  ultimaFecha: FechaISO | null
  /** El importe liquida el préstamo entero. */
  liquidaLaDeuda: boolean
}

/**
 * Amortizar antes de tiempo, en cualquiera de las dos formas.
 *
 * **La comisión se resta del ahorro.** Un simulador que enseña «te ahorras
 * 8.400 €» y esconde los 500 € de comisión está vendiendo, no informando.
 */
export function amortizarAnticipado(prestamo: Prestamo, anticipada: Anticipada): ResultadoAnticipada {
  const original = generarCuadro(prestamo)
  const corte = Math.max(0, Math.min(anticipada.trasCuota, original.length))
  const pagadas = original.slice(0, corte)
  const saldo = corte === 0 ? prestamo.principal : pagadas[pagadas.length - 1]!.saldoVivo

  const comision = comprobarCentimos(
    Math.round((anticipada.importe * (anticipada.comisionPorcentaje ?? 0)) / 100),
  )
  const interesesOriginales = original.slice(corte).reduce((t, c) => t + c.interes, 0)

  if (anticipada.importe >= saldo) {
    // Se liquida entera: no hay cuadro nuevo que enseñar más allá de lo pagado.
    return {
      cuadro: pagadas,
      comision,
      interesAhorrado: comprobarCentimos(interesesOriginales),
      ahorroNeto: comprobarCentimos(interesesOriginales - comision),
      cuotasAhorradas: original.length - corte,
      nuevaCuota: 0,
      ultimaFecha: pagadas[pagadas.length - 1]?.fecha ?? null,
      liquidaLaDeuda: true,
    }
  }

  const nuevoSaldo = saldo - anticipada.importe
  const mesesRestantes = prestamo.meses - corte
  const siguientePago = aISO(sumarMeses(deISO(prestamo.primerPago), corte))

  const resto = generarCuadro({
    principal: nuevoSaldo,
    tinAnual: prestamo.tinAnual,
    sistema: prestamo.sistema ?? 'frances',
    primerPago: siguientePago,
    meses:
      anticipada.modo === 'reducir_cuota'
        ? mesesRestantes
        : // Reducir plazo: se mantiene la cuota y se recalcula cuántos meses
          // hacen falta para llegar a cero con ella.
          mesesParaCuota(nuevoSaldo, prestamo.tinAnual, cuotaDe(original, corte)),
  })

  const cuadro = [
    ...pagadas,
    ...resto.map((fila) => ({ ...fila, numero: fila.numero + corte })),
  ]
  const interesesNuevos = resto.reduce((t, c) => t + c.interes, 0)
  const interesAhorrado = comprobarCentimos(interesesOriginales - interesesNuevos)

  return {
    cuadro,
    comision,
    interesAhorrado,
    ahorroNeto: comprobarCentimos(interesAhorrado - comision),
    cuotasAhorradas: original.length - cuadro.length,
    nuevaCuota: resto[0]?.cuota ?? 0,
    ultimaFecha: cuadro[cuadro.length - 1]?.fecha ?? null,
    liquidaLaDeuda: false,
  }
}

/** La cuota vigente tras `corte` recibos (la primera del cuadro si no se ha
 *  pagado ninguno). En francés son todas iguales; en alemán no. */
function cuotaDe(cuadro: Cuota[], corte: number): Centimos {
  return cuadro[Math.min(corte, cuadro.length - 1)]?.cuota ?? 0
}

/**
 * Cuántos meses hacen falta para liquidar un saldo con una cuota dada.
 *
 *     n = −ln(1 − saldo·i/cuota) / ln(1+i)
 *
 * Si la cuota no cubre ni los intereses del primer mes, la deuda **crece**: el
 * logaritmo se indefine y aquí se lanza un error en vez de devolver `NaN` y
 * dejar que se convierta en un cuadro imposible más abajo.
 */
export function mesesParaCuota(saldo: Centimos, tinAnual: number, cuota: Centimos): number {
  const i = tipoMensual(tinAnual)
  if (cuota <= 0) throw new ErrorPrestamo('La cuota tiene que ser mayor que cero.')
  if (i === 0) return Math.ceil(saldo / cuota)
  if (cuota <= saldo * i) {
    throw new ErrorPrestamo('Con esa cuota no se cubren ni los intereses: la deuda nunca se liquida.')
  }
  return Math.ceil(-Math.log(1 - (saldo * i) / cuota) / Math.log(1 + i))
}

/**
 * El cuadro con **varias** amortizaciones anticipadas aplicadas en orden.
 *
 * Cada una se calcula sobre el préstamo tal como queda tras la anterior: es la
 * única forma de que el saldo, el plazo y los intereses cuadren cuando se
 * amortiza más de una vez, que es lo normal en una hipoteca larga.
 */
export function cuadroConAmortizaciones(
  prestamo: Prestamo,
  extras: { trasCuota: number; importe: Centimos; modo: ModoAmortizacion; comisionPorcentaje?: number }[],
): Cuota[] {
  const ordenadas = [...extras].sort((a, b) => a.trasCuota - b.trasCuota)
  const filas: Cuota[] = []
  let actual = prestamo
  let desplazamiento = 0

  for (const extra of ordenadas) {
    const corte = extra.trasCuota - desplazamiento
    if (corte < 0 || corte > actual.meses) continue

    const resultado = amortizarAnticipado(actual, { ...extra, trasCuota: corte })
    filas.push(...resultado.cuadro.slice(0, corte))
    if (resultado.liquidaLaDeuda) return renumerar(filas)

    const saldoAntes = corte === 0 ? actual.principal : resultado.cuadro[corte - 1]!.saldoVivo
    const resto = resultado.cuadro.slice(corte)
    actual = {
      principal: saldoAntes - extra.importe,
      tinAnual: actual.tinAnual,
      sistema: actual.sistema ?? 'frances',
      meses: resto.length,
      primerPago: resto[0]!.fecha,
    }
    desplazamiento = extra.trasCuota
  }

  filas.push(...generarCuadro(actual))
  return renumerar(filas)
}

function renumerar(filas: Cuota[]): Cuota[] {
  return filas.map((fila, i) => ({ ...fila, numero: i + 1 }))
}

/** Las dos opciones, calculadas y puestas una al lado de la otra. Es la
 *  comparación que el usuario necesita ver antes de decidir. */
export function compararAmortizacion(
  prestamo: Prestamo,
  opciones: { trasCuota: number; importe: Centimos; comisionPorcentaje?: number },
): { reducirPlazo: ResultadoAnticipada; reducirCuota: ResultadoAnticipada } {
  return {
    reducirPlazo: amortizarAnticipado(prestamo, { ...opciones, modo: 'reducir_plazo' }),
    reducirCuota: amortizarAnticipado(prestamo, { ...opciones, modo: 'reducir_cuota' }),
  }
}

// ──────────────────────────────────────────── Orden de pago de varias deudas

export type Estrategia = 'avalancha' | 'bola_de_nieve'

export interface DeudaEnPlan {
  id: string
  nombre: string
  saldo: Centimos
  tinAnual: number
  cuotaMinima: Centimos
}

export interface PlanDePago {
  estrategia: Estrategia
  /** `null` cuando con esos mínimos la deuda no se acaba nunca. */
  meses: number | null
  interesTotal: Centimos
  pagadoTotal: Centimos
  /** En qué mes queda liquidada cada deuda, en el orden en que ocurre. */
  liquidaciones: { id: string; nombre: string; mes: number }[]
}

/** Tope de simulación: cincuenta años. Más allá, la respuesta honesta no es un
 *  número grande, es «esto no se acaba». */
const TOPE_MESES = 600

/**
 * Simula pagar varias deudas a la vez con un extra mensual.
 *
 * **Avalancha** ataca primero el tipo más alto: es la que menos interés paga.
 * **Bola de nieve** ataca el saldo más pequeño: paga algo más, pero liquida
 * deudas antes y eso sostiene la constancia de mucha gente. La app calcula las
 * dos y enseña la diferencia en euros; la elección es del usuario.
 */
export function planDePago(
  deudas: DeudaEnPlan[],
  extraMensual: Centimos,
  estrategia: Estrategia,
): PlanDePago {
  const activas = deudas
    .filter((d) => d.saldo > 0)
    .map((d) => ({ ...d, saldo: d.saldo }))
    .sort((a, b) =>
      estrategia === 'avalancha' ? b.tinAnual - a.tinAnual || a.saldo - b.saldo : a.saldo - b.saldo || b.tinAnual - a.tinAnual,
    )

  const liquidaciones: PlanDePago['liquidaciones'] = []
  let interesTotal = 0
  let pagadoTotal = 0
  let mes = 0

  while (activas.some((d) => d.saldo > 0) && mes < TOPE_MESES) {
    mes++
    const saldoAlEmpezar = activas.reduce((total, d) => total + d.saldo, 0)

    // 1) Se devengan los intereses del mes.
    for (const deuda of activas) {
      if (deuda.saldo <= 0) continue
      const interes = Math.round(deuda.saldo * (deuda.tinAnual / 100 / 12))
      deuda.saldo += interes
      interesTotal += interes
    }

    // 2) Cada deuda paga su mínimo. El mínimo de las ya liquidadas no
    //    desaparece: se suma al extra. Es lo que hace que el método acelere
    //    solo según avanza, y de ahí el nombre de bola de nieve.
    let bolsa = extraMensual
    for (const deuda of activas) {
      if (deuda.saldo <= 0) {
        bolsa += deuda.cuotaMinima
        continue
      }
      const pago = Math.min(deuda.saldo, deuda.cuotaMinima)
      deuda.saldo -= pago
      pagadoTotal += pago
    }

    // 3) Todo lo que sobra va a la primera deuda de la lista que siga viva, y
    //    lo que sobre de esa, a la siguiente: el orden es la estrategia.
    for (const deuda of activas) {
      if (bolsa <= 0) break
      if (deuda.saldo <= 0) continue
      const pago = Math.min(deuda.saldo, bolsa)
      deuda.saldo -= pago
      bolsa -= pago
      pagadoTotal += pago
    }

    for (const deuda of activas) {
      if (deuda.saldo <= 0 && !liquidaciones.some((l) => l.id === deuda.id)) {
        deuda.saldo = 0
        liquidaciones.push({ id: deuda.id, nombre: deuda.nombre, mes })
      }
    }

    // Si en un mes entero la deuda total no ha bajado, no bajará nunca: los
    // mínimos no cubren ni los intereses. La respuesta honesta no es un número
    // grande, es «así esto no se acaba».
    if (activas.reduce((total, d) => total + d.saldo, 0) >= saldoAlEmpezar) {
      return { estrategia, meses: null, interesTotal, pagadoTotal, liquidaciones }
    }
  }

  return {
    estrategia,
    meses: activas.every((d) => d.saldo <= 0) ? mes : null,
    interesTotal: comprobarCentimos(interesTotal),
    pagadoTotal: comprobarCentimos(pagadoTotal),
    liquidaciones,
  }
}

/** Las dos estrategias, con la diferencia en euros y en meses ya calculada. */
export function compararEstrategias(deudas: DeudaEnPlan[], extraMensual: Centimos) {
  const avalancha = planDePago(deudas, extraMensual, 'avalancha')
  const bolaDeNieve = planDePago(deudas, extraMensual, 'bola_de_nieve')
  return {
    avalancha,
    bolaDeNieve,
    /** Lo que cuesta de más la bola de nieve. Cero o positivo salvo empate. */
    sobrecosteBolaDeNieve: comprobarCentimos(bolaDeNieve.interesTotal - avalancha.interesTotal),
    mesesDeDiferencia:
      avalancha.meses !== null && bolaDeNieve.meses !== null ? bolaDeNieve.meses - avalancha.meses : null,
  }
}
