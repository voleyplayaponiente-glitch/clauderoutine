import type { MatchStatus, Phase, TiebreakCriterion } from '@/types'

export const PHASE_LABEL: Record<Phase, string> = {
  grupos: 'Fase de grupos',
  dieciseisavos: 'Dieciseisavos',
  octavos: 'Octavos de final',
  cuartos: 'Cuartos de final',
  semifinales: 'Semifinales',
  tercer_puesto: '3.º y 4.º puesto',
  final: 'Final',
}

export const PHASE_SHORT: Record<Phase, string> = {
  grupos: 'Grupos',
  dieciseisavos: '1/16',
  octavos: 'Octavos',
  cuartos: 'Cuartos',
  semifinales: 'Semis',
  tercer_puesto: '3.º puesto',
  final: 'Final',
}

export const STATUS_LABEL: Record<MatchStatus, string> = {
  pendiente: 'Pendiente',
  en_juego: 'En juego',
  finalizado: 'Finalizado',
  aplazado: 'Aplazado',
  cancelado: 'Cancelado',
}

export const STATUS_COLOR: Record<MatchStatus, string> = {
  pendiente: '#8e8e93',
  en_juego: '#0a84ff',
  finalizado: '#30d158',
  aplazado: '#ff9f0a',
  cancelado: '#ff3b30',
}

export const TIEBREAK_LABEL: Record<TiebreakCriterion, string> = {
  partidos_ganados: 'Partidos ganados',
  diferencia_sets: 'Diferencia de sets',
  sets_favor: 'Sets a favor',
  diferencia_puntos: 'Diferencia de puntos',
  puntos_favor: 'Puntos a favor',
  enfrentamiento_directo: 'Enfrentamiento directo',
}

export function formatCurrency(n?: number): string {
  return `${(n ?? 0).toFixed(2)} €`
}
