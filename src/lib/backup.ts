import type { Tournament } from '@/types'
import type { PersistedState } from './persist'

export interface BackupFile {
  app: 'voley-torneos'
  version: 1
  exportedAt: number
  tournaments: Tournament[]
}

export function makeBackup(tournaments: Tournament[]): BackupFile {
  return { app: 'voley-torneos', version: 1, exportedAt: safeNow(), tournaments }
}

export function parseBackup(text: string): Tournament[] {
  const data = JSON.parse(text)
  if (data && data.app === 'voley-torneos' && Array.isArray(data.tournaments)) {
    return data.tournaments as Tournament[]
  }
  // also accept a raw persisted state or plain array
  if (Array.isArray(data)) return data as Tournament[]
  if (data && Array.isArray((data as PersistedState).tournaments)) return (data as PersistedState).tournaments
  throw new Error('El archivo no es una copia de seguridad válida.')
}

export function downloadJSON(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function safeNow(): number {
  try { return Date.now() } catch { return 0 }
}
