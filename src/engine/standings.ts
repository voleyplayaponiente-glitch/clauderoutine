import type {
  CompetitionConfig,
  Group,
  Match,
  StandingRow,
  TiebreakCriterion,
} from '@/types'
import { computeOutcome } from './match'

interface Acc {
  teamId: string
  jugados: number
  ganados: number
  perdidos: number
  setsFavor: number
  setsContra: number
  puntosFavor: number
  puntosContra: number
}

function emptyAcc(teamId: string): Acc {
  return {
    teamId,
    jugados: 0,
    ganados: 0,
    perdidos: 0,
    setsFavor: 0,
    setsContra: 0,
    puntosFavor: 0,
    puntosContra: 0,
  }
}

function criterionValue(a: Acc, c: TiebreakCriterion): number {
  switch (c) {
    case 'partidos_ganados':
      return a.ganados
    case 'diferencia_sets':
      return a.setsFavor - a.setsContra
    case 'sets_favor':
      return a.setsFavor
    case 'diferencia_puntos':
      return a.puntosFavor - a.puntosContra
    case 'puntos_favor':
      return a.puntosFavor
    case 'enfrentamiento_directo':
      return 0 // handled specially
  }
}

/**
 * Head-to-head record between a subset of tied teams.
 * Returns a map teamId -> wins among the tied group.
 */
function headToHead(
  tiedIds: string[],
  matches: Match[],
  config: CompetitionConfig,
): Record<string, number> {
  const wins: Record<string, number> = {}
  tiedIds.forEach((id) => (wins[id] = 0))
  const tiedSet = new Set(tiedIds)
  for (const m of matches) {
    if (!m.localId || !m.visitanteId) continue
    if (!tiedSet.has(m.localId) || !tiedSet.has(m.visitanteId)) continue
    const o = computeOutcome(m, config)
    if (!o.played || !o.winnerId) continue
    wins[o.winnerId] = (wins[o.winnerId] ?? 0) + 1
  }
  return wins
}

/**
 * Compute the standings of a group. Deterministic and pure.
 * Tiebreak order comes from config.tiebreakOrder; manualTiebreaks overrides
 * unresolved ties (lower number = higher rank).
 */
export function computeStandings(
  group: Group,
  matches: Match[],
  config: CompetitionConfig,
  manualTiebreaks: Record<string, number> = {},
): StandingRow[] {
  const accs = new Map<string, Acc>()
  group.teamIds.forEach((id) => accs.set(id, emptyAcc(id)))

  const groupMatches = matches.filter(
    (m) => m.grupoId === group.id && m.localId && m.visitanteId,
  )

  for (const m of groupMatches) {
    const o = computeOutcome(m, config)
    if (!o.played) continue
    const local = accs.get(m.localId!)
    const visit = accs.get(m.visitanteId!)
    if (!local || !visit) continue
    local.jugados += 1
    visit.jugados += 1
    local.setsFavor += o.localSets
    local.setsContra += o.visitanteSets
    visit.setsFavor += o.visitanteSets
    visit.setsContra += o.localSets
    local.puntosFavor += o.localPuntos
    local.puntosContra += o.visitantePuntos
    visit.puntosFavor += o.visitantePuntos
    visit.puntosContra += o.localPuntos
    if (o.winnerId === m.localId) {
      local.ganados += 1
      visit.perdidos += 1
    } else if (o.winnerId === m.visitanteId) {
      visit.ganados += 1
      local.perdidos += 1
    }
  }

  const unresolvedIds = new Set<string>()

  /**
   * Hierarchical partition tiebreak. Within each still-tied bucket we apply the
   * next criterion; head-to-head is evaluated as a mini-league among exactly the
   * teams in that bucket, which handles 3+ way cyclic ties correctly.
   */
  function orderBucket(bucket: Acc[], critIndex: number): Acc[] {
    if (bucket.length <= 1) return bucket
    if (critIndex >= config.tiebreakOrder.length) {
      // exhausted criteria: try manual override, else leave tied (unresolved)
      const withManual = bucket.filter((a) => manualTiebreaks[a.teamId] != null)
      const withoutManual = bucket.filter((a) => manualTiebreaks[a.teamId] == null)
      if (withoutManual.length > 1) withoutManual.forEach((a) => unresolvedIds.add(a.teamId))
      withManual.sort((a, b) => manualTiebreaks[a.teamId] - manualTiebreaks[b.teamId])
      return [...withManual, ...withoutManual]
    }
    const c = config.tiebreakOrder[critIndex]
    let valueOf: (a: Acc) => number
    if (c === 'enfrentamiento_directo') {
      const h2h = headToHead(
        bucket.map((b) => b.teamId),
        groupMatches,
        config,
      )
      valueOf = (a) => h2h[a.teamId] ?? 0
    } else {
      valueOf = (a) => criterionValue(a, c)
    }
    const sorted = [...bucket].sort((a, b) => valueOf(b) - valueOf(a))
    const out: Acc[] = []
    let i = 0
    while (i < sorted.length) {
      let j = i + 1
      while (j < sorted.length && valueOf(sorted[j]) === valueOf(sorted[i])) j++
      const sub = sorted.slice(i, j)
      out.push(...(sub.length > 1 ? orderBucket(sub, critIndex + 1) : sub))
      i = j
    }
    return out
  }

  const list = orderBucket([...accs.values()], 0)

  const rows: StandingRow[] = list.map((a, i) => {
    return {
      teamId: a.teamId,
      posicion: i + 1,
      jugados: a.jugados,
      ganados: a.ganados,
      perdidos: a.perdidos,
      setsFavor: a.setsFavor,
      setsContra: a.setsContra,
      difSets: a.setsFavor - a.setsContra,
      puntosFavor: a.puntosFavor,
      puntosContra: a.puntosContra,
      difPuntos: a.puntosFavor - a.puntosContra,
      puntosClasificacion: a.ganados * 2,
      empateSinResolver: unresolvedIds.has(a.teamId),
    }
  })

  return rows
}

/** Returns the qualified team ids of a group (top N per config). */
export function qualifiedFromGroup(
  standings: StandingRow[],
  clasificados: number,
): string[] {
  return standings.slice(0, clasificados).map((r) => r.teamId)
}
