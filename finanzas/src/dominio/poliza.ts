/**
 * Póliza de crédito (cuenta de crédito). **No tiene cuadro de amortización.**
 *
 * Funciona al revés que un préstamo: hay un límite concedido, se dispone y se
 * devuelve libremente, el banco liquida intereses cada periodo y al vencimiento
 * se renueva (o se cancela devolviendo lo dispuesto). Por eso no cabe en el
 * modelo de `Deuda`, que reparte un principal en cuotas.
 *
 * Se pagan **dos precios a la vez**, y esa es la clave del coste:
 *  · el tipo de interés sobre el capital **dispuesto**;
 *  · la comisión de disponibilidad sobre el capital **NO dispuesto** (se paga
 *    por tener el dinero reservado aunque no se use).
 *  · Y un tercero si se pasa del límite: la comisión de máximo excedido, que es
 *    mucho más cara y se cobra sobre el mayor exceso del periodo.
 *
 * **Lo que calcula este módulo es una ESTIMACIÓN.** El banco liquida sobre el
 * saldo medio diario y aquí solo se conoce el saldo de hoy, así que se supone
 * constante durante el periodo. Se dice en la pantalla; nunca se presenta como
 * la liquidación real.
 */
import { aCentimos, aEuros, redondear2 } from './dinero'
import type { CuentaTesoreria, MovimientoTesoreria, Poliza } from './tipos'

/** Umbral de consumo por defecto: pasado de ahí, la renovación se complica. */
export const UMBRAL_CONSUMO = 75

/** Año comercial: es la base con la que liquidan los bancos españoles. */
export const BASE_DIAS = 360

const MESES_POR_PERIODO = { MENSUAL: 1, TRIMESTRAL: 3, SEMESTRAL: 6, ANUAL: 12 } as const

function sumarMeses(iso: string, meses: number): string {
  const d = new Date(iso + 'T00:00:00')
  const dia = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + meses)
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(dia, ultimo))
  return d.toISOString().slice(0, 10)
}

function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00') - Date.parse(a + 'T00:00:00')) / 86_400_000)
}

export interface SituacionPoliza {
  limite: number
  dispuesto: number
  /** Saldo con el que el banco calcula el disponible. */
  saldoContable: number
  disponible: number
  excedido: number
  /** Porcentaje del límite consumido. */
  porcentajeDispuesto: number
}

/**
 * Situación de la póliza hoy.
 * **El disponible se calcula sobre el saldo contable, no sobre el dispuesto**:
 * es lo que hace el banco, y los dos saldos no coinciden mientras hay apuntes
 * con fecha valor pendiente. Sin saldo contable se usa el dispuesto y la
 * pantalla lo advierte.
 */
export function situacionPoliza(p: Poliza): SituacionPoliza {
  const limite = p.limiteActual || p.limiteConcedido
  const saldoContable = p.saldoContable ?? p.dispuesto
  const disponible = aEuros(aCentimos(limite) - aCentimos(saldoContable))
  return {
    limite,
    dispuesto: p.dispuesto,
    saldoContable,
    disponible: Math.max(0, disponible),
    excedido: p.importeExcedido ?? Math.max(0, aEuros(aCentimos(saldoContable) - aCentimos(limite))),
    porcentajeDispuesto: limite > 0 ? redondear2((p.dispuesto / limite) * 100) : 0,
  }
}

// ───────────── La póliza en cuenta corriente: lo dispuesto es el descubierto ─────────────

/**
 * Saldo de la cuenta en una fecha (incluido ese día).
 * Se replica aquí, en vez de usar `saldoCuenta`, porque hace falta a una fecha
 * concreta para poder recorrer el año día a día.
 */
export function saldoEnFecha(cuenta: CuentaTesoreria, movimientos: MovimientoTesoreria[], fecha: string): number {
  let cent = aCentimos(cuenta.saldoInicial)
  for (const m of movimientos) {
    if (m.cuentaId !== cuenta.id || m.anuladoEn) continue
    if (m.fecha > fecha) continue
    cent += aCentimos(m.importe)
  }
  return aEuros(cent)
}

