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
import type { Poliza } from './tipos'

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

/** Avisos de la póliza: lo que hay que vigilar y cuesta dinero si se descuida. */
export function avisosPoliza(p: Poliza, hoy: string): string[] {
  const avisos: string[] = []
  const s = situacionPoliza(p)

  if (s.excedido > 0) {
    avisos.push(
      `Excedida en ${s.excedido.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €` +
        (p.comisionExcedido ? `: la comisión de máximo excedido es del ${p.comisionExcedido} %, muy por encima del interés normal.` : '.'),
    )
  } else if (s.porcentajeDispuesto >= 90) {
    avisos.push(`Dispuesto el ${s.porcentajeDispuesto.toFixed(1)} % del límite: queda poco margen antes del excedido.`)
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
