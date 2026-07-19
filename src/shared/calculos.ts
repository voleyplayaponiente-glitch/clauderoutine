// Motor de cálculo laboral puro (sin React, sin SQLite): testeable de forma aislada.
import type { Centro, Trabajador, Turno } from './types'
import { horaAMinutos } from './fechas'

/**
 * Horas trabajadas en un día a partir de sus dos posibles tramos y el descanso.
 * horas = (salida1-entrada1) + (salida2-entrada2) - descanso.
 * Devuelve 0 si el día no computa como trabajado.
 */
export function horasDia(turno: Pick<
  Turno,
  'situacion' | 'entrada1' | 'salida1' | 'entrada2' | 'salida2' | 'descanso_min'
>): number {
  if (turno.situacion !== 'trabaja') return 0
  let minutos = 0
  minutos += tramoMinutos(turno.entrada1, turno.salida1)
  minutos += tramoMinutos(turno.entrada2, turno.salida2)
  minutos -= turno.descanso_min || 0
  if (minutos < 0) minutos = 0
  return Math.round((minutos / 60) * 100) / 100
}

function tramoMinutos(entrada: string | null, salida: string | null): number {
  const e = horaAMinutos(entrada)
  const s = horaAMinutos(salida)
  if (e === null || s === null) return 0
  // Turno que cruza medianoche: se suma un día.
  const dur = s >= e ? s - e : s + 24 * 60 - e
  return dur
}

/**
 * Media mensual de horas a trabajar.
 * = (horas anuales del convenio del centro × coeficiente de parcialidad) ÷ 12.
 * Es constante todos los meses porque la jornada se calcula sobre base anual.
 */
export function mediaMensual(horasAnualesConvenio: number, coefParcialidad: number): number {
  return Math.round(((horasAnualesConvenio * coefParcialidad) / 12) * 100) / 100
}

/** Sueldo prorrateado = sueldo jornada completa × coeficiente de parcialidad. */
export function sueldoProrrateado(sueldoCompleto: number, coefParcialidad: number): number {
  return Math.round(sueldoCompleto * coefParcialidad * 100) / 100
}

/** Horas contratadas equivalentes a un mes (aprox. 52 semanas / 12). */
export function horasContratadasMes(horasSemanales: number): number {
  return Math.round(((horasSemanales * 52) / 12) * 100) / 100
}

/**
 * Horas complementarias del mes = horas realizadas − horas de la jornada contratada.
 * Solo aplica a contratos por cuenta ajena a tiempo parcial. Nunca negativo.
 */
export function horasComplementarias(
  horasRealizadas: number,
  horasContratadasDelMes: number
): number {
  const c = horasRealizadas - horasContratadasDelMes
  return c > 0 ? Math.round(c * 100) / 100 : 0
}

/** Valoración económica de las horas complementarias. */
export function valorComplementarias(horasComp: number, precioHora: number): number {
  return Math.round(horasComp * precioHora * 100) / 100
}

/** Vacaciones pendientes = días anuales − días disfrutados. */
export function vacacionesPendientes(anuales: number, disfrutadas: number): number {
  return Math.max(0, anuales - disfrutadas)
}

export interface ResumenMesTrabajador {
  horasRealizadas: number
  horasPorCentro: Record<number, number> // centro_id → horas
  diasTrabajados: number
  diasVacaciones: number
  diasBaja: number
  diasPermiso: number
  diasFestivo: number
  diasLibre: number
  mediaMensualTeorica: number
  horasContratadasMes: number
  desviacionVsMedia: number // realizadas − media
  desviacionVsContrato: number // realizadas − contratadas
  horasComplementarias: number
  valorComplementarias: number
}

