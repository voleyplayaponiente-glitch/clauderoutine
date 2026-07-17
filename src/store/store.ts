import { create } from 'zustand'
import type {
  Category,
  CompetitionConfig,
  Match,
  ScheduleConfig,
  Team,
  Tournament,
} from '@/types'
import { loadState, saveState, PersistedState } from '@/lib/persist'
import { newCategory, newTournament } from '@/lib/factory'
import { generateCategoryDraw, refreshCategory } from '@/lib/category'
import { generateSchedule } from '@/engine/schedule'
import type { DrawOptions } from '@/engine/groups'

export type Role = 'admin' | 'public'
export type Theme = 'light' | 'dark'

interface State {
  tournaments: Tournament[]
  activeTournamentId: string | null
  activeCategoryId: string | null
  role: Role
  theme: Theme
  loaded: boolean

  init: () => Promise<void>
  setRole: (r: Role) => void
  toggleTheme: () => void
  setActiveTournament: (id: string | null) => void
  setActiveCategory: (id: string | null) => void

  createTournament: (nombre: string) => string
  importTournament: (t: Tournament) => void
  updateTournament: (id: string, patch: Partial<Tournament>) => void
  deleteTournament: (id: string) => void

  addCategory: (tournamentId: string, nombre: string, numEquipos: 8 | 16 | 32) => void
  updateCategory: (tournamentId: string, categoryId: string, patch: Partial<Category>) => void
  updateCategoryConfig: (tournamentId: string, categoryId: string, config: CompetitionConfig) => void
  deleteCategory: (tournamentId: string, categoryId: string) => void

  setTeams: (tournamentId: string, categoryId: string, teams: Team[]) => void
  generateDraw: (tournamentId: string, categoryId: string, draw?: DrawOptions) => void

  saveMatchResult: (tournamentId: string, categoryId: string, match: Match) => void
  updateMatch: (tournamentId: string, categoryId: string, match: Match) => void

  setSchedule: (tournamentId: string, schedule: ScheduleConfig) => void
  generateScheduleFor: (tournamentId: string, categoryId?: string) => void

  replaceAll: (state: PersistedState) => void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

function persist(get: () => State) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const { tournaments, activeTournamentId } = get()
    void saveState({ tournaments, activeTournamentId })
  }, 250)
}

