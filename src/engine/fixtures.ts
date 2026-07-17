import type { CompetitionConfig, Group, Match } from '@/types'
import { uid } from './id'

/**
 * Round-robin fixtures (circle method) for one group.
 * Returns list of [localId, visitanteId, round].
 */
export function roundRobinPairs(teamIds: string[]): [string, string, number][] {
  const ids = [...teamIds]
  if (ids.length % 2 !== 0) ids.push('__BYE__')
  const n = ids.length
  const rounds = n - 1
  const half = n / 2
  const pairs: [string, string, number][] = []
  const arr = [...ids]

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const a = arr[i]
      const b = arr[n - 1 - i]
      if (a !== '__BYE__' && b !== '__BYE__') {
        // alternate home/away for fairness
        if (r % 2 === 0) pairs.push([a, b, r + 1])
        else pairs.push([b, a, r + 1])
      }
    }
    // rotate keeping first fixed
    arr.splice(1, 0, arr.pop()!)
  }
  return pairs
}

/** Generate all group-phase matches for every group. */
export function generateGroupMatches(
  groups: Group[],
  config: CompetitionConfig,
  startNumber = 1,
): Match[] {
  const matches: Match[] = []
  let num = startNumber
  // interleave by round so schedules spread teams out
  const perGroup = groups.map((g) => roundRobinPairs(g.teamIds).map((p) => ({ g, p })))
  const maxLen = Math.max(0, ...perGroup.map((x) => x.length))
  // order round by round
  const maxRound = Math.max(
    1,
    ...perGroup.flatMap((x) => x.map((y) => y.p[2])),
  )
  for (let round = 1; round <= maxRound; round++) {
    for (const gpairs of perGroup) {
      for (const { g, p } of gpairs) {
        if (p[2] !== round) continue
        matches.push({
          id: uid('m'),
          numero: num++,
          phase: 'grupos',
          grupoId: g.id,
          ronda: round,
          localId: p[0],
          visitanteId: p[1],
          sets: [],
          status: 'pendiente',
        })
      }
    }
  }
  void maxLen
  return matches
}
