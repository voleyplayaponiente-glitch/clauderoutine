// Motor de avisos laborales puro. Recibe los datos de un mes planificado y
// devuelve la lista de incidencias detectadas. Sin dependencias de UI ni BD.
import type { Centro, Trabajador, Turno } from './types'
import { horaAMinutos } from './fechas'
import {
  horarioCentroDia,
  horasContratadasMes,
  mediaMensual,
  resumenMesTrabajador
} from './calculos'
import { diaSemanaIso, diasEntre, hoyIso, isoALocal } from './fechas'

export type NivelAviso = 'error' | 'aviso' | 'info'

export interface Aviso {
  tipo: string
  nivel: NivelAviso
  mensaje: string
  fecha?: string // ISO, si el aviso es de un día concreto
}

const MIN_DESCANSO_ENTRE_JORNADAS = 12 * 60 // minutos
const MIN_DESCANSO_SEMANAL = 36 * 60 // minutos (día y medio)
const DIAS_AVISO_PERIODO_PRUEBA = 15

interface Span {
  diaIdx: number // índice del día dentro del mes (0-based)
  fecha: string
  inicio: number // minutos absolutos desde el inicio del mes
  fin: number
}

function spansDeTurnos(turnos: Turno[], anio: number, mes: number): Span[] {
  const primeroIso = `${anio}-${String(mes).padStart(2, '0')}-01`
  const spans: Span[] = []
  for (const t of turnos) {
    if (t.situacion !== 'trabaja') continue
    const diaIdx = diasEntre(primeroIso, t.fecha)
    for (const [e, s] of [
      [t.entrada1, t.salida1],
      [t.entrada2, t.salida2]
    ] as const) {
      const em = horaAMinutos(e)
      const sm = horaAMinutos(s)
      if (em === null || sm === null) continue
      const base = diaIdx * 1440
      const fin = sm >= em ? sm : sm + 1440 // cruza medianoche
      spans.push({ diaIdx, fecha: t.fecha, inicio: base + em, fin: base + fin })
    }
  }
  spans.sort((a, b) => a.inicio - b.inicio)
  return spans
}

/**
 * Calcula todos los avisos de un trabajador para un mes planificado.
 */
