// ---------- Domain types ----------

export type Uuid = string

export type MatchStatus = 'pendiente' | 'en_juego' | 'finalizado' | 'aplazado' | 'cancelado'

export type Phase =
  | 'grupos'
  | 'dieciseisavos'
  | 'octavos'
  | 'cuartos'
  | 'semifinales'
  | 'tercer_puesto'
  | 'final'

export type RegistrationStatus = 'inscrito' | 'pendiente' | 'confirmado' | 'baja'

export type TiebreakCriterion =
  | 'partidos_ganados'
  | 'diferencia_sets'
  | 'sets_favor'
  | 'diferencia_puntos'
  | 'puntos_favor'
  | 'enfrentamiento_directo'

export interface Player {
  id: Uuid
  nombre: string
}

export interface Team {
  id: Uuid
  numero: number
  nombre: string
  jugadores: Player[]
  telefono?: string
  cabezaSerie: boolean // seed
  seedRank?: number // 1 = mejor cabeza de serie
  subcategoria?: string // p. ej. "SUB-17" / "SUB-15" dentro de la misma competición
  estadoInscripcion: RegistrationStatus
  importePagado?: number
  observaciones?: string
}

export interface SetResult {
  local: number
  visitante: number
}

export interface Match {
  id: Uuid
  numero: number
  phase: Phase
  grupoId?: Uuid // for group phase
  ronda?: number // group round-robin round, or bracket depth
  // team references. In knockout phase, may be a placeholder slot until resolved.
  localId?: Uuid
  visitanteId?: Uuid
  localPlaceholder?: string // e.g. "1º Grupo A"
  visitantePlaceholder?: string
  // seed references for first knockout round (grupoIndex + rank within group)
  seedLocal?: { grupoIndex: number; rank: number }
  seedVisitante?: { grupoIndex: number; rank: number }
  // links for bracket progression
  bracketSlot?: string // unique slot id e.g. "QF1"
  winnerTo?: string // slot id that the winner advances to
  winnerToSide?: 'local' | 'visitante'
  loserTo?: string // for third-place
  loserToSide?: 'local' | 'visitante'
  pista?: string
  hora?: string // ISO time or HH:mm
  sets: SetResult[]
  status: MatchStatus
  observaciones?: string
}

export interface Group {
  id: Uuid
  nombre: string // "Grupo A"
  teamIds: Uuid[]
}

export interface CompetitionConfig {
  numEquipos: 8 | 16 | 32
  numGrupos: number
  equiposPorGrupo: number
  jugadoresPorEquipo: number // p. ej. 2 en 2x2, 5/6 en otras modalidades
  subcategorias: string[] // etiquetas opcionales de subcategoría (SUB-17, SUB-15…)
  clasificadosPorGrupo: number
  mejoresTerceros: boolean
  numMejoresTerceros: number
  alMejorDeTres: boolean // true = best of 3 sets, false = single set
  puntosPorSet: number
  puntosSetDecisivo: number
  diferenciaDosPuntos: boolean
  tercerPuesto: boolean
  sorteoAutomatico: boolean
  usarCabezasSerie: boolean
  evitarMismoGrupoEnCruces: boolean
  tiebreakOrder: TiebreakCriterion[]
}

export interface Category {
  id: Uuid
  nombre: string
  color: string
  config: CompetitionConfig
  teams: Team[]
  groups: Group[]
  matches: Match[]
  // manual tiebreak decisions: teamId -> rank override within group
  manualTiebreaks: Record<string, number>
}

export interface ScheduleConfig {
  horaInicio: string // "09:00"
  duracionPartidoMin: number
  descansoEntrePartidosMin: number
  numPistas: number
  nombresPistas: string[]
  descansoMinimoEquipoMin: number
}

export interface Tournament {
  id: Uuid
  nombre: string
  lugar?: string
  fecha?: string
  categories: Category[]
  schedule: ScheduleConfig
  createdAt: number
  updatedAt: number
}

// ---------- Computed types ----------

export interface StandingRow {
  teamId: Uuid
  posicion: number
  jugados: number
  ganados: number
  perdidos: number
  setsFavor: number
  setsContra: number
  difSets: number
  puntosFavor: number
  puntosContra: number
  difPuntos: number
  puntosClasificacion: number // 2 win / 0 loss (volley-style optional)
  empateSinResolver: boolean
}