/** Resumen mensual completo de un trabajador a partir de sus turnos. */
export function resumenMesTrabajador(
  trabajador: Pick<
    Trabajador,
    | 'tipo'
    | 'coef_parcialidad'
    | 'horas_contrato_semanales'
    | 'horas_convenio_completa'
    | 'precio_hora_complementaria'
  >,
  turnos: Turno[]
): ResumenMesTrabajador {
  const horasPorCentro: Record<number, number> = {}
  let horasRealizadas = 0
  let diasTrabajados = 0
  let diasVacaciones = 0
  let diasBaja = 0
  let diasPermiso = 0
  let diasFestivo = 0
  let diasLibre = 0

  for (const t of turnos) {
    switch (t.situacion) {
      case 'trabaja': {
        const h = horasDia(t)
        horasRealizadas += h
        if (t.centro_id != null) {
          horasPorCentro[t.centro_id] = (horasPorCentro[t.centro_id] || 0) + h
        }
        if (h > 0) diasTrabajados++
        break
      }
      case 'vacaciones':
        diasVacaciones++
        break
      case 'baja':
        diasBaja++
        break
      case 'permiso':
        diasPermiso++
        break
      case 'festivo':
        diasFestivo++
        break
      case 'libre':
        diasLibre++
        break
    }
  }

  horasRealizadas = Math.round(horasRealizadas * 100) / 100
  for (const k of Object.keys(horasPorCentro)) {
    horasPorCentro[+k] = Math.round(horasPorCentro[+k] * 100) / 100
  }

  // La media mensual se calcula con las horas anuales de convenio DEL TRABAJADOR
  // (× coeficiente ÷ 12), para que coincida con su contrato de tiempo parcial.
  const media = mediaMensual(trabajador.horas_convenio_completa, trabajador.coef_parcialidad)
  const contratadas = horasContratadasMes(trabajador.horas_contrato_semanales)
  const esAutonomo = trabajador.tipo === 'autonomo'
  const comp = esAutonomo ? 0 : horasComplementarias(horasRealizadas, contratadas)

  return {
    horasRealizadas,
    horasPorCentro,
    diasTrabajados,
    diasVacaciones,
    diasBaja,
    diasPermiso,
    diasFestivo,
    diasLibre,
    mediaMensualTeorica: media,
    horasContratadasMes: contratadas,
    desviacionVsMedia: Math.round((horasRealizadas - media) * 100) / 100,
    desviacionVsContrato: Math.round((horasRealizadas - contratadas) * 100) / 100,
    horasComplementarias: comp,
    valorComplementarias: valorComplementarias(comp, trabajador.precio_hora_complementaria)
  }
}

/** Total de horas de un centro en un mes: suma de horas de todos los turnos de ese centro. */
export function horasCentroMes(centroId: number, turnos: Turno[]): number {
  let h = 0
  for (const t of turnos) {
    if (t.situacion === 'trabaja' && t.centro_id === centroId) h += horasDia(t)
  }
  return Math.round(h * 100) / 100
}

export interface HorarioDia {
  abre: boolean
  apertura: string
  cierre: string
}

type CentroHorario = Pick<
  Centro,
  | 'abre_lunes_sabado'
  | 'hora_apertura_ls'
  | 'hora_cierre_ls'
  | 'abre_domingos'
  | 'hora_apertura_dom'
  | 'hora_cierre_dom'
  | 'abre_festivos'
  | 'hora_apertura_fes'
  | 'hora_cierre_fes'
>

/**
 * Horario aplicable a un día concreto según su tipo. Prioridad: festivo > domingo >
 * lunes-a-sábado. (diaSemana: 0=domingo … 6=sábado)
 */
export function horarioCentroDia(
  centro: CentroHorario,
  diaSemana: number,
  esFestivo: boolean
): HorarioDia {
  if (esFestivo) {
    return { abre: centro.abre_festivos === 1, apertura: centro.hora_apertura_fes, cierre: centro.hora_cierre_fes }
  }
  if (diaSemana === 0) {
    return { abre: centro.abre_domingos === 1, apertura: centro.hora_apertura_dom, cierre: centro.hora_cierre_dom }
  }
  return { abre: centro.abre_lunes_sabado === 1, apertura: centro.hora_apertura_ls, cierre: centro.hora_cierre_ls }
}

const r2 = (n: number): number => Math.round(n * 100) / 100

/** Nº de pagas extra al año que se prorratean en la mensualidad. */
export const NUM_PAGAS_EXTRA = 3

/**
 * Tipos de cotización a cargo del TRABAJADOR (% sobre la base de cotización).
 * Orientativos, según los tipos generales vigentes; revisar cada año.
 */
