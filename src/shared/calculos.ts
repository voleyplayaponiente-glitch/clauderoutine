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
    'tipo' | 'coef_parcialidad' | 'horas_contrato_semanales' | 'precio_hora_complementaria'
  >,
  horasAnualesConvenioCentro: number,
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

  const media = mediaMensual(horasAnualesConvenioCentro, trabajador.coef_parcialidad)
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

/** ¿El centro abre ese día de la semana? (dia: 0=domingo … 6=sábado) */
export function centroAbreDia(
  centro: Pick<Centro, 'abre_laborables' | 'abre_sabados' | 'abre_domingos'>,
  diaSemana: number,
  esFestivo: boolean,
  abreFestivos: boolean
): boolean {
  if (esFestivo) return abreFestivos
  if (diaSemana === 0) return centro.abre_domingos === 1
  if (diaSemana === 6) return centro.abre_sabados === 1
  return centro.abre_laborables === 1
}