/**
 * Capital dispuesto de una póliza instrumentada en cuenta: **el saldo negativo
 * de la cuenta**. Con la cuenta en positivo, la póliza no está dispuesta.
 */
export function dispuestoDeCuenta(cuenta: CuentaTesoreria, movimientos: MovimientoTesoreria[], fecha: string): number {
  const saldo = saldoEnFecha(cuenta, movimientos, fecha)
  return saldo < 0 ? aEuros(-aCentimos(saldo)) : 0
}

export interface ConsumoPeriodo {
  /** Media del saldo dispuesto ponderada por días, que es como la mira el banco. */
  medio: number
  /** Punto más alto de consumo del periodo. */
  maximo: number
  /** % que representa la media sobre el límite. */
  porcentajeMedio: number
  dias: number
}

/**
 * Consumo medio y máximo entre dos fechas, **ponderado por días**: un pico de
 * un día no pesa lo mismo que dos meses al límite, y el banco mira la media.
 * Se recorre el periodo saltando de movimiento en movimiento.
 */
export function consumoMedio(
  cuenta: CuentaTesoreria,
  movimientos: MovimientoTesoreria[],
  desde: string,
  hasta: string,
  limite: number,
): ConsumoPeriodo {
  const dias = Math.max(1, Math.round((Date.parse(hasta + 'T00:00:00') - Date.parse(desde + 'T00:00:00')) / 86_400_000) + 1)

  // Fechas en las que el saldo cambia, dentro del periodo.
  const cortes = [
    ...new Set(
      movimientos
        .filter((m) => m.cuentaId === cuenta.id && !m.anuladoEn && m.fecha > desde && m.fecha <= hasta)
        .map((m) => m.fecha),
    ),
  ].sort()

  let acumulado = 0
  let maximo = 0
  let tramoDesde = desde
  for (const corte of [...cortes, undefined]) {
    const dispuesto = dispuestoDeCuenta(cuenta, movimientos, tramoDesde)
    const tramoHasta = corte ? corte : hasta
    const diasTramo = Math.max(
      corte ? 0 : 1,
      Math.round((Date.parse(tramoHasta + 'T00:00:00') - Date.parse(tramoDesde + 'T00:00:00')) / 86_400_000) + (corte ? 0 : 1),
    )
    acumulado += aCentimos(dispuesto) * diasTramo
    if (dispuesto > maximo) maximo = dispuesto
    if (corte) tramoDesde = corte
  }

  const medio = aEuros(Math.round(acumulado / dias))
  return { medio, maximo, porcentajeMedio: limite > 0 ? redondear2((medio / limite) * 100) : 0, dias }
}

export interface LiquidacionEstimada {
  fecha: string
  dias: number
  intereses: number
  comisionDisponibilidad: number
  comisionExcedido: number
  total: number
}

/**
 * Estimación de una liquidación de `dias` días con los saldos actuales.
 * Base 360 y saldo constante: es una aproximación, no la liquidación del banco.
 */
export function estimarLiquidacion(p: Poliza, dias: number, fecha: string): LiquidacionEstimada {
  const s = situacionPoliza(p)
  const noDispuesto = Math.max(0, aEuros(aCentimos(s.limite) - aCentimos(s.dispuesto)))
  const prorrata = (importe: number, pct: number) => aEuros(Math.round((aCentimos(importe) * pct * dias) / (100 * BASE_DIAS)))

  const intereses = prorrata(s.dispuesto, p.tipoInteresDispuesto)
  const comisionDisponibilidad = prorrata(noDispuesto, p.comisionDisponibilidad)
  // La comisión de excedido no se prorratea: es un % sobre el mayor exceso del
  // periodo, y se cobra entero en la liquidación en que se produce.
  const comisionExcedido = s.excedido > 0 && p.comisionExcedido ? aEuros(Math.round((aCentimos(s.excedido) * p.comisionExcedido) / 100)) : 0

  return {
    fecha,
    dias,
    intereses,
    comisionDisponibilidad,
    comisionExcedido,
    total: aEuros(aCentimos(intereses) + aCentimos(comisionDisponibilidad) + aCentimos(comisionExcedido)),
  }
}