export const useStore = create<State>((set, get) => {
  const mutateCategory = (
    tournamentId: string,
    categoryId: string,
    fn: (c: Category, t: Tournament) => Category,
  ) => {
    set((s) => ({
      tournaments: s.tournaments.map((t) =>
        t.id !== tournamentId
          ? t
          : {
              ...t,
              updatedAt: Date.now(),
              categories: t.categories.map((c) => (c.id === categoryId ? fn(c, t) : c)),
            },
      ),
    }))
    persist(get)
  }

  return {
    tournaments: [],
    activeTournamentId: null,
    activeCategoryId: null,
    role: 'admin',
    theme: (typeof localStorage !== 'undefined' && (localStorage.getItem('theme') as Theme)) || 'light',
    loaded: false,

    init: async () => {
      const data = await loadState()
      set({
        tournaments: data?.tournaments ?? [],
        activeTournamentId: data?.activeTournamentId ?? data?.tournaments?.[0]?.id ?? null,
        activeCategoryId: data?.tournaments?.[0]?.categories?.[0]?.id ?? null,
        loaded: true,
      })
    },

    setRole: (role) => set({ role }),
    toggleTheme: () =>
      set((s) => {
        const theme = s.theme === 'light' ? 'dark' : 'light'
        try {
          localStorage.setItem('theme', theme)
        } catch {
          /* ignore */
        }
        return { theme }
      }),
    setActiveTournament: (id) => {
      const t = get().tournaments.find((x) => x.id === id)
      set({ activeTournamentId: id, activeCategoryId: t?.categories[0]?.id ?? null })
    },
    setActiveCategory: (id) => set({ activeCategoryId: id }),

    createTournament: (nombre) => {
      const t = newTournament(nombre)
      set((s) => ({
        tournaments: [...s.tournaments, t],
        activeTournamentId: t.id,
        activeCategoryId: t.categories[0]?.id ?? null,
      }))
      persist(get)
      return t.id
    },

    importTournament: (t) => {
      set((s) => ({
        tournaments: [...s.tournaments, t],
        activeTournamentId: t.id,
        activeCategoryId: t.categories[0]?.id ?? null,
      }))
      persist(get)
    },

    updateTournament: (id, patch) => {
      set((s) => ({
        tournaments: s.tournaments.map((t) =>
          t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t,
        ),
      }))
      persist(get)
    },

    deleteTournament: (id) => {
      set((s) => {
        const tournaments = s.tournaments.filter((t) => t.id !== id)
        return {
          tournaments,
          activeTournamentId:
            s.activeTournamentId === id ? tournaments[0]?.id ?? null : s.activeTournamentId,
          activeCategoryId: tournaments[0]?.categories[0]?.id ?? null,
        }
      })
      persist(get)
    },

    addCategory: (tournamentId, nombre, numEquipos) => {
      set((s) => ({
        tournaments: s.tournaments.map((t) => {
          if (t.id !== tournamentId) return t
          const cat = newCategory(nombre, t.categories.length, numEquipos)
          return { ...t, categories: [...t.categories, cat], updatedAt: Date.now() }
        }),
      }))
      persist(get)
    },

    updateCategory: (tournamentId, categoryId, patch) =>
      mutateCategory(tournamentId, categoryId, (c) => ({ ...c, ...patch })),

    updateCategoryConfig: (tournamentId, categoryId, config) =>
      mutateCategory(tournamentId, categoryId, (c) => {
        // if the draw already exists and structural values changed, we keep teams
        // but the admin must regenerate the draw for structural changes to apply
        return { ...c, config }
      }),

    deleteCategory: (tournamentId, categoryId) => {
      set((s) => ({
        tournaments: s.tournaments.map((t) =>
          t.id !== tournamentId
            ? t
            : { ...t, categories: t.categories.filter((c) => c.id !== categoryId) },
        ),
      }))
      persist(get)
    },

    setTeams: (tournamentId, categoryId, teams) =>
      mutateCategory(tournamentId, categoryId, (c) => ({ ...c, teams })),

    generateDraw: (tournamentId, categoryId, draw) =>
      mutateCategory(tournamentId, categoryId, (c) => generateCategoryDraw(c, draw)),

    saveMatchResult: (tournamentId, categoryId, match) =>
      mutateCategory(tournamentId, categoryId, (c) => {
        const matches = c.matches.map((m) => (m.id === match.id ? match : m))
        return refreshCategory({ ...c, matches })
      }),

    updateMatch: (tournamentId, categoryId, match) =>
      mutateCategory(tournamentId, categoryId, (c) => {
        const matches = c.matches.map((m) => (m.id === match.id ? match : m))
        return refreshCategory({ ...c, matches })
      }),

    setSchedule: (tournamentId, schedule) => {
      set((s) => ({
        tournaments: s.tournaments.map((t) =>
          t.id === tournamentId ? { ...t, schedule, updatedAt: Date.now() } : t,
        ),
      }))
      persist(get)
    },

    generateScheduleFor: (tournamentId, categoryId) => {
      set((s) => ({
        tournaments: s.tournaments.map((t) => {
          if (t.id !== tournamentId) return t
          return {
            ...t,
            updatedAt: Date.now(),
            categories: t.categories.map((c) =>
              categoryId && c.id !== categoryId
                ? c
                : { ...c, matches: generateSchedule(c.matches, t.schedule) },
            ),
          }
        }),
      }))
      persist(get)
    },

    replaceAll: (state) => {
      set({
        tournaments: state.tournaments,
        activeTournamentId: state.activeTournamentId ?? state.tournaments[0]?.id ?? null,
        activeCategoryId: state.tournaments[0]?.categories[0]?.id ?? null,
      })
      persist(get)
    },
  }
})

export function useActiveTournament(): Tournament | undefined {
  return useStore((s) => s.tournaments.find((t) => t.id === s.activeTournamentId))
}

export function useActiveCategory(): Category | undefined {
  return useStore((s) => {
    const t = s.tournaments.find((x) => x.id === s.activeTournamentId)
    return t?.categories.find((c) => c.id === s.activeCategoryId) ?? t?.categories[0]
  })
}
