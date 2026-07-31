import { get, set, del } from 'idb-keyval'
import type { Tournament } from '@/types'

const KEY = 'voley-torneos-db-v1'

export interface PersistedState {
  tournaments: Tournament[]
  activeTournamentId: string | null
}

export async function loadState(): Promise<PersistedState | null> {
  try {
    const data = await get<PersistedState>(KEY)
    return data ?? null
  } catch {
    // fallback to localStorage
    try {
      const raw = localStorage.getItem(KEY)
      return raw ? (JSON.parse(raw) as PersistedState) : null
    } catch {
      return null
    }
  }
}

export async function saveState(state: PersistedState): Promise<void> {
  try {
    await set(KEY, state)
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

export async function clearState(): Promise<void> {
  try {
    await del(KEY)
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
