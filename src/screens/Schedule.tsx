import { useState } from 'react'
import { useStore, useActiveCategory } from '@/store/store'
import { Card, PageHeader, Field, useToast, useConfirm } from '@/components/ui'
import { IconCalendar, IconWarning } from '@/components/icons'
import { RequireTournament } from '@/components/Guards'
import { detectConflicts, hhmmToMinutes } from '@/engine/schedule'
import { teamLabel } from '@/components/MatchResult'
import { PHASE_SHORT } from '@/lib/labels'
import type { Category, Match, Tournament } from '@/types'

export function Schedule() {
  const setSchedule = useStore((s) => s.setSchedule)
  const generateScheduleFor = useStore((s) => s.generateScheduleFor)
  const updateMatch = useStore((s) => s.updateMatch)
  const activeCat = useActiveCategory()
  const toast = useToast()
  const confirm = useConfirm()
  const [view, setView] = useState<'categoria' | 'general'>('general')

  return (
    <RequireTournament>
      {(t) => {
        const sc = t.schedule
        const setSc = (patch: Partial<typeof sc>) => setSchedule(t.id, { ...sc, ...patch })

        // gather matches with category info
        const rows: { m: Match; cat: Category }[] = []
        const cats = view === 'general' ? t.categories : t.categories.filter((c) => c.id === activeCat?.id)
        cats.forEach((c) => c.matches.forEach((m) => { if (m.hora && m.status !== 'cancelado') rows.push({ m, cat: c }) }))
        rows.sort((x, y) => {
          const ha = hhmmToMinutes(x.m.hora!) - hhmmToMinutes(y.m.hora!)
          if (ha !== 0) return ha
          return (x.m.pista ?? '').localeCompare(y.m.pista ?? '')
        })

        // conflicts across the visible set (namespace teams by category)
        const allMatches = cats.flatMap((c) => c.matches.map((m) => ({ ...m, __cat: c.id })))
        const conflicts = detectConflicts(allMatches as Match[], sc.duracionPartidoMin, sc.descansoMinimoEquipoMin, (m: any, teamId) => `${m.__cat}:${teamId}`)
        const conflictIds = new Set(conflicts.flatMap((c) => c.matchIds))

        return (
          <>
            <PageHeader
              title="Calendario de partidos"
              subtitle="Asignación de pistas y horarios. Vista general de todas las categorías."
              actions={
                <>
                  <button className="btn btn-ghost" onClick={() => generateScheduleFor(t.id, activeCat?.id)}>Generar (categoría)</button>
                  <button className="btn btn-primary" onClick={async () => {
                    const ok = await confirm({ title: 'Generar horario completo', message: 'Se reasignarán pistas y horas a todos los partidos de todas las categorías. ¿Continuar?', confirmLabel: 'Generar' })
                    if (ok) { generateScheduleFor(t.id); toast('Horario generado') }
                  }}><IconCalendar size={18} /> Generar todo</button>
                </>
              }
            />

            <Card className="mb-4">
              <h3 className="font-bold mb-3">Parámetros del horario</h3>
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                <Field label="Hora de inicio"><input className="input" type="time" value={sc.horaInicio} onChange={(e) => setSc({ horaInicio: e.target.value })} /></Field>
                <Field label="Duración (min)"><input className="input" type="number" min={5} value={sc.duracionPartidoMin} onChange={(e) => setSc({ duracionPartidoMin: Number(e.target.value) })} /></Field>
                <Field label="Descanso entre partidos (min)"><input className="input" type="number" min={0} value={sc.descansoEntrePartidosMin} onChange={(e) => setSc({ descansoEntrePartidosMin: Number(e.target.value) })} /></Field>
                <Field label="Descanso mínimo por equipo (min)"><input className="input" type="number" min={0} value={sc.descansoMinimoEquipoMin} onChange={(e) => setSc({ descansoMinimoEquipoMin: Number(e.target.value) })} /></Field>
                <Field label="Número de pistas">
                  <input className="input" type="number" min={1} value={sc.numPistas} onChange={(e) => {
                    const n = Math.max(1, Number(e.target.value))
                    const nombres = Array.from({ length: n }, (_, i) => sc.nombresPistas[i] ?? `Pista ${i + 1}`)
                    setSc({ numPistas: n, nombresPistas: nombres })
                  }} />
                </Field>
              </div>
            </Card>

            <div className="flex gap-2 mb-3 no-print">
              <button className={`btn ${view === 'general' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('general')}>Vista general</button>
              <button className={`btn ${view === 'categoria' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setView('categoria')}>Solo categoría activa</button>
            </div>

            {conflicts.length > 0 && (
              <Card className="mb-3" style={{ borderColor: '#ff3b3055' }}>
                <div className="flex items-center gap-2 font-bold mb-2" style={{ color: '#ff3b30' }}><IconWarning size={18} /> {conflicts.length} conflicto(s) detectado(s)</div>
                <ul className="text-sm text-muted" style={{ listStyle: 'disc', paddingLeft: 20 }}>
                  {conflicts.slice(0, 8).map((c, i) => <li key={i}>{c.mensaje}</li>)}
                </ul>
              </Card>
            )}

            {rows.length === 0 ? (
              <Card className="text-center text-muted py-10">No hay partidos con horario. Pulsa «Generar todo».</Card>
            ) : (
              <div className="card p-0 overflow-hidden">
                <div className="scroll-x">
                  <table className="w-full text-sm" style={{ borderCollapse: 'collapse', minWidth: 720 }}>
                    <thead>
                      <tr className="surface-2 text-muted text-left">
                        <th className="px-3 py-2">Hora</th>
                        <th className="px-3 py-2">Pista</th>
                        <th className="px-3 py-2">Cat.</th>
                        <th className="px-3 py-2">Fase</th>
                        <th className="px-3 py-2">Partido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ m, cat }) => {
                        const conflict = conflictIds.has(m.id)
                        return (
                          <tr key={`${cat.id}-${m.id}`} style={{ borderTop: '1px solid var(--border)', background: conflict ? '#ff3b3010' : 'transparent' }}>
                            <td className="px-3 py-2">
                              <input className="input" style={{ width: 100, padding: '4px 8px' }} type="time" value={m.hora ?? ''} onChange={(e) => updateMatch(t.id, cat.id, { ...m, hora: e.target.value })} />
                            </td>
                            <td className="px-3 py-2">
                              <select className="input" style={{ width: 110, padding: '4px 8px' }} value={m.pista ?? ''} onChange={(e) => updateMatch(t.id, cat.id, { ...m, pista: e.target.value })}>
                                <option value="">—</option>
                                {sc.nombresPistas.map((p) => <option key={p} value={p}>{p}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <span className="chip" style={{ background: cat.color + '22', color: cat.color }}>{cat.nombre}</span>
                            </td>
                            <td className="px-3 py-2 text-muted">{PHASE_SHORT[m.phase]}</td>
                            <td className="px-3 py-2 font-medium flex items-center gap-1.5">
                              {conflict && <IconWarning size={14} style={{ color: '#ff3b30' }} />}
                              {teamLabel(cat, m, 'local')} <span className="text-muted">vs</span> {teamLabel(cat, m, 'visitante')}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )
      }}
    </RequireTournament>
  )
}

export type { Tournament }
