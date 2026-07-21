import type { Team } from '@/types'
import { uid } from '@/engine/id'

export function teamsToCSV(teams: Team[]): string {
  const header = ['Numero', 'Equipo', 'Jugador1', 'Jugador2', 'Jugador3', 'Jugador4', 'Jugador5', 'Telefono', 'CabezaSerie', 'Estado', 'ImportePagado', 'Observaciones']
  const rows = teams.map((t) => [
    t.numero,
    t.nombre,
    t.jugadores[0]?.nombre ?? '',
    t.jugadores[1]?.nombre ?? '',
    t.jugadores[2]?.nombre ?? '',
    t.jugadores[3]?.nombre ?? '',
    t.jugadores[4]?.nombre ?? '',
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
  const headerCells = parseLine(lines[0], delim).map((c) => c.trim().toLowerCase())
  const hasHeader = headerCells.some((c) => /equipo|nombre|jugador|numero/.test(c))
  const dataLines = hasHeader ? lines.slice(1) : lines

  // header-aware column index lookup (robust to old 2-player and new 5-player exports)
  const colIndex = (matcher: (h: string) => boolean): number =>
    hasHeader ? headerCells.findIndex(matcher) : -1

  const valid: Team['estadoInscripcion'][] = ['inscrito', 'pendiente', 'confirmado', 'baja']

  return dataLines
    .filter((l) => l.trim())
    .map((line, i) => {
      const cols = parseLine(line, delim)

      if (hasHeader) {
        const at = (idx: number) => (idx >= 0 ? cols[idx]?.trim() ?? '' : '')
        const numCol = colIndex((h) => /numero|nº|num/.test(h))
        const numeroRaw = at(numCol)
        const numero = /^\d+$/.test(numeroRaw) ? Number(numeroRaw) : startNumero + i
        const nombre = at(colIndex((h) => /equipo|nombre/.test(h) && !/jugador/.test(h))) || `Equipo ${numero}`
        const jugadores = Array.from({ length: 5 }, (_, p) => ({
          id: uid('p'),
          nombre: at(colIndex((h) => h === `jugador${p + 1}` || h === `jugador ${p + 1}`)),
        }))
        const estadoRaw = at(colIndex((h) => /estado/.test(h))) as Team['estadoInscripcion']
        return {
          id: uid('t'),
          numero,
          nombre,
          jugadores,
          telefono: at(colIndex((h) => /tel|fono|phone/.test(h))),
          cabezaSerie: /^(si|sí|1|true|x)$/i.test(at(colIndex((h) => /serie|seed|cabeza/.test(h)))),
          estadoInscripcion: valid.includes(estadoRaw) ? estadoRaw : 'inscrito',
          importePagado: Number(at(colIndex((h) => /importe|pago|pagado/.test(h)))) || 0,
          observaciones: at(colIndex((h) => /observ|nota/.test(h))),
        } as Team
      }

      // no header: positional layout matching the current export order
      // Numero;Equipo;Jugador1..5;Telefono;CabezaSerie;Estado;Importe;Observaciones
      let idx = 0
      let numero = startNumero + i
      if (/^\d+$/.test(cols[0]?.trim() ?? '')) { numero = Number(cols[0]); idx = 1 }
      const nombre = cols[idx]?.trim() || `Equipo ${numero}`
      const jugadores = Array.from({ length: 5 }, (_, p) => ({ id: uid('p'), nombre: cols[idx + 1 + p]?.trim() ?? '' }))
      const estado = (cols[idx + 8]?.trim() as Team['estadoInscripcion']) || 'inscrito'
      return {
        id: uid('t'),
        numero,
        nombre,
        jugadores,
        telefono: cols[idx + 6]?.trim() ?? '',
        cabezaSerie: /^(si|sí|1|true|x)$/i.test(cols[idx + 7]?.trim() ?? ''),
        estadoInscripcion: valid.includes(estado) ? estado : 'inscrito',
        importePagado: Number(cols[idx + 9]) || 0,
        observaciones: cols[idx + 10]?.trim() ?? '',
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
