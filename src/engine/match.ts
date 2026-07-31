import type { CompetitionConfig, Match, SetResult } from '@/types'

export interface MatchOutcome {
  played: boolean
  localSets: number
  visitanteSets: number
  localPuntos: number
  visitantePuntos: number
  winnerId?: string
  loserId?: string
  valid: boolean
  error?: string
}

/** Determine winner of a single set given points. Returns 'local' | 'visitante' | null. */
export function setWinner(set: SetResult): 'local' | 'visitante' | null {
  if (set.local === set.visitante) return null
  return set.local > set.visitante ? 'local' : 'visitante'
}

export function setsToWin(config: CompetitionConfig): number {
  return config.alMejorDeTres ? 2 : 1
}

/**
 * Compute the outcome of a match from its set results and the competition config.
 * Pure — no side effects.
 */
export function computeOutcome(match: Match, config: CompetitionConfig): MatchOutcome {
  const needed = setsToWin(config)
  let localSets = 0
  let visitanteSets = 0
  let localPuntos = 0
  let visitantePuntos = 0

  for (const set of match.sets) {
    localPuntos += set.local
    visitantePuntos += set.visitante
    const w = setWinner(set)
    if (w === 'local') localSets += 1
    else if (w === 'visitante') visitanteSets += 1
  }

  const decided = localSets >= needed || visitanteSets >= needed
  const winnerSide = localSets > visitanteSets ? 'local' : visitanteSets > localSets ? 'visitante' : null

  let winnerId: string | undefined
  let loserId: string | undefined
  if (decided && winnerSide) {
    winnerId = winnerSide === 'local' ? match.localId : match.visitanteId
    loserId = winnerSide === 'local' ? match.visitanteId : match.localId
  }

  return {
    played: match.status === 'finalizado' && decided,
    localSets,
    visitanteSets,
    localPuntos,
    visitantePuntos,
    winnerId,
    loserId,
    valid: match.sets.length === 0 || decided,
  }
}

/** Validate a set score against the point rules. Returns error message in Spanish or null. */
export function validateSet(
  set: SetResult,
  config: CompetitionConfig,
  esDecisivo: boolean,
): string | null {
  const objetivo = esDecisivo ? config.puntosSetDecisivo : config.puntosPorSet
  const max = Math.max(set.local, set.visitante)
  const min = Math.min(set.local, set.visitante)
  if (set.local < 0 || set.visitante < 0) return 'Los puntos no pueden ser negativos.'
  if (set.local === set.visitante) return 'Un set no puede terminar en empate.'
  if (max < objetivo) return `El ganador del set debe llegar al menos a ${objetivo} puntos.`
  if (config.diferenciaDosPuntos) {
    // if winner went above target, difference must be exactly 2 (deuce) unless min < target-... simplified: diff >= 2
    if (max - min < 2) return 'Debe haber una diferencia mínima de 2 puntos.'
  }
  return null
}

/** True when a match has a valid final result. */
export function isFinished(match: Match, config: CompetitionConfig): boolean {
  if (match.status !== 'finalizado') return false
  return computeOutcome(match, config).played
}
