import type { Category, Match } from '@/types'
import { generateGroups, type DrawOptions } from '@/engine/groups'
import { generateGroupMatches } from '@/engine/fixtures'
import { generateBracket, resolveBracket } from '@/engine/bracket'
import { computeStandings } from '@/engine/standings'

/** Regenerate groups + group fixtures + empty bracket for a category. */
export function generateCategoryDraw(cat: Category, draw: DrawOptions = {}): Category {
  const groups = generateGroups(cat.teams, cat.config, draw)
  const groupMatches = generateGroupMatches(groups, cat.config, 1)
  const bracket = generateBracket(cat.config, groupMatches.length + 1)
  return {
    ...cat,
    groups,
    matches: [...groupMatches, ...bracket],
    manualTiebreaks: {},
  }
}

/** Split matches into group and knockout. */
export function splitMatches(cat: Category): { group: Match[]; bracket: Match[] } {
  return {
    group: cat.matches.filter((m) => m.phase === 'grupos'),
    bracket: cat.matches.filter((m) => m.phase !== 'grupos'),
  }
}

/** Recompute bracket team references after any result change. Returns updated category. */
export function refreshCategory(cat: Category): Category {
  const { group, bracket } = splitMatches(cat)
  if (bracket.length === 0) return cat
  const resolved = resolveBracket(bracket, cat.groups, group, cat.config, cat.manualTiebreaks)
  return { ...cat, matches: [...group, ...resolved] }
}

export function categoryStandings(cat: Category) {
  const { group } = splitMatches(cat)
  return cat.groups.map((g) => ({
    group: g,
    rows: computeStandings(g, group, cat.config, cat.manualTiebreaks),
  }))
}

/** Whether all group matches have a final result. */
export function groupsComplete(cat: Category): boolean {
  const { group } = splitMatches(cat)
  return group.length > 0 && group.every((m) => m.status === 'finalizado')
}
