import { describe, it, expect } from 'vitest'
import type { Match } from '@/types'
import { computeOutcome, validateSet, setWinner } from './match'
import { defaultConfig } from './defaults'

const config = defaultConfig(8)

function match(sets: [number, number][], status: Match['status'] = 'finalizado'): Match {
  return {
    id: 'm',
    numero: 1,
    phase: 'grupos',
    localId: 'A',
    visitanteId: 'B',
    sets: sets.map(([local, visitante]) => ({ local, visitante })),
    status,
  }
}

describe('setWinner', () => {
  it('detects the set winner', () => {
    expect(setWinner({ local: 21, visitante: 18 })).toBe('local')
    expect(setWinner({ local: 15, visitante: 21 })).toBe('visitante')
    expect(setWinner({ local: 21, visitante: 21 })).toBe(null)
  })
})

describe('computeOutcome', () => {
  it('best of three: 2-0 is a win', () => {
    const o = computeOutcome(match([[21, 10], [21, 15]]), config)
    expect(o.played).toBe(true)
    expect(o.localSets).toBe(2)
    expect(o.winnerId).toBe('A')
  })

  it('best of three: 2-1 is a win', () => {
    const o = computeOutcome(match([[21, 10], [15, 21], [15, 12]]), config)
    expect(o.winnerId).toBe('A')
    expect(o.localSets).toBe(2)
    expect(o.visitanteSets).toBe(1)
  })

  it('accumulates points for and against', () => {
    const o = computeOutcome(match([[21, 10], [21, 15]]), config)
    expect(o.localPuntos).toBe(42)
    expect(o.visitantePuntos).toBe(25)
  })

  it('is not played when status is pendiente', () => {
    const o = computeOutcome(match([[21, 10], [21, 15]], 'pendiente'), config)
    expect(o.played).toBe(false)
  })

  it('single set mode: 1-0 decides', () => {
    const single = { ...config, alMejorDeTres: false }
    const o = computeOutcome(match([[21, 18]]), single)
    expect(o.played).toBe(true)
    expect(o.winnerId).toBe('A')
  })
})

describe('validateSet', () => {
  it('rejects a tie', () => {
    expect(validateSet({ local: 20, visitante: 20 }, config, false)).toMatch(/empate/)
  })
  it('requires reaching the target points', () => {
    expect(validateSet({ local: 15, visitante: 10 }, config, false)).toMatch(/21/)
  })
  it('requires a two point difference', () => {
    expect(validateSet({ local: 22, visitante: 21 }, config, false)).toMatch(/2 puntos/)
  })
  it('accepts a valid set', () => {
    expect(validateSet({ local: 21, visitante: 15 }, config, false)).toBeNull()
    expect(validateSet({ local: 23, visitante: 21 }, config, false)).toBeNull()
  })
})
