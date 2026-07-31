import type { Match, Phase, ScheduleConfig } from '@/types'

const PHASE_ORDER: Phase[] = [
  'grupos',
  'dieciseisavos',
  'octavos',
  'cuartos',
  'semifinales',
  'tercer_puesto',
  'final',
]

export function minutesToHHmm(base: string, offsetMin: number): string {
  const [h, m] = base.split(':').map(Number)
  const total = h * 60 + m + offsetMin
  const hh = Math.floor(total / 60) % 24
  const mm = total % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

export function hhmmToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

export interface ScheduledMatch {
  matchId: string
  pista: string
  hora: string
  inicioMin: number
  finMin: number
}

/**
 * Greedy scheduler. Assigns each match to a court and start time.
 * Guarantees a team never plays two matches at once and respects the
 * minimum rest between a team's matches. Group phase is scheduled first.
 */
export function generateSchedule(matches: Match[], config: ScheduleConfig): Match[] {
  const dur = config.duracionPartidoMin
  const step = dur + config.descansoEntrePartidosMin
  const courts =
    config.nombresPistas.length >= config.numPistas
      ? config.nombresPistas.slice(0, config.numPistas)
      : Array.from({ length: config.numPistas }, (_, i) => config.nombresPistas[i] ?? `Pista ${i + 1}`)

  const ordered = [...matches].sort((a, b) => {
    const pa = PHASE_ORDER.indexOf(a.phase)
    const pb = PHASE_ORDER.indexOf(b.phase)
    if (pa !== pb) return pa - pb
    return a.numero - b.numero
  })

  const teamLastEnd = new Map<string, number>()
  // court availability: next free minute per court index
  const courtFree = courts.map(() => 0)
  const assignments = new Map<string, ScheduledMatch>()

  const teamsOf = (m: Match): string[] => [m.localId, m.visitanteId].filter(Boolean) as string[]

  for (const m of ordered) {
    const teams = teamsOf(m)
    // earliest start given team rest
    let earliest = 0
    for (const t of teams) {
      const end = teamLastEnd.get(t)
      if (end != null) earliest = Math.max(earliest, end + config.descansoMinimoEquipoMin)
    }
    // find a court+slot at or after earliest
    let bestCourt = 0
    let bestStart = Infinity
    for (let c = 0; c < courts.length; c++) {
      // snap to slot grid
      const raw = Math.max(courtFree[c], earliest)
      const slot = Math.ceil(raw / step) * step
      if (slot < bestStart) {
        bestStart = slot
        bestCourt = c
      }
    }
    const start = bestStart === Infinity ? 0 : bestStart
    const fin = start + dur
    courtFree[bestCourt] = fin
    for (const t of teams) teamLastEnd.set(t, fin)
    assignments.set(m.id, {
      matchId: m.id,
      pista: courts[bestCourt],
      hora: minutesToHHmm(config.horaInicio, start),
      inicioMin: start,
      finMin: fin,
    })
  }

  return matches.map((m) => {
    const a = assignments.get(m.id)
    return a ? { ...m, pista: a.pista, hora: a.hora } : m
  })
}

export interface Conflict {
  tipo: 'equipo_solapado' | 'pista_solapada' | 'descanso_insuficiente'
  matchIds: string[]
  mensaje: string
}

/**
 * Detect scheduling conflicts across a set of matches (possibly multi-category).
 * teamKey lets callers namespace team ids by category so different categories
 * that reuse ids don't collide.
 */
export function detectConflicts(
  matches: Match[],
  durMin: number,
  descansoMinimoEquipoMin = 0,
  teamKey: (m: Match, teamId: string) => string = (_m, t) => t,
): Conflict[] {
  const conflicts: Conflict[] = []
  const scheduled = matches.filter((m) => m.hora && m.pista && m.status !== 'cancelado')

  const interval = (m: Match) => {
    const start = hhmmToMinutes(m.hora!)
    return [start, start + durMin] as const
  }
  const overlaps = (a: readonly [number, number], b: readonly [number, number]) =>
    a[0] < b[1] && b[0] < a[1]

  for (let i = 0; i < scheduled.length; i++) {
    for (let j = i + 1; j < scheduled.length; j++) {
      const a = scheduled[i]
      const b = scheduled[j]
      const ia = interval(a)
      const ib = interval(b)
      // same court overlap
      if (a.pista === b.pista && overlaps(ia, ib)) {
        conflicts.push({
          tipo: 'pista_solapada',
          matchIds: [a.id, b.id],
          mensaje: `Dos partidos coinciden en ${a.pista} a las ${a.hora}.`,
        })
      }
      // shared team overlap
      const teamsA = [a.localId, b.visitanteId] // placeholder, replaced below
      void teamsA
      const aTeams = [a.localId, a.visitanteId].filter(Boolean).map((t) => teamKey(a, t as string))
      const bTeams = [b.localId, b.visitanteId].filter(Boolean).map((t) => teamKey(b, t as string))
      const shared = aTeams.filter((t) => bTeams.includes(t))
      if (shared.length > 0) {
        if (overlaps(ia, ib)) {
          conflicts.push({
            tipo: 'equipo_solapado',
            matchIds: [a.id, b.id],
            mensaje: `Un equipo tiene dos partidos a la vez (${a.hora} y ${b.hora}).`,
          })
        } else if (descansoMinimoEquipoMin > 0) {
          const gap = Math.abs(Math.min(ia[1], ib[1]) - Math.max(ia[0], ib[0]))
          const restGap =
            ia[0] < ib[0] ? ib[0] - ia[1] : ia[0] - ib[1]
          void gap
          if (restGap < descansoMinimoEquipoMin) {
            conflicts.push({
              tipo: 'descanso_insuficiente',
              matchIds: [a.id, b.id],
              mensaje: `Descanso insuficiente para un equipo entre ${a.hora} y ${b.hora}.`,
            })
          }
        }
      }
    }
  }
  return conflicts
}
