import { describe, it, expect } from 'vitest'
import {
  horasDia,
  mediaMensual,
  sueldoProrrateado,
  horasContratadasMes,
  horasComplementarias,
  valorComplementarias,
  vacacionesPendientes,
  resumenMesTrabajador,
  horasCentroMes,
  horarioCentroDia,
  calcRetribucion
} from './calculos'
import type { Turno, Trabajador } from './types'

const turnoBase = (p: Partial<Turno>): Turno => ({
  id: 1,
  cuadrante_id: 1,
  fecha: '2026-03-02',
  dia_semana: 1,
  situacion: 'trabaja',
  centro_id: 1,
  entrada1: '10:00',
  salida1: '14:00',
  entrada2: null,
  salida2: null,
  descanso_min: 0,
  ...p
})

describe('horasDia', () => {
  it('calcula un tramo simple', () => {
    expect(horasDia(turnoBase({ entrada1: '10:00', salida1: '18:00' }))).toBe(8)
  })
  it('descuenta el descanso', () => {
    expect(horasDia(turnoBase({ entrada1: '10:00', salida1: '18:00', descanso_min: 30 }))).toBe(7.5)
  })
  it('suma los dos tramos de un turno partido', () => {
    expect(
      horasDia(
        turnoBase({ entrada1: '10:00', salida1: '14:00', entrada2: '17:00', salida2: '21:00' })
      )
    ).toBe(8)
  })
  it('devuelve 0 si el día no es de trabajo', () => {
    expect(horasDia(turnoBase({ situacion: 'vacaciones' }))).toBe(0)
  })
  it('gestiona turno que cruza medianoche', () => {
    expect(horasDia(turnoBase({ entrada1: '22:00', salida1: '02:00' }))).toBe(4)
  })
})

describe('media mensual y sueldo', () => {
  it('media mensual = horas anuales × coef ÷ 12', () => {
    expect(mediaMensual(1768, 1)).toBeCloseTo(147.33, 2)
    expect(mediaMensual(1768, 0.5)).toBeCloseTo(73.67, 2)
  })
  it('sueldo prorrateado', () => {
    expect(sueldoProrrateado(1400, 0.75)).toBe(1050)
  })
})

describe('horas complementarias', () => {
  it('contratadas al mes aproximadas', () => {
    expect(horasContratadasMes(20)).toBeCloseTo(86.67, 2)
  })
  it('solo cuenta el exceso sobre lo contratado', () => {
    expect(horasComplementarias(100, 86.67)).toBeCloseTo(13.33, 2)
    expect(horasComplementarias(80, 86.67)).toBe(0)
  })
  it('valora las complementarias', () => {
    expect(valorComplementarias(10, 9.7)).toBe(97)
  })
})

describe('vacaciones', () => {
  it('pendientes = anuales - disfrutadas, nunca negativo', () => {
    expect(vacacionesPendientes(30, 12)).toBe(18)
    expect(vacacionesPendientes(30, 40)).toBe(0)
  })
})

