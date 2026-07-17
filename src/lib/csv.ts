import type { Team } from '@/types'
import { uid } from '@/engine/id'

export function teamsToCSV(teams: Team[]): string {
  const header = ['Numero', 'Equipo', 'Jugador1', 'Jugador2', 'Telefono', 'CabezaSerie', 'Estado', 'ImportePagado', 'Observaciones']
  const rows = teams.map((t) => [
    t.numero,
    t.nombre,
    t.jugadores[0]?.nombre ?? '',
    t.jugadores[1]?.nombre ?? '',
    t.telefono ?? '',
    t.cabezaSerie ? 'Si' : 'No',
    t.estadoInscripcion,
    t.importePagado ?? 0,
    (t.observaciones ?? '').replace(/[\n\r;]/g, ' '),
  ])
  return [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\n')
}

function csvCell(v: unknown): string {
  const s = String(v ?? '')
  if (s.includes(';') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function parseLine(line: string, delim: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') inQuotes = false
      else cur += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === delim) { out.push(cur); cur = '' }
    else cur += ch
  }
  out.push(cur)
  return out
}

export function csvToTeams(text: string, startNumero = 1): Team[] {
  const clean = text.replace(/\r/g, '').trim()
  if (!clean) return []
  const lines = clean.split('\n')
  const delim = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ';' : ','
  // detect header
  const first = parseLine(lines[0], delim).map((c) => c.toLowerCase())
  const hasHeader = first.some((c) => /equipo|nombre|jugador|numero/.test(c))
  const dataLines = hasHeader ? lines.slice(1) : lines
  return dataLines
    .filter((l) => l.trim())
    .map((line, i) => {
      const cols = parseLine(line, delim)
      // flexible: if first col is a number treat as numero
      let idx = 0
      let numero = startNumero + i
      if (/^\d+$/.test(cols[0]?.trim() ?? '')) { numero = Number(cols[0]); idx = 1 }
      const nombre = cols[idx]?.trim() || `Equipo ${numero}`
      const j1 = cols[idx + 1]?.trim() ?? ''
      const j2 = cols[idx + 2]?.trim() ?? ''
      const telefono = cols[idx + 3]?.trim() ?? ''
      const seed = /^(si|sí|1|true|x)$/i.test(cols[idx + 4]?.trim() ?? '')
      const estado = (cols[idx + 5]?.trim() as Team['estadoInscripcion']) || 'inscrito'
      const importe = Number(cols[idx + 6]) || 0
      return {
        id: uid('t'),
        numero,
        nombre,
        jugadores: [
          { id: uid('p'), nombre: j1 },
          { id: uid('p'), nombre: j2 },
        ],
        telefono,
        cabezaSerie: seed,
        estadoInscripcion: ['inscrito', 'pendiente', 'confirmado', 'baja'].includes(estado) ? estado : 'inscrito',
        importePagado: importe,
        observaciones: cols[idx + 7]?.trim() ?? '',
      } as Team
    })
}

export function downloadText(filename: string, text: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
