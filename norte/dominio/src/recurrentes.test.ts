import { describe, expect, it } from 'vitest'
import { fechasDe, proximaFecha, type Regla } from './recurrentes.js'

const d = (iso: string) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))

describe('mensual', () => {
  const alquiler: Regla = { periodicidad: 'mensual', desde: '2026-01-01', diaDelMes: 1 }

  it('cae el mismo día cada mes', () => {
    expect(fechasDe(alquiler, d('2026-08-01'), d('2026-10-31'))).toEqual([
      '2026-08-01',
      '2026-09-01',
      '2026-10-01',
    ])
  })

  it('el día 31 no se salta febrero: se queda en el último día', () => {
    const regla: Regla = { periodicidad: 'mensual', desde: '2026-01-31', diaDelMes: 31 }
    expect(fechasDe(regla, d('2026-01-01'), d('2026-04-30'))).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ])
  })

  it('no empieza antes de la primera vez, aunque se pregunte por antes', () => {
    expect(fechasDe(alquiler, d('2025-06-01'), d('2026-02-28'))).toEqual([
      '2026-01-01',
      '2026-02-01',
    ])
  })

  it('deja de caer cuando la regla acaba', () => {
    const seguro: Regla = { periodicidad: 'mensual', desde: '2026-01-10', hasta: '2026-03-31', diaDelMes: 10 }
    expect(fechasDe(seguro, d('2026-01-01'), d('2026-12-31'))).toEqual([
      '2026-01-10',
      '2026-02-10',
      '2026-03-10',
    ])
  })
})

describe('último día hábil', () => {
  it('esquiva el fin de semana', () => {
    const nomina: Regla = { periodicidad: 'mensual', desde: '2026-08-01', ultimoDiaHabil: true }
    // Agosto de 2026 acaba en lunes y septiembre en miércoles: esos mismos.
    // Octubre acaba en sábado, así que la nómina cae el viernes 30.
    expect(fechasDe(nomina, d('2026-08-01'), d('2026-10-31'))).toEqual([
      '2026-08-31',
      '2026-09-30',
      '2026-10-30',
    ])
  })
})

describe('otras periodicidades', () => {
  it('semanal', () => {
    const regla: Regla = { periodicidad: 'semanal', desde: '2026-08-03' }
    expect(fechasDe(regla, d('2026-08-01'), d('2026-08-31'))).toEqual([
      '2026-08-03',
      '2026-08-10',
      '2026-08-17',
      '2026-08-24',
      '2026-08-31',
    ])
  })

  it('trimestral y anual', () => {
    expect(
      fechasDe({ periodicidad: 'trimestral', desde: '2026-01-15' }, d('2026-01-01'), d('2026-12-31')),
    ).toEqual(['2026-01-15', '2026-04-15', '2026-07-15', '2026-10-15'])

    expect(
      fechasDe({ periodicidad: 'anual', desde: '2026-06-01' }, d('2026-01-01'), d('2028-12-31')),
    ).toEqual(['2026-06-01', '2027-06-01', '2028-06-01'])
  })

  it('una regla vieja y semanal no da mil vueltas para nada', () => {
    // Diez años de reglas semanales: si fuera día a día, serían miles de saltos.
    const regla: Regla = { periodicidad: 'semanal', desde: '2016-01-04' }
    expect(fechasDe(regla, d('2026-08-17'), d('2026-08-31'))).toEqual([
      '2026-08-17',
      '2026-08-24',
      '2026-08-31',
    ])
  })
})

describe('la próxima vez', () => {
  it('dice cuándo toca a partir de hoy', () => {
    const luz: Regla = { periodicidad: 'bimestral', desde: '2026-01-05', diaDelMes: 5 }
    expect(proximaFecha(luz, d('2026-08-18'))).toBe('2026-09-05')
  })

  it('devuelve null si la regla ya terminó', () => {
    const acabada: Regla = { periodicidad: 'mensual', desde: '2025-01-01', hasta: '2025-12-31' }
    expect(proximaFecha(acabada, d('2026-08-18'))).toBeNull()
  })
})
