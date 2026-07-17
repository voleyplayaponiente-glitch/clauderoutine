import { useState } from 'react'
import { useStore } from '@/store/store'
import { PageHeader, Select } from '@/components/ui'
import { RequireCategory } from '@/components/Guards'
import { MatchResultModal, teamLabel } from '@/components/MatchResult'
import { computeOutcome } from '@/engine/match'
import { PHASE_LABEL, STATUS_LABEL, STATUS_COLOR } from '@/lib/labels'
import type { Category, Match, Phase } from '@/types'

const PHASE_SEQ: Phase[] = ['grupos', 'dieciseisavos', 'octavos', 'cuartos', 'semifinales', 'tercer_puesto', 'final']

export function Results() {
  const [phaseFilter, setPhaseFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [editing, setEditing] = useState<Match | null>(null)

  return (
    <RequireCategory>
      {(t, cat) => {
        const phases = PHASE_SEQ.filter((p) => cat.matches.some((m) => m.phase === p))
        let matches = [...cat.matches]
        if (phaseFilter !== 'all') matches = matches.filter((m) => m.phase === phaseFilter)
        if (statusFilter !== 'all') matches = matches.filter((m) => m.status === statusFilter)
        matches.sort((a, b) => a.numero - b.numero)

        const byGroup = (m: Match) => (m.grupoId ? cat.groups.find((g) => g.id === m.grupoId)?.nombre : PHASE_LABEL[m.phase])

        return (
          <>
            <PageHeader
              title={`Resultados · ${cat.nombre}`}
              subtitle="Introduce y corrige los resultados. Los cambios recalculan la clasificación y el cuadro."
              actions={
                <>
                  <Select value={phaseFilter} onChange={setPhaseFilter} options={[{ value: 'all', label: 'Todas las fases' }, ...phases.map((p) => ({ value: p, label: PHASE_LABEL[p] }))]} />
                  <Select value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'Todos los estados' }, ...(['pendiente', 'finalizado', 'aplazado', 'cancelado'] as const).map((s) => ({ value: s, label: STATUS_LABEL[s] }))]} />
                </>
              }
            />

            {cat.matches.length === 0 ? (
              <div className="card text-center text-muted py-10">Genera primero los grupos en «Sorteo y grupos».</div>
            ) : (
              <div className="flex flex-col gap-2">
                {matches.map((m) => (
                  <MatchRow key={m.id} cat={cat} m={m} groupName={byGroup(m)} onClick={() => setEditing(m)} />
                ))}
              </div>
            )}

            {editing && <MatchResultModal tournamentId={t.id} cat={cat} match={cat.matches.find((x) => x.id === editing.id) ?? editing} onClose={() => setEditing(null)} />}
          </>
        )
      }}
    </RequireCategory>
  )
}

export function MatchRow({ cat, m, groupName, onClick }: { cat: Category; m: Match; groupName?: string; onClick: () => void }) {
  const o = computeOutcome(m, cat.config)
  const finished = m.status === 'finalizado' && o.played
  const local = teamLabel(cat, m, 'local')
  const visitante = teamLabel(cat, m, 'visitante')
  return (
    <button onClick={onClick} className="card" style={{ padding: '12px 16px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ minWidth: 44 }} className="text-muted text-sm font-semibold">
        Nº{m.numero}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="flex items-center gap-2" style={{ fontWeight: 600 }}>
          <span className={finished && o.winnerId === m.localId ? 'font-bold' : ''} style={{ opacity: finished && o.winnerId !== m.localId ? 0.6 : 1 }}>{local}</span>
          <span className="text-muted">·</span>
          <span className={finished && o.winnerId === m.visitanteId ? 'font-bold' : ''} style={{ opacity: finished && o.winnerId !== m.visitanteId ? 0.6 : 1 }}>{visitante}</span>
        </div>
        <div className="text-muted" style={{ fontSize: 12, marginTop: 2 }}>
          {groupName} {m.pista ? `· ${m.pista}` : ''} {m.hora ? `· ${m.hora}` : ''}
        </div>
      </div>
      {finished ? (
        <div className="text-right">
          <div style={{ fontWeight: 800, fontSize: 18 }}>{o.localSets}–{o.visitanteSets}</div>
          <div className="text-muted" style={{ fontSize: 11 }}>{m.sets.map((s) => `${s.local}-${s.visitante}`).join(' ')}</div>
        </div>
      ) : (
        <span className="chip" style={{ background: STATUS_COLOR[m.status] + '22', color: STATUS_COLOR[m.status] }}>{STATUS_LABEL[m.status]}</span>
      )}
    </button>
  )
}
