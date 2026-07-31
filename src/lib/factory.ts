import type { Category, CompetitionConfig, Team, Tournament } from '@/types'
import { uid } from '@/engine/id'
import { defaultConfig, defaultSchedule, CATEGORY_COLORS } from '@/engine/defaults'

export function newTeam(numero: number, nombre = '', jugadores = 5): Team {
  const count = Math.max(1, jugadores)
  return {
    id: uid('t'),
    numero,
    nombre: nombre || `Equipo ${numero}`,
    jugadores: Array.from({ length: count }, () => ({ id: uid('p'), nombre: '' })),
    cabezaSerie: false,
    estadoInscripcion: 'inscrito',
    importePagado: 0,
  }
}

export function newCategory(nombre: string, colorIdx: number, numEquipos: 8 | 16 | 32 = 8): Category {
  return {
    id: uid('cat'),
    nombre,
    color: CATEGORY_COLORS[colorIdx % CATEGORY_COLORS.length],
    config: defaultConfig(numEquipos),
    teams: [],
    groups: [],
    matches: [],
    manualTiebreaks: {},
  }
}

export function newTournament(nombre: string): Tournament {
  const now = Date.now()
  return {
    id: uid('trn'),
    nombre,
    categories: [newCategory('SUB-17', 0, 8), newCategory('SÉNIOR', 1, 8)],
    schedule: defaultSchedule(),
    createdAt: now,
    updatedAt: now,
  }
}

export function emptyConfigFor(numEquipos: 8 | 16 | 32): CompetitionConfig {
  return defaultConfig(numEquipos)
}