export function avisosMes(params: {
  trabajador: Trabajador
  turnos: Turno[]
  centrosPorId: Record<number, Centro>
  festivosPorFecha: Set<string> // fechas ISO festivas aplicables
  anio: number
  mes: number
}): Aviso[] {
  const { trabajador, turnos, centrosPorId, festivosPorFecha, anio, mes } = params
  const avisos: Aviso[] = []
  const esAutonomo = trabajador.tipo === 'autonomo'

  // Resumen de horas para comparativas. La media mensual se basa en las horas
  // anuales de convenio del propio trabajador (× coeficiente ÷ 12).
  const resumen = resumenMesTrabajador(trabajador, turnos)

  // 1) Supera horas de contrato o media mensual (solo cuenta ajena).
  if (!esAutonomo) {
    const contratadas = horasContratadasMes(trabajador.horas_contrato_semanales)
    const media = mediaMensual(trabajador.horas_convenio_completa, trabajador.coef_parcialidad)
    if (contratadas > 0 && resumen.horasRealizadas > contratadas + 0.01) {
      avisos.push({
        tipo: 'supera_contrato',
        nivel: 'aviso',
        mensaje: `Supera las horas de contrato del mes: ${resumen.horasRealizadas} h realizadas frente a ${contratadas} h contratadas.`
      })
    }
    if (media > 0 && resumen.horasRealizadas > media + 0.01) {
      avisos.push({
        tipo: 'supera_media',
        nivel: 'aviso',
        mensaje: `Supera la media mensual teórica: ${resumen.horasRealizadas} h frente a ${media} h de media.`
      })
    }
    // 2) Horas complementarias.
    if (resumen.horasComplementarias > 0) {
      avisos.push({
        tipo: 'complementarias',
        nivel: 'info',
        mensaje: `Se generan ${resumen.horasComplementarias} h complementarias (Art. 12.5 ET), valoradas en ${resumen.valorComplementarias} €.`
      })
    }
  }

  // 5) Turnos fuera del horario de apertura o en día cerrado.
  for (const t of turnos) {
    if (t.situacion !== 'trabaja' || t.centro_id == null) continue
    const centro = centrosPorId[t.centro_id]
    if (!centro) continue
    const dia = diaSemanaIso(t.fecha)
    const esFestivo = festivosPorFecha.has(t.fecha)
    const horario = horarioCentroDia(centro, dia, esFestivo)
    if (!horario.abre) {
      avisos.push({
        tipo: 'centro_cerrado',
        nivel: 'aviso',
        fecha: t.fecha,
        mensaje: `${isoALocal(t.fecha)}: turno en «${centro.nombre}», pero ese día el centro no abre.`
      })
      continue
    }
    const ap = horaAMinutos(horario.apertura)
    const ci = horaAMinutos(horario.cierre)
    for (const [e, s] of [
      [t.entrada1, t.salida1],
      [t.entrada2, t.salida2]
    ] as const) {
      const em = horaAMinutos(e)
      const sm = horaAMinutos(s)
      if (em === null || sm === null) continue
      if (ap !== null && ci !== null && (em < ap || sm > ci)) {
        avisos.push({
          tipo: 'fuera_apertura',
          nivel: 'aviso',
          fecha: t.fecha,
          mensaje: `${isoALocal(t.fecha)}: turno ${e}–${s} fuera del horario de apertura (${horario.apertura}–${horario.cierre}) de «${centro.nombre}».`
        })
      }
    }
  }

  // Validaciones de descanso solo para cuenta ajena.
  if (!esAutonomo) {
    const spans = spansDeTurnos(turnos, anio, mes)

    // 3) Descanso mínimo de 12 h entre jornadas (días distintos).
    for (let i = 1; i < spans.length; i++) {
      const prev = spans[i - 1]
      const cur = spans[i]
      if (cur.diaIdx === prev.diaIdx) continue // mismo día (turno partido): no aplica
      const descanso = cur.inicio - prev.fin
      if (descanso >= 0 && descanso < MIN_DESCANSO_ENTRE_JORNADAS) {
        avisos.push({
          tipo: 'descanso_12h',
          nivel: 'error',
          fecha: cur.fecha,
          mensaje: `${isoALocal(cur.fecha)}: descanso de solo ${(descanso / 60).toFixed(1)} h entre jornadas (mínimo legal 12 h).`
        })
      }
    }

    // 4) Descanso semanal de día y medio (36 h ininterrumpidas).
    avisos.push(...avisosDescansoSemanal(spans, anio, mes, turnos))
  }

  // 7) Solapamiento de tramos dentro del mismo día.
  for (const t of turnos) {
    if (t.situacion !== 'trabaja') continue
    const e1 = horaAMinutos(t.entrada1)
    const s1 = horaAMinutos(t.salida1)
    const e2 = horaAMinutos(t.entrada2)
    if (s1 !== null && e2 !== null && e2 < s1) {
      avisos.push({
        tipo: 'solapamiento',
        nivel: 'error',
        fecha: t.fecha,
        mensaje: `${isoALocal(t.fecha)}: los dos tramos del turno partido se solapan en el tiempo.`
      })
    }
    void e1
  }

  // 6) Fin de periodo de prueba próximo.
  if (trabajador.fecha_fin_periodo_prueba) {
    const dias = diasEntre(hoyIso(), trabajador.fecha_fin_periodo_prueba)
    if (dias >= 0 && dias <= DIAS_AVISO_PERIODO_PRUEBA) {
      avisos.push({
        tipo: 'periodo_prueba',
        nivel: 'info',
        mensaje: `El periodo de prueba finaliza el ${isoALocal(trabajador.fecha_fin_periodo_prueba)} (dentro de ${dias} día(s)).`
      })
    }
  }

  return avisos
}

/** Detecta semanas sin un descanso continuo de al menos 36 h. */
function avisosDescansoSemanal(
  spans: Span[],
  anio: number,
  mes: number,
  turnos: Turno[]
): Aviso[] {
  const out: Aviso[] = []
  const ndias = new Date(anio, mes, 0).getDate()
  const finMes = ndias * 1440

  // Huecos de descanso (entre spans y en los extremos del mes).
  const gaps: Array<{ inicio: number; fin: number }> = []
  let cursor = 0
  for (const s of spans) {
    if (s.inicio > cursor) gaps.push({ inicio: cursor, fin: s.inicio })
    cursor = Math.max(cursor, s.fin)
  }
  if (cursor < finMes) gaps.push({ inicio: cursor, fin: finMes })
  const gapsLargos = gaps.filter((g) => g.fin - g.inicio >= MIN_DESCANSO_SEMANAL)

  // Días con trabajo, para no avisar de semanas totalmente libres.
  const diasConTrabajo = new Set(spans.map((s) => s.diaIdx))

  // Ventanas de 7 días naturales.
  for (let inicioDia = 0; inicioDia < ndias; inicioDia += 7) {
    const finDia = Math.min(inicioDia + 7, ndias)
    let hayTrabajo = false
    for (let d = inicioDia; d < finDia; d++) if (diasConTrabajo.has(d)) hayTrabajo = true
    if (!hayTrabajo) continue

    const ini = inicioDia * 1440
    const fin = finDia * 1440
    const cubierta = gapsLargos.some((g) => g.inicio < fin && g.fin > ini)
    if (!cubierta) {
      const fechaIni = turnos.length
        ? `${anio}-${String(mes).padStart(2, '0')}-${String(inicioDia + 1).padStart(2, '0')}`
        : undefined
      out.push({
        tipo: 'descanso_semanal',
        nivel: 'error',
        fecha: fechaIni,
        mensaje: `Semana del ${String(inicioDia + 1).padStart(2, '0')}/${String(mes).padStart(2, '0')}: no se respeta el descanso semanal de día y medio (36 h ininterrumpidas).`
      })
    }
  }
  return out
}
