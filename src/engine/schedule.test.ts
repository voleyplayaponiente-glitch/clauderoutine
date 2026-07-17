import { describe, it, expect } from 'vitest'
import type { Match, ScheduleConfig } from '@/types'
import { generateSchedule, detectConflicts, minutesToHHmm } from './schedule'

const schedule: ScheduleConfig = {
  horaInicio: '09:00',
  duracionPartidoMin: 30,
  descansoEntrePartidosMin: 0,
  numPistas: 2,
  nombresPistas: ['Pista 1', 'Pista 2'],
  descansoMinimoEquipoMin: 0,
}

function gm(id: string, localId: string, visitanteId: string): Match {
  return {
    id,
    numero: Number(id),
    phase: 'grupos',
    grupoId: 'g',
    localId,
    visitanteId,
    sets: [],
    status: 'pendiente',
  }
}

describe('minutesToHHmm', () => {
  it('adds offsets correctly', () => {
    expect(minutesToHHmm('09:00', 90)).toBe('10:30')
    expect(minutesToHHmm('09:15', 45)).toBe('10:00')
  })
})

describe('generateSchedule', () => {
  it('assigns every match a court and time', () => {
    const matches = [gm('1', 'A', 'B'), gm('2', 'C', 'D'), gm('3', 'E', 'F')]
    const out = generateSchedule(matches, schedule)
    out.forEach((m) => {
      expect(m.pista).toBeTruthy()
      expect(m.hora).toBeTruthy()
    })
  })

  it('never schedules a team twice at the same time', () => {
    // A plays in matches 1 and 2 -> must be different times
    const matches = [gm('1', 'A', 'B'), gm('2', 'A', 'C')]
    const out = generateSchedule(matches, schedule)
    expect(out[0].hora).not.toBe(out[1].hora)
  })

  it('produces no conflicts for a simple round', () => {
    const matches = [gm('1', 'A', 'B'), gm('2', 'C', 'D')]
    const out = generateSchedule(matches, schedule)
    const conflicts = detectConflicts(out, schedule.duracionPartidoMin)
    expect(conflicts).toHaveLength(0)
  })
})

describe('detectConflicts', () => {
  it('flags two matches on the same court at the same time', () => {
    const a = { ...gm('1', 'A', 'B'), pista: 'Pista 1', hora: '09:00' }
    const b = { ...gm('2', 'C', 'D'), pista: 'Pista 1', hora: '09:00' }
    const conflicts = detectConflicts([a, b], 30)
    expect(conflicts.some((c) => c.tipo === 'pista_solapada')).toBe(true)
  })

  it('flags a team playing two overlapping matches', () => {
    const a = { ...gm('1', 'A', 'B'), pista: 'Pista 1', hora: '09:00' }
    const b = { ...gm('2', 'A', 'C'), pista: 'Pista 2', hora: '09:00' }
    const conflicts = detectConflicts([a, b], 30)
    expect(conflicts.some((c) => c.tipo === 'equipo_solapado')).toBe(true)
  })

  it('flags insufficient rest between a team matches', () => {
    const a = { ...gm('1', 'A', 'B'), pista: 'Pista 1', hora: '09:00' }
    const b = { ...gm('2', 'A', 'C'), pista: 'Pista 2', hora: '09:35' }
    const conflicts = detectConflicts([a, b], 30, 20)
    expect(conflicts.some((c) => c.tipo === 'descanso_insuficiente')).toBe(true)
  })
})
