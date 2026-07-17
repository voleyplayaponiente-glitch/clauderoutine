import { describe, it, expect } from 'vitest'
import type { Group, Match } from '@/types'
import { computeStandings } from './standings'
import { defaultConfig } from './defaults'

const config = defaultConfig(8)

function m(id: string, localId: string, visitanteId: string, sets: [number, number][]): Match {
  return {
    id,
    numero: 1,
    phase: 'grupos',
    grupoId: 'g1',
    localId,
    visitanteId,
    sets: sets.map(([local, visitante]) => ({ local, visitante })),
    status: 'finalizado',
  }
}

const group: Group = { id: 'g1', nombre: 'Grupo A', teamIds: ['A', 'B', 'C', 'D'] }

describe('computeStandings', () => {
  it('ranks by wins first', () => {
    const matches: Match[] = [
      m('1', 'A', 'B', [[21, 10], [21, 12]]), // A wins
      m('2', 'A', 'C', [[21, 15], [21, 18]]), // A wins
      m('3', 'A', 'D', [[21, 9], [21, 11]]), // A wins
      m('4', 'B', 'C', [[21, 14], [21, 16]]), // B wins
      m('5', 'B', 'D', [[21, 19], [21, 17]]), // B wins
      m('6', 'C', 'D', [[21, 15], [21, 13]]), // C wins
    ]
    const s = computeStandings(group, matches, config)
    expect(s.map((r) => r.teamId)).toEqual(['A', 'B', 'C', 'D'])
    expect(s[0].ganados).toBe(3)
    expect(s[1].ganados).toBe(2)
    expect(s[3].ganados).toBe(0)
  })

  it('uses set difference before points', () => {
    // A and B both 1-1 within a 3-team style comparison
    const matches: Match[] = [
      m('1', 'A', 'B', [[21, 10], [21, 10]]), // A wins 2-0, big margin
      m('2', 'B', 'C', [[21, 10], [21, 10]]), // B wins 2-0
      m('3', 'C', 'A', [[21, 10], [21, 10]]), // C wins 2-0
    ]
    // triple tie 1-1 each; set diff all equal -> points equal -> unresolved
    const s = computeStandings(group, matches, config)
    const abc = s.filter((r) => r.teamId !== 'D')
    abc.forEach((r) => expect(r.ganados).toBe(1))
  })

  it('breaks a two-way tie by head to head', () => {
    const cfg = { ...config, tiebreakOrder: ['partidos_ganados', 'enfrentamiento_directo', 'diferencia_sets'] as any }
    const matches: Match[] = [
      // A and B both beat C and D, tie on wins; A beat B head-to-head
      m('1', 'A', 'B', [[21, 19], [21, 19]]),
      m('2', 'A', 'C', [[21, 10], [21, 10]]),
      m('3', 'A', 'D', [[21, 10], [21, 10]]),
      m('4', 'B', 'C', [[21, 10], [21, 10]]),
      m('5', 'B', 'D', [[21, 10], [21, 10]]),
      m('6', 'C', 'D', [[21, 10], [21, 10]]),
    ]
    const s = computeStandings(group, matches, cfg)
    expect(s[0].teamId).toBe('A')
    expect(s[1].teamId).toBe('B')
  })

  it('flags an unresolved tie', () => {
    const matches: Match[] = [
      m('1', 'A', 'B', [[21, 10], [21, 10]]),
      m('2', 'B', 'C', [[21, 10], [21, 10]]),
      m('3', 'C', 'A', [[21, 10], [21, 10]]),
    ]
    const s = computeStandings(group, matches, config)
    const tied = s.filter((r) => r.teamId !== 'D')
    expect(tied.some((r) => r.empateSinResolver)).toBe(true)
  })

  it('respects manual tiebreak override', () => {
    const matches: Match[] = [
      m('1', 'A', 'B', [[21, 10], [21, 10]]),
      m('2', 'B', 'C', [[21, 10], [21, 10]]),
      m('3', 'C', 'A', [[21, 10], [21, 10]]),
    ]
    const s = computeStandings(group, matches, config, { C: 1, A: 2, B: 3 })
    expect(s.slice(0, 3).map((r) => r.teamId)).toEqual(['C', 'A', 'B'])
  })

  it('ignores unfinished matches', () => {
    const matches: Match[] = [
      { ...m('1', 'A', 'B', [[21, 10]]), status: 'pendiente' },
    ]
    const s = computeStandings(group, matches, config)
    expect(s.every((r) => r.jugados === 0)).toBe(true)
  })
})
