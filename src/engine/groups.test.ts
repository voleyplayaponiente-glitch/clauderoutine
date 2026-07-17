import { describe, it, expect } from 'vitest'
import type { Team } from '@/types'
import { generateGroups } from './groups'
import { generateGroupMatches, roundRobinPairs } from './fixtures'
import { defaultConfig } from './defaults'

function makeTeams(n: number, seeds: number[] = []): Team[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `T${i + 1}`,
    numero: i + 1,
    nombre: `Equipo ${i + 1}`,
    jugadores: [],
    cabezaSerie: seeds.includes(i + 1),
    seedRank: seeds.indexOf(i + 1) >= 0 ? seeds.indexOf(i + 1) + 1 : undefined,
    estadoInscripcion: 'inscrito' as const,
  }))
}

describe('generateGroups', () => {
  it('splits 16 teams into 4 balanced groups', () => {
    const cfg = defaultConfig(16)
    const groups = generateGroups(makeTeams(16), cfg)
    expect(groups).toHaveLength(4)
    groups.forEach((g) => expect(g.teamIds).toHaveLength(4))
    const all = groups.flatMap((g) => g.teamIds)
    expect(new Set(all).size).toBe(16)
  })

  it('places seeds in different groups', () => {
    const cfg = defaultConfig(16)
    const teams = makeTeams(16, [1, 2, 3, 4]) // 4 seeds
    const groups = generateGroups(teams, cfg)
    const seedGroups = ['T1', 'T2', 'T3', 'T4'].map(
      (id) => groups.findIndex((g) => g.teamIds.includes(id)),
    )
    expect(new Set(seedGroups).size).toBe(4)
  })

  it('honours keep-apart constraints', () => {
    const cfg = defaultConfig(16)
    const teams = makeTeams(16)
    const groups = generateGroups(teams, cfg, { keepApart: [['T1', 'T2']] })
    const g1 = groups.find((g) => g.teamIds.includes('T1'))!
    expect(g1.teamIds.includes('T2')).toBe(false)
  })
})

describe('roundRobinPairs', () => {
  it('generates C(4,2)=6 matches for a group of 4', () => {
    const pairs = roundRobinPairs(['A', 'B', 'C', 'D'])
    expect(pairs).toHaveLength(6)
    // every pair distinct
    const keys = pairs.map(([a, b]) => [a, b].sort().join('-'))
    expect(new Set(keys).size).toBe(6)
  })

  it('each team plays 3 matches in a group of 4', () => {
    const pairs = roundRobinPairs(['A', 'B', 'C', 'D'])
    const count: Record<string, number> = {}
    pairs.forEach(([a, b]) => {
      count[a] = (count[a] ?? 0) + 1
      count[b] = (count[b] ?? 0) + 1
    })
    Object.values(count).forEach((c) => expect(c).toBe(3))
  })
})

describe('generateGroupMatches', () => {
  it('creates 6 matches per group of 4 (24 total for 16 teams)', () => {
    const cfg = defaultConfig(16)
    const groups = generateGroups(makeTeams(16), cfg)
    const matches = generateGroupMatches(groups, cfg, 1)
    expect(matches).toHaveLength(24)
    expect(matches.every((m) => m.phase === 'grupos')).toBe(true)
    // sequential numbering
    expect(matches[0].numero).toBe(1)
  })
})
