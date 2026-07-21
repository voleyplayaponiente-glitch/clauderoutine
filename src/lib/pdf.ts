import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Category, Tournament } from '@/types'
import { categoryStandings } from './category'
import { computeOutcome } from '@/engine/match'
import { PHASE_LABEL, PHASE_SHORT } from './labels'
import { champion } from '@/engine/bracket'
import { hhmmToMinutes } from '@/engine/schedule'

function header(doc: jsPDF, title: string, subtitle: string) {
  doc.setFontSize(18)
  doc.setTextColor(20)
  doc.text(title, 14, 18)
  doc.setFontSize(10)
  doc.setTextColor(120)
  doc.text(subtitle, 14, 25)
  doc.setDrawColor(220)
  doc.line(14, 28, doc.internal.pageSize.getWidth() - 14, 28)
}

function afterTableY(doc: jsPDF): number {
  return (doc as any).lastAutoTable?.finalY ?? 30
}

function teamName(cat: Category, id?: string): string {
  return cat.teams.find((t) => t.id === id)?.nombre ?? '—'
}

export function teamsPDF(t: Tournament, cat: Category): jsPDF {
  const doc = new jsPDF()
  header(doc, `Equipos · ${cat.nombre}`, t.nombre)
  const conSub = cat.teams.some((tm) => tm.subcategoria)
  autoTable(doc, {
    startY: 32,
    head: [['#', 'Equipo', 'Jugadores', ...(conSub ? ['Subcat.'] : []), 'Teléfono', 'Estado', 'Pago']],
    body: cat.teams.map((tm) => [
      tm.numero,
      tm.nombre,
      tm.jugadores.map((j) => j.nombre).filter(Boolean).join(' / '),
      ...(conSub ? [tm.subcategoria ?? ''] : []),
      tm.telefono ?? '',
      tm.estadoInscripcion,
      `${(tm.importePagado ?? 0).toFixed(0)} €`,
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [10, 132, 255] },
  })
  return doc
}

export function groupsPDF(t: Tournament, cat: Category): jsPDF {
  const doc = new jsPDF()
  header(doc, `Composición de grupos · ${cat.nombre}`, t.nombre)
  let y = 32
  cat.groups.forEach((g) => {
    autoTable(doc, {
      startY: y,
      head: [[g.nombre]],
      body: g.teamIds.map((id) => [teamName(cat, id)]),
      styles: { fontSize: 10 },
      headStyles: { fillColor: [10, 132, 255] },
      margin: { left: 14, right: 14 },
      tableWidth: 85,
    })
    y = afterTableY(doc) + 6
    if (y > 250) { doc.addPage(); y = 20 }
  })
  return doc
}

export function schedulePDF(t: Tournament, cats: Category[]): jsPDF {
  const doc = new jsPDF()
  header(doc, 'Horario de partidos', t.nombre)
  const rows: any[] = []
  cats.forEach((cat) =>
    cat.matches.filter((m) => m.hora).forEach((m) =>
      rows.push({
        hora: m.hora!,
        pista: m.pista ?? '',
        cat: cat.nombre,
        fase: PHASE_SHORT[m.phase],
        local: teamName(cat, m.localId) || m.localPlaceholder || '',
        visitante: teamName(cat, m.visitanteId) || m.visitantePlaceholder || '',
      }),
    ),
  )
  rows.sort((a, b) => hhmmToMinutes(a.hora) - hhmmToMinutes(b.hora) || a.pista.localeCompare(b.pista))
  autoTable(doc, {
    startY: 32,
    head: [['Hora', 'Pista', 'Cat.', 'Fase', 'Local', 'Visitante']],
    body: rows.map((r) => [r.hora, r.pista, r.cat, r.fase, r.local, r.visitante]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [10, 132, 255] },
  })
  return doc
}

export function standingsPDF(t: Tournament, cat: Category): jsPDF {
  const doc = new jsPDF()
  header(doc, `Clasificaciones · ${cat.nombre}`, t.nombre)
  let y = 32
  categoryStandings(cat).forEach(({ group, rows }) => {
    autoTable(doc, {
      startY: y,
      head: [[group.nombre, 'PJ', 'PG', 'PP', '±S', '±P']],
      body: rows.map((r) => [teamName(cat, r.teamId), r.jugados, r.ganados, r.perdidos, r.difSets, r.difPuntos]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [10, 132, 255] },
    })
    y = afterTableY(doc) + 6
    if (y > 250) { doc.addPage(); y = 20 }
  })
  return doc
}

export function resultsSheetPDF(t: Tournament, cat: Category): jsPDF {
  const doc = new jsPDF()
  header(doc, `Hoja de resultados · ${cat.nombre}`, t.nombre)
  autoTable(doc, {
    startY: 32,
    head: [['Nº', 'Fase', 'Local', 'Resultado', 'Visitante', 'Estado']],
    body: cat.matches.map((m) => {
      const o = computeOutcome(m, cat.config)
      const res = m.status === 'finalizado' && o.played ? `${o.localSets} - ${o.visitanteSets}` : '____'
      return [
        m.numero,
        PHASE_SHORT[m.phase],
        teamName(cat, m.localId) || m.localPlaceholder || '',
        res,
        teamName(cat, m.visitanteId) || m.visitantePlaceholder || '',
        m.status,
      ]
    }),
    styles: { fontSize: 8.5 },
    headStyles: { fillColor: [10, 132, 255] },
  })
  return doc
}

export function bracketPDF(t: Tournament, cat: Category): jsPDF {
  const doc = new jsPDF()
  header(doc, `Cuadro eliminatorio · ${cat.nombre}`, t.nombre)
  const phases = ['dieciseisavos', 'octavos', 'cuartos', 'semifinales', 'tercer_puesto', 'final'] as const
  let y = 32
  phases.forEach((p) => {
    const ms = cat.matches.filter((m) => m.phase === p).sort((a, b) => (a.bracketSlot ?? '').localeCompare(b.bracketSlot ?? ''))
    if (ms.length === 0) return
    autoTable(doc, {
      startY: y,
      head: [[PHASE_LABEL[p], 'Resultado']],
      body: ms.map((m) => {
        const o = computeOutcome(m, cat.config)
        const res = m.status === 'finalizado' && o.played ? `${o.localSets}-${o.visitanteSets}` : 'vs'
        const l = teamName(cat, m.localId) || m.localPlaceholder || ''
        const v = teamName(cat, m.visitanteId) || m.visitantePlaceholder || ''
        return [`${l}  —  ${v}`, res]
      }),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [10, 132, 255] },
    })
    y = afterTableY(doc) + 5
    if (y > 250) { doc.addPage(); y = 20 }
  })
  const champ = champion(cat.matches.filter((m) => m.phase !== 'grupos'), cat.config)
  if (champ) {
    doc.setFontSize(13)
    doc.setTextColor(20)
    doc.text(`Campeón: ${teamName(cat, champ)}`, 14, y + 6)
  }
  return doc
}