describe('resumenMesTrabajador', () => {
  const trab = {
    tipo: 'ajena',
    coef_parcialidad: 0.5,
    horas_contrato_semanales: 20,
    precio_hora_complementaria: 9.7,
    horas_anuales_convenio: 1768
  } as unknown as Trabajador

  it('agrega horas, cuenta días y calcula desviaciones', () => {
    const turnos: Turno[] = [
      turnoBase({ id: 1, fecha: '2026-03-02', entrada1: '10:00', salida1: '18:00', centro_id: 1 }),
      turnoBase({ id: 2, fecha: '2026-03-03', entrada1: '10:00', salida1: '18:00', centro_id: 2 }),
      turnoBase({ id: 3, fecha: '2026-03-04', situacion: 'vacaciones', centro_id: null }),
      turnoBase({ id: 4, fecha: '2026-03-05', situacion: 'libre', centro_id: null })
    ]
    const r = resumenMesTrabajador(trab, 1768, turnos)
    expect(r.horasRealizadas).toBe(16)
    expect(r.horasPorCentro[1]).toBe(8)
    expect(r.horasPorCentro[2]).toBe(8)
    expect(r.diasTrabajados).toBe(2)
    expect(r.diasVacaciones).toBe(1)
    expect(r.diasLibre).toBe(1)
    expect(r.mediaMensualTeorica).toBeCloseTo(73.67, 2)
  })

  it('el autónomo no genera horas complementarias', () => {
    const auto = { ...trab, tipo: 'autonomo' } as unknown as Trabajador
    const turnos = Array.from({ length: 20 }, (_, i) =>
      turnoBase({ id: i, fecha: `2026-03-${String(i + 1).padStart(2, '0')}`, entrada1: '10:00', salida1: '20:00' })
    )
    const r = resumenMesTrabajador(auto, 1768, turnos)
    expect(r.horasComplementarias).toBe(0)
  })
})

describe('horasCentroMes', () => {
  it('suma solo los turnos del centro indicado', () => {
    const turnos: Turno[] = [
      turnoBase({ id: 1, entrada1: '10:00', salida1: '18:00', centro_id: 1 }),
      turnoBase({ id: 2, entrada1: '10:00', salida1: '14:00', centro_id: 2 }),
      turnoBase({ id: 3, entrada1: '10:00', salida1: '16:00', centro_id: 1 })
    ]
    expect(horasCentroMes(1, turnos)).toBe(14)
    expect(horasCentroMes(2, turnos)).toBe(4)
  })
})

describe('horarioCentroDia', () => {
  const centro = {
    abre_lunes_sabado: 1,
    hora_apertura_ls: '10:00',
    hora_cierre_ls: '22:00',
    abre_domingos: 0,
    hora_apertura_dom: '11:00',
    hora_cierre_dom: '15:00',
    abre_festivos: 1,
    hora_apertura_fes: '12:00',
    hora_cierre_fes: '20:00'
  }
  it('lunes a sábado usa su horario', () => {
    expect(horarioCentroDia(centro, 1, false)).toEqual({ abre: true, apertura: '10:00', cierre: '22:00' })
    expect(horarioCentroDia(centro, 6, false)).toEqual({ abre: true, apertura: '10:00', cierre: '22:00' })
  })
  it('domingo puede tener horario distinto y estar cerrado', () => {
    expect(horarioCentroDia(centro, 0, false)).toEqual({ abre: false, apertura: '11:00', cierre: '15:00' })
  })
  it('festivo tiene prioridad sobre el día de la semana', () => {
    expect(horarioCentroDia(centro, 1, true)).toEqual({ abre: true, apertura: '12:00', cierre: '20:00' })
  })
})

describe('calcRetribucion', () => {
  const t = {
    sueldo_convenio_completo: 1400,
    plus_productividad: 100,
    prorrateo_pagas_extras: 233.33,
    retribucion_especie: 50, // sujeta a IRPF
    retribucion_especie_exenta: 40, // seguro salud, exenta
    deduccion_especie: 50,
    deduccion_seguro_salud: 30,
    irpf: 15
  }
  it('devengado suma todas las percepciones', () => {
    expect(calcRetribucion(t).totalDevengado).toBeCloseTo(1823.33, 2)
  })
  it('la especie exenta no entra en la base de IRPF', () => {
    expect(calcRetribucion(t).baseSujetaIrpf).toBeCloseTo(1783.33, 2)
  })
  it('retención IRPF = IRPF% × base sujeta', () => {
    expect(calcRetribucion(t).retencionIrpf).toBeCloseTo(267.5, 2)
  })
  it('neto = devengado − deducciones − retención IRPF', () => {
    expect(calcRetribucion(t).neto).toBeCloseTo(1475.83, 2)
  })
})