/**
 * Fechas de liquidación previstas dentro del ejercicio, a partir de la próxima
 * que dice el banco (o de la última, avanzando un periodo). No se pasa del
 * vencimiento de la póliza.
 */
export function fechasLiquidacion(p: Poliza, ejercicio: number): string[] {
  const paso = MESES_POR_PERIODO[p.periodicidadLiquidacion]
  // Si el banco no dice cuándo toca la próxima, se cuenta desde la anterior y,
  // en último término, desde la constitución: el calendario sale del propio
  // contrato, no de una fecha inventada.
  const arranque =
    p.fechaProximaLiquidacion ??
    (p.fechaUltimaLiquidacion ? sumarMeses(p.fechaUltimaLiquidacion, paso) : undefined) ??
    (p.fechaConstitucion ? sumarMeses(p.fechaConstitucion, paso) : undefined)
  if (!arranque) return []

  const fechas: string[] = []
  // Se retrocede hasta el principio del ejercicio para no perder las
  // liquidaciones ya practicadas de este año, y luego se avanza.
  let f = arranque
  while (Number(f.slice(0, 4)) >= ejercicio && fechas.length < 240) {
    const anterior = sumarMeses(f, -paso)
    if (Number(anterior.slice(0, 4)) < ejercicio) break
    f = anterior
  }
  while (Number(f.slice(0, 4)) <= ejercicio && fechas.length < 240) {
    if (Number(f.slice(0, 4)) === ejercicio && (!p.fechaVencimiento || f <= p.fechaVencimiento)) fechas.push(f)
    f = sumarMeses(f, paso)
  }
  return fechas
}

export interface LineaPolizaPresupuesto {
  polizaId: string
  concepto: string
  /** Intereses y comisiones estimados por mes: entran como GASTO. */
  meses: number[]
  totalAnual: number
  /** Devolución del dispuesto al vencimiento, si no se prevé renovar. */
  mesesDevolucion?: number[]
  fechaVencimiento?: string
}

/**
 * Coste estimado de las pólizas repartido por meses, para llevarlo al
 * presupuesto. Si la póliza NO se renueva, se añade aparte la devolución del
 * capital dispuesto en el mes del vencimiento: eso no es gasto, es financiación.
 */
export function costePolizasPorMes(polizas: Poliza[], ejercicio: number): LineaPolizaPresupuesto[] {
  const lineas: LineaPolizaPresupuesto[] = []

  for (const p of polizas) {
    if (p.anuladoEn) continue
    const paso = MESES_POR_PERIODO[p.periodicidadLiquidacion]
    const meses = Array(12).fill(0) as number[]

    for (const fecha of fechasLiquidacion(p, ejercicio)) {
      const dias = Math.max(1, diasEntre(sumarMeses(fecha, -paso), fecha))
      const liq = estimarLiquidacion(p, dias, fecha)
      const m = Number(fecha.slice(5, 7)) - 1
      meses[m] = aEuros(aCentimos(meses[m]) + aCentimos(liq.total))
    }

    let mesesDevolucion: number[] | undefined
    if (!p.seRenueva && p.fechaVencimiento && Number(p.fechaVencimiento.slice(0, 4)) === ejercicio && p.dispuesto > 0) {
      mesesDevolucion = Array(12).fill(0)
      mesesDevolucion[Number(p.fechaVencimiento.slice(5, 7)) - 1] = p.dispuesto
    }

    if (!meses.some((m) => m !== 0) && !mesesDevolucion) continue
    lineas.push({
      polizaId: p.id,
      concepto: [p.entidad, p.numeroContrato].filter(Boolean).join(' · ') || 'Póliza de crédito',
      meses,
      totalAnual: aEuros(meses.reduce((s, m) => s + aCentimos(m), 0)),
      mesesDevolucion,
      fechaVencimiento: p.fechaVencimiento,
    })
  }

  return lineas.sort((a, b) => b.totalAnual - a.totalAnual)
}

