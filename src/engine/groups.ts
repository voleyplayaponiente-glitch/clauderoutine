import type { CompetitionConfig, Group, Team } from '@/types'
import { uid } from './id'

const LETTERS = 'ABCDEFGHIJKLMNOP'

export function groupLabel(i: number): string {
  return `Grupo ${LETTERS[i] ?? i + 1}`
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export interface DrawOptions {
  /** pairs of team ids that must not share a group */
  keepApart?: [string, string][]
}

/**
 * Distribute teams into groups.
 * - Seeds (cabezaSerie) are spread across groups by seedRank using serpentine order.
 * - Remaining teams are drawn (random if config.sorteoAutomatico) respecting keepApart.
 * Pure apart from Math.random when auto draw is on.
 */
export function generateGroups(
  teams: Team[],
  config: CompetitionConfig,
  options: DrawOptions = {},
): Group[] {
  const numGrupos = config.numGrupos
  const groups: Group[] = Array.from({ length: numGrupos }, (_, i) => ({
    id: uid('grp'),
    nombre: groupLabel(i),
    teamIds: [],
  }))

  const keepApart = options.keepApart ?? []
  const conflicts = (teamId: string, group: Group): boolean =>
    keepApart.some(
      ([a, b]) =>
        (a === teamId && group.teamIds.includes(b)) ||
        (b === teamId && group.teamIds.includes(a)),
    )

  const capacity = config.equiposPorGrupo

  // 1. Place seeds first, one per group by rank (serpentine so pot balance holds)
  const seeds = teams
    .filter((t) => config.usarCabezasSerie && t.cabezaSerie)
    .sort((a, b) => (a.seedRank ?? 99) - (b.seedRank ?? 99))

  seeds.forEach((team, idx) => {
    const round = Math.floor(idx / numGrupos)
    const posInRound = idx % numGrupos
    const gi = round % 2 === 0 ? posInRound : numGrupos - 1 - posInRound
    if (groups[gi].teamIds.length < capacity) groups[gi].teamIds.push(team.id)
    else {
      const target = groups.find((g) => g.teamIds.length < capacity)
      target?.teamIds.push(team.id)
    }
  })

  // 2. Remaining teams
  const seedIds = new Set(seeds.map((s) => s.id))
  let rest = teams.filter((t) => !seedIds.has(t.id))
  if (config.sorteoAutomatico) rest = shuffle(rest)

  for (const team of rest) {
    // pick the least-filled group without conflict
    const candidates = groups
      .filter((g) => g.teamIds.length < capacity && !conflicts(team.id, g))
      .sort((a, b) => a.teamIds.length - b.teamIds.length)
    const target = candidates[0] ?? groups.filter((g) => g.teamIds.length < capacity)[0]
    if (target) target.teamIds.push(team.id)
  }

  return groups
}
