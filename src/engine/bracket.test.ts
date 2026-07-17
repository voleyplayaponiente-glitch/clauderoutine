import { describe, it, expect } from 'vitest'
import type { Group, Match } from '@/types'
import { buildFirstRoundSeeds, generateBracket, resolveBracket, champion } from './bracket'
import { generateGroupMatches } from './fixtures'
import { generateGroups } from './groups'
import { defaultConfig } from './defaults'
import type { Team } from '@/types'

function makeTeams(n: number): Team[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `T${i + 1}`,
    numero: i + 1,
    nombre: `Equipo ${i + 1}`,
    jugadores: [],
    cabezaSerie: false,
    estadoInscripcion: 'inscrito' as const,
  }))
}

describe('buildFirstRoundSeeds', () => {
  it('8 teams -> 2 groups -> semifinal crosses 1A-2B and 1B-2A', () => {
    const seeds = buildFirstRoundSeeds(2)
    expect(seeds).toHaveLength(2)
    expect(seeds[0]).toEqual([
      { grupoIndex: 0, rank: 1 },
      { grupoIndex: 1, rank: 2 },
    ])
    expect(seeds[1]).toEqual([
      { grupoIndex: 1, rank: 1 },
      { grupoIndex: 0, rank: 2 },
    ])
  })

  it('never pairs same group in the first round (4 and 8 groups)', () => {
    for (const g of [2, 4, 8]) {
      const seeds = buildFirstRoundSeeds(g)
      expect(seeds).toHaveLength(g)
      seeds.forEach(([a, b]) => expect(a.grupoIndex).not.toBe(b.grupoIndex))
    }
  })

  it('same-group winner and runner-up land in opposite halves', () => {
    const seeds = buildFirstRoundSeeds(4)
    const half = seeds.length / 2
    // group 0 winner is in match 0 (top half); group 0 runner-up should be bottom half
    const winnerMatch = seeds.findIndex((s) => s.some((r) => r.grupoIndex === 0 && r.rank === 1))
    const runnerMatch = seeds.findIndex((s) => s.some((r) => r.grupoIndex === 0 && r.rank === 2))
    expect(winnerMatch < half).toBe(true)
    expect(runnerMatch >= half).toBe(true)
  })
})

describe('generateBracket', () => {
  it('8-team tournament builds semis + final + third place', () => {
    const cfg = defaultConfig(8)
    const b = generateBracket(cfg, 100)
    const phases = b.map((m) => m.phase)
    expect(phases.filter((p) => p === 'semifinales')).toHaveLength(2)
    expect(phases.filter((p) => p === 'final')).toHaveLength(1)
    expect(phases.filter((p) => p === 'tercer_puesto')).toHaveLength(1)
  })

  it('16-team tournament builds quarters, semis, final', () => {
    const cfg = defaultConfig(16)
    const b = generateBracket(cfg, 1)
    expect(b.filter((m) => m.phase === 'cuartos')).toHaveLength(4)
    expect(b.filter((m) => m.phase === 'semifinales')).toHaveLength(2)
    expect(b.filter((m) => m.phase === 'final')).toHaveLength(1)
  })

  it('32-team tournament builds round of 16', () => {
    const cfg = defaultConfig(32)
    const b = generateBracket(cfg, 1)
    expect(b.filter((m) => m.phase === 'octavos')).toHaveLength(8)
    expect(b.filter((m) => m.phase === 'cuartos')).toHaveLength(4)
  })

  it('winners are wired to the next round', () => {
    const cfg = defaultConfig(16)
    const b = generateBracket(cfg, 1)
    const quarters = b.filter((m) => m.phase === 'cuartos')
    quarters.forEach((q) => expect(q.winnerTo).toBeTruthy())
    const final = b.find((m) => m.phase === 'final')!
    expect(final.winnerTo).toBeFalsy()
  })
})

describe('resolveBracket end-to-end', () => {
  function playAll(matches: Match[], winnerSide: (m: Match) => 'local' | 'visitante'): Match[] {
    return matches.map((m) => {
      if (!m.localId || !m.visitanteId) return m
      const side = winnerSide(m)
      const sets =
        side === 'local'
          ? [{ local: 21, visitante: 10 }, { local: 21, visitante: 10 }]
          : [{ local: 10, visitante: 21 }, { local: 10, visitante: 21 }]
      return { ...m, sets, status: 'finalizado' as const }
    })
  }

  it('produces a champion for an 8-team tournament', () => {
    const cfg = defaultConfig(8)
    const teams = makeTeams(8)
    const groups: Group[] = generateGroups(teams, cfg)
    let groupMatches = generateGroupMatches(groups, cfg, 1)
    // local always wins the group matches -> deterministic standings
    groupMatches = playAll(groupMatches, () => 'local')

    let bracket = generateBracket(cfg, 500)
    bracket = resolveBracket(bracket, groups, groupMatches, cfg)
    // semis should now have team ids
    const semis = bracket.filter((m) => m.phase === 'semifinales')
    semis.forEach((s) => {
      expect(s.localId).toBeTruthy()
      expect(s.visitanteId).toBeTruthy()
    })
    // play semis + final, local wins
    bracket = playAll(bracket, () => 'local')
    bracket = resolveBracket(bracket, groups, groupMatches, cfg)
    bracket = playAll(bracket, () => 'local')
    bracket = resolveBracket(bracket, groups, groupMatches, cfg)
    const champ = champion(bracket, cfg)
    expect(champ).toBeTruthy()
  })

  it('leaves knockout teams undefined until groups are complete', () => {
    const cfg = defaultConfig(8)
    const teams = makeTeams(8)
    const groups = generateGroups(teams, cfg)
    const groupMatches = generateGroupMatches(groups, cfg, 1) // none played
    let bracket = generateBracket(cfg, 1)
    bracket = resolveBracket(bracket, groups, groupMatches, cfg)
    const semis = bracket.filter((m) => m.phase === 'semifinales')
    semis.forEach((s) => {
      expect(s.localId).toBeFalsy()
      expect(s.visitanteId).toBeFalsy()
    })
  })
})