export const COTIZACION_TRABAJADOR = {
  contingenciasComunes: 4.7,
  desempleoIndefinido: 1.55,
  desempleoTemporal: 1.6,
  formacionProfesional: 0.1,
  mei: 0.15 // Mecanismo de Equidad Intergeneracional (2026)
}

export interface DetalleRetribucion {
  prorrateoPagas: number // prorrateo mensual de las pagas extra (base × 3 ÷ 12)
  totalDevengado: number // suma de todas las percepciones
  baseSujetaIrpf: number // percepciones sujetas a IRPF (sin la especie exenta)
  retencionIrpf: number // IRPF% × base sujeta
  // Cotización a la Seguridad Social a cargo del trabajador
  baseCotizacion: number
  cuotaContingencias: number
  cuotaDesempleo: number
  cuotaFormacion: number
  cuotaMei: number
  totalSeguridadSocial: number
  totalDeducciones: number // deducciones especie/salud + retención IRPF + cotización SS
  neto: number // total a percibir estimado
}

type TrabRetrib = Pick<
  Trabajador,
  | 'tipo'
  | 'tipo_contrato'
  | 'sueldo_convenio_completo'
  | 'plus_productividad'
  | 'plus_transporte'
  | 'retribucion_especie'
  | 'retribucion_especie_exenta'
  | 'deduccion_especie'
  | 'deduccion_seguro_salud'
  | 'irpf'
>

/**
 * Desglose de retribución mensual con retención de IRPF, cotización a la Seguridad
 * Social del trabajador (contingencias comunes, desempleo, FP y MEI) y neto estimado.
 * - Base sujeta a IRPF = salario base + plus + prorrateo + retribución en especie SUJETA.
 *   La especie exenta (seguro de salud) NO entra en la base de IRPF.
 * - Base de cotización ≈ base sujeta (aprox., sin topes máximo/mínimo por grupo).
 * - Autónomo: no se le practican cotizaciones de cuenta ajena (cotiza por su cuenta).
 * Estimación orientativa, no sustituye a la nómina oficial.
 */
export function calcRetribucion(t: TrabRetrib): DetalleRetribucion {
  const base = t.sueldo_convenio_completo || 0
  const plus = t.plus_productividad || 0
  const transp = t.plus_transporte || 0
  // Prorrateo mensual de las pagas extra, automático desde el salario base.
  const prorr = r2((base * NUM_PAGAS_EXTRA) / 12)
  const espSuj = t.retribucion_especie || 0
  const espExe = t.retribucion_especie_exenta || 0
  const dedEsp = t.deduccion_especie || 0
  const dedSalud = t.deduccion_seguro_salud || 0

  const totalDevengado = base + plus + transp + prorr + espSuj + espExe
  const baseSujetaIrpf = base + plus + transp + prorr + espSuj
  const retencionIrpf = r2(baseSujetaIrpf * ((t.irpf || 0) / 100))

  // Cotización a la Seguridad Social (solo cuenta ajena).
  const esAjena = t.tipo !== 'autonomo'
  const baseCotizacion = esAjena ? baseSujetaIrpf : 0
  const c = COTIZACION_TRABAJADOR
  const cuotaContingencias = r2(baseCotizacion * (c.contingenciasComunes / 100))
  const tasaDesempleo = t.tipo_contrato === 'temporal' ? c.desempleoTemporal : c.desempleoIndefinido
  const cuotaDesempleo = r2(baseCotizacion * (tasaDesempleo / 100))
  const cuotaFormacion = r2(baseCotizacion * (c.formacionProfesional / 100))
  const cuotaMei = r2(baseCotizacion * (c.mei / 100))
  const totalSeguridadSocial = r2(cuotaContingencias + cuotaDesempleo + cuotaFormacion + cuotaMei)

  const totalDeducciones = r2(dedEsp + dedSalud + retencionIrpf + totalSeguridadSocial)
  const neto = r2(totalDevengado - totalDeducciones)
  return {
    prorrateoPagas: prorr,
    totalDevengado: r2(totalDevengado),
    baseSujetaIrpf: r2(baseSujetaIrpf),
    baseCotizacion: r2(baseCotizacion),
    cuotaContingencias,
    cuotaDesempleo,
    cuotaFormacion,
    cuotaMei,
    totalSeguridadSocial,
    retencionIrpf,
    totalDeducciones,
    neto
  }
}