export function fullReportPDF(t: Tournament): jsPDF {
  const doc = new jsPDF()
  header(doc, t.nombre, [t.lugar, t.fecha].filter(Boolean).join(' · ') || 'Informe completo del torneo')
  let first = true
  t.categories.forEach((cat) => {
    if (!first) doc.addPage()
    first = false
    doc.setFontSize(15)
    doc.setTextColor(cat.color)
    doc.text(cat.nombre, 14, 40)
    autoTable(doc, {
      startY: 44,
      head: [['Grupo', 'Equipos']],
      body: cat.groups.map((g) => [g.nombre, g.teamIds.map((id) => teamName(cat, id)).join(', ')]),
      styles: { fontSize: 9 }, headStyles: { fillColor: [10, 132, 255] },
    })
    let y = afterTableY(doc) + 6
    categoryStandings(cat).forEach(({ group, rows }) => {
      autoTable(doc, {
        startY: y,
        head: [[`${group.nombre}`, 'PJ', 'PG', 'PP', '±S', '±P']],
        body: rows.map((r) => [teamName(cat, r.teamId), r.jugados, r.ganados, r.perdidos, r.difSets, r.difPuntos]),
        styles: { fontSize: 8.5 }, headStyles: { fillColor: [40, 40, 40] },
      })
      y = afterTableY(doc) + 4
      if (y > 250) { doc.addPage(); y = 20 }
    })
    const champ = champion(cat.matches.filter((m) => m.phase !== 'grupos'), cat.config)
    if (champ) {
      doc.setFontSize(12); doc.setTextColor(20)
      doc.text(`🏆 Campeón ${cat.nombre}: ${teamName(cat, champ)}`, 14, y + 6)
    }
  })
  return doc
}
