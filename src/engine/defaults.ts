import type { CompetitionConfig, ScheduleConfig, TiebreakCriterion } from '@/types'

export const DEFAULT_TIEBREAK_ORDER: TiebreakCriterion[] = [
  'partidos_ganados',
  'diferencia_sets',
  'sets_favor',
  'diferencia_puntos',
  'puntos_favor',
  'enfrentamiento_directo',
]

export function defaultConfig(numEquipos: 8 | 16 | 32): CompetitionConfig {
  const numGrupos = numEquipos / 4
  return {
    numEquipos,
    numGrupos,
    equiposPorGrupo: 4,
    jugadoresPorEquipo: 5,
    subcategorias: [],
    clasificadosPorGrupo: 2,
    mejoresTerceros: false,
    numMejoresTerceros: 0,
    alMejorDeTres: true,
    puntosPorSet: 21,
    puntosSetDecisivo: 15,
    diferenciaDosPuntos: true,
    tercerPuesto: true,
    sorteoAutomatico: true,
    usarCabezasSerie: true,
    evitarMismoGrupoEnCruces: true,
    tiebreakOrder: [...DEFAULT_TIEBREAK_ORDER],
  }
}

export function defaultSchedule(): ScheduleConfig {
  return {
    horaInicio: '09:00',
    duracionPartidoMin: 40,
    descansoEntrePartidosMin: 5,
    numPistas: 2,
    nombresPistas: ['Pista 1', 'Pista 2'],
    descansoMinimoEquipoMin: 20,
  }
}

export const CATEGORY_COLORS = [
  '#0a84ff', // azul
  '#ff9f0a', // naranja
  '#30d158', // verde
  '#bf5af2', // morado
  '#ff375f', // rosa
  '#64d2ff', // celeste
  '#ffd60a', // amarillo
  '#ac8e68', // marrón
]