/**
 * Póliza con el dispuesto tomado de su cuenta, cuando así se ha configurado.
 * Devuelve la misma póliza si se lleva a mano o si la cuenta no existe: nunca
 * se pone un 0 por no encontrarla.
 */
export function polizaConCuenta(
  p: Poliza,
  cuentas: CuentaTesoreria[],
  movimientos: MovimientoTesoreria[],
  hoy: string,
): Poliza {
  if (p.origenDispuesto !== 'CUENTA' || !p.cuentaTesoreriaId) return p
  const cuenta = cuentas.find((c) => c.id === p.cuentaTesoreriaId && !c.anuladoEn)
  if (!cuenta) return p
  const dispuesto = dispuestoDeCuenta(cuenta, movimientos, hoy)
  // Con la cuenta como origen, dispuesto y contable son lo mismo: el saldo.
  return { ...p, dispuesto, saldoContable: dispuesto }
}

/** Avisos de la póliza: lo que hay que vigilar y cuesta dinero si se descuida. */
export function avisosPoliza(p: Poliza, hoy: string, consumo?: ConsumoPeriodo): string[] {
  const avisos: string[] = []
  const s = situacionPoliza(p)
  const umbral = p.umbralAviso ?? UMBRAL_CONSUMO

  if (s.excedido > 0) {
    avisos.push(
      `Excedida en ${s.excedido.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` +
        (p.comisionExcedido ? `: la comisión de máximo excedido es del ${p.comisionExcedido} %, muy por encima del interés normal.` : '.'),
    )
  } else if (s.porcentajeDispuesto >= umbral) {
    avisos.push(
      `Consumida al ${s.porcentajeDispuesto.toFixed(1)} % del límite, por encima del ${umbral} % que te has marcado: ` +
        'queda poco margen y el saldo medio del año sube.',
    )
  }

  // La renovación se juega con la media del año, no con la foto de hoy.
  if (consumo && consumo.porcentajeMedio > umbral) {
    avisos.push(
      `El consumo MEDIO del año va al ${consumo.porcentajeMedio.toFixed(1)} % (${consumo.medio.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €), ` +
        `por encima del ${umbral} %. Una póliza que vive dispuesta se renueva peor: el banco la lee como financiación estructural, no como tesorería puntual.`,
    )
  }

  if (p.fechaVencimiento) {
    const dias = diasEntre(hoy, p.fechaVencimiento)
    if (dias < 0) avisos.push(`La póliza venció el ${p.fechaVencimiento}. Confirma con el banco si está renovada.`)
    else if (dias <= 90) avisos.push(`Vence en ${dias} días (${p.fechaVencimiento}): la renovación se negocia con antelación.`)
  }

  if (p.saldoContable !== undefined && Math.abs(aCentimos(p.saldoContable) - aCentimos(p.dispuesto)) > 100) {
    avisos.push('El saldo dispuesto y el contable no coinciden: hay apuntes con fecha valor pendiente. El disponible sale del contable.')
  }

  if (p.comisionDisponibilidad > 0 && s.disponible > 0) {
    const anual = aEuros(Math.round((aCentimos(s.limite - p.dispuesto) * p.comisionDisponibilidad) / 100))
    avisos.push(`La parte no dispuesta también cuesta: unos ${anual.toLocaleString('es-ES', { minimumFractionDigits: 2 })} € al año de comisión de disponibilidad.`)
  }

  return avisos
}
