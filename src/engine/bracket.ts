import type { CompetitionConfig, Group, Match, Phase } from '@/types'
import { uid } from './id'
import { groupLabel } from './groups'
import { computeStandings } from './standings'
import { computeOutcome } from './match'

export function phaseForMatchCount(count: number): Phase {
  switch (count) {
    case 16:
      return 'dieciseisavos'
    case 8:
      return 'octavos'
    case 4:
      return 'cuartos'
    case 2:
      return 'semifinales'
    default:
      return 'final'
  }
}

export interface SeedRef {
  grupoIndex: number
  rank: number
}

function seedLabel(ref: SeedRef): string {
  return `${ref.rank}º ${groupLabel(ref.grupoIndex)}`
}

/**
 * Build the ordered first-round pairings from group winners/runners so that:
 * - no two teams from the same group meet before the final
 * - same-group teams are not paired in the first round
 * Works for an even number of groups (2, 4, 8...) with 2 qualifiers each.
 */
export function buildFirstRoundSeeds(numGrupos: number): [SeedRef, SeedRef][] {
  const pairs: [SeedRef, SeedRef][] = []
  if (numGrupos % 2 === 0) {
    // first half: W_i vs R_{i+1} for even i
    for (let i = 0; i < numGrupos; i += 2) {
      pairs.push([
        { grupoIndex: i, rank: 1 },
        { grupoIndex: i + 1, rank: 2 },
      ])
    }
    // second half: W_{i+1} vs R_i for even i
    for (let i = 0; i < numGrupos; i += 2) {
      pairs.push([
        { grupoIndex: i + 1, rank: 1 },
        { grupoIndex: i, rank: 2 },
      ])
    }
  } else {
    // odd number of groups fallback: winner i vs runner (i+1)%g
    for (let i = 0; i < numGrupos; i++) {
      pairs.push([
        { grupoIndex: i, rank: 1 },
        { grupoIndex: (i + 1) % numGrupos, rank: 2 },
      ])
    }
  }
  return pairs
}

/**
 * Generate a full single-elimination bracket (placeholders only) from the
 * configured groups. Winner links are wired so results propagate automatically.
 */
export function generateBracket(
  config: CompetitionConfig,
  startNumber: number,
): Match[] {
  const firstSeeds = buildFirstRoundSeeds(config.numGrupos)
  const g = firstSeeds.length
  const matches: Match[] = []
  let num = startNumber

  // rounds: g, g/2, ... 1
  const rounds: string[][] = []
  let count = g
  let r = 0
  while (count >= 1) {
    const slots: string[] = []
    for (let j = 0; j < count; j++) slots.push(`R${r}M${j}`)
    rounds.push(slots)
    if (count === 1) break
    count = Math.floor(count / 2)
    r++
  }

  const slotToMatch = new Map<string, Match>()

  rounds.forEach((slots, roundIdx) => {
    const phase = phaseForMatchCount(slots.length)
    slots.forEach((slot, j) => {
      const isFirst = roundIdx === 0
      const m: Match = {
        id: uid('k'),
        numero: num++,
        phase,
        bracketSlot: slot,
        ronda: roundIdx,
        sets: [],
        status: 'pendiente',
      }
      if (isFirst) {
        const [a, b] = firstSeeds[j]
        m.seedLocal = a
        m.seedVisitante = b
        m.localPlaceholder = seedLabel(a)
        m.visitantePlaceholder = seedLabel(b)
      } else {
        m.localPlaceholder = 'Por definir'
        m.visitantePlaceholder = 'Por definir'
      }
      // wire winner destination
      if (roundIdx < rounds.length - 1) {
        const nextSlot = `R${roundIdx + 1}M${Math.floor(j / 2)}`
        m.winnerTo = nextSlot
        m.winnerToSide = j % 2 === 0 ? 'local' : 'visitante'
      }
      slotToMatch.set(slot, m)
      matches.push(m)
    })
  })

  // third place match: losers of the two semifinals
  if (config.tercerPuesto) {
    const semis = matches.filter((m) => m.phase === 'semifinales')
    if (semis.length === 2) {
      const tp: Match = {
        id: uid('k'),
        numero: num++,
        phase: 'tercer_puesto',
        bracketSlot: 'TP',
        sets: [],
        status: 'pendiente',
        localPlaceholder: 'Perdedor SF1',
        visitantePlaceholder: 'Perdedor SF2',
      }
      semis[0].loserTo = 'TP'
      semis[0].loserToSide = 'local'
      semis[1].loserTo = 'TP'
      semis[1].loserToSide = 'visitante'
      matches.push(tp)
    }
  }

  return matches
}

/**
 * Resolve bracket team references from group standings and completed matches.
 * Mutates a copy of the matches array and returns it. Idempotent.
 */
export function resolveBracket(
  bracketMatches: Match[],
  groups: Group[],
  groupMatches: Match[],
  config: CompetitionConfig,
  manualTiebreaks: Record<string, number> = {},
): Match[] {
  const result = bracketMatches.map((m) => ({ ...m }))
  const bySlot = new Map<string, Match>()
  result.forEach((m) => m.bracketSlot && bySlot.set(m.bracketSlot, m))

  // 1. resolve first-round seeds from standings
  const standingsByGroup = groups.map((grp) =>
    computeStandings(grp, groupMatches, config, manualTiebreaks),
  )
  const groupsComplete = groups.map((grp) => {
    const gms = groupMatches.filter((m) => m.grupoId === grp.id)
    return gms.length > 0 && gms.every((m) => computeOutcome(m, config).played)
  })

  for (const m of result) {
    if (m.seedLocal) {
      const s = standingsByGroup[m.seedLocal.grupoIndex]
      const done = groupsComplete[m.seedLocal.grupoIndex]
      m.localId = done ? s?.[m.seedLocal.rank - 1]?.teamId : undefined
    }
    if (m.seedVisitante) {
      const s = standingsByGroup[m.seedVisitante.grupoIndex]
      const done = groupsComplete[m.seedVisitante.grupoIndex]
      m.visitanteId = done ? s?.[m.seedVisitante.rank - 1]?.teamId : undefined
    }
  }

  // 2. propagate winners/losers forward. Iterate enough times to cascade.
  for (let iter = 0; iter < result.length + 2; iter++) {
    for (const m of result) {
      const o = computeOutcome(m, config)
      if (m.winnerTo && o.played && o.winnerId) {
        const target = bySlot.get(m.winnerTo)
        if (target) {
          if (m.winnerToSide === 'local') target.localId = o.winnerId
          else target.visitanteId = o.winnerId
        }
      }
      if (m.loserTo && o.played && o.loserId) {
        const target = bySlot.get(m.loserTo)
        if (target) {
          if (m.loserToSide === 'local') target.localId = o.loserId
          else target.visitanteId = o.loserId
        }
      }
    }
  }

  return result
}

/** Returns the champion team id if the final is finished. */
export function champion(bracketMatches: Match[], config: CompetitionConfig): string | undefined {
  const final = bracketMatches.find((m) => m.phase === 'final')
  if (!final) return undefined
  const o = computeOutcome(final, config)
  return o.played ? o.winnerId : undefined
}
