import { useState } from 'react'
import type { Category, Match, MatchStatus, SetResult } from '@/types'
import { Modal, Field, Select, useConfirm } from './ui'
import { validateSet, computeOutcome, setsToWin } from '@/engine/match'
import { STATUS_LABEL } from '@/lib/labels'
import { useStore } from '@/store/store'

const STATUSES: MatchStatus[] = ['pendiente', 'en_juego', 'finalizado', 'aplazado', 'cancelado']

export function teamLabel(cat: Category, m: Match, side: 'local' | 'visitante'): string {
  const id = side === 'local' ? m.localId : m.visitanteId
  if (id) return cat.teams.find((t) => t.id === id)?.nombre ?? '¿?'
  return (side === 'local' ? m.localPlaceholder : m.visitantePlaceholder) ?? 'Por definir'
}

export function MatchResultModal({
  tournamentId,
  cat,
  match,
  onClose,
}: {
  tournamentId: string
  cat: Category
  match: Match
  onClose: () => void
}) {
  const saveMatchResult = useStore((s) => s.saveMatchResult)
  const confirm = useConfirm()
  const [sets, setSets] = useState<SetResult[]>(match.sets.length ? match.sets : [{ local: 0, visitante: 0 }])
  const [status, setStatus] = useState<MatchStatus>(match.status)
  const [pista, setPista] = useState(match.pista ?? '')
  const [hora, setHora] = useState(match.hora ?? '')
  const [obs, setObs] = useState(match.observaciones ?? '')
  const [errors, setErrors] = useState<(string | null)[]>([])

  const maxSets = setsToWin(cat.config) * 2 - 1
  const local = teamLabel(cat, match, 'local')
  const visitante = teamLabel(cat, match, 'visitante')

  const setSet = (i: number, side: 'local' | 'visitante', value: number) => {
    const next = sets.map((s, j) => (j === i ? { ...s, [side]: value } : s))
    setSets(next)
  }
  const addSet = () => { if (sets.length < maxSets) setSets([...sets, { local: 0, visitante: 0 }]) }
  const removeSet = (i: number) => setSets(sets.filter((_, j) => j !== i))

  const save = async () => {
    let cleaned = sets.filter((s) => s.local !== 0 || s.visitante !== 0)
    // validate only when finished
    if (status === 'finalizado') {
      const errs = cleaned.map((s, i) => validateSet(s, cat.config, i === maxSets - 1))
      if (errs.some(Boolean)) { setErrors(errs); return }
      const outcome = computeOutcome({ ...match, sets: cleaned }, { ...cat.config })
      if (!outcome.winnerId && (match.localId && match.visitanteId)) {
        setErrors(['El resultado no determina un ganador. Revisa los sets.'])
        return
      }
    }

    // warn if editing a finished bracket match that already fed later rounds
    if (match.phase !== 'grupos' && match.winnerTo && match.status === 'finalizado' && status === 'finalizado') {
      const prevWinner = computeOutcome(match, cat.config).winnerId
      const newWinner = computeOutcome({ ...match, sets: cleaned }, cat.config).winnerId
      if (prevWinner && newWinner && prevWinner !== newWinner) {
        const ok = await confirm({
          title: 'Cambio afecta a rondas posteriores',
          message: 'Al cambiar el ganador de este partido se recalcularán automáticamente los cruces siguientes. Los resultados ya introducidos en rondas posteriores podrían quedar sin validez. ¿Continuar?',
          danger: true,
          confirmLabel: 'Guardar y recalcular',
        })
        if (!ok) return
      }
    }

    saveMatchResult(tournamentId, cat.id, { ...match, sets: cleaned, status, pista: pista || undefined, hora: hora || undefined, observaciones: obs || undefined })
    onClose()
  }

  const canScore = !!(match.localId && match.visitanteId)

  return (
    <Modal open onClose={onClose} title={`Partido nº ${match.numero}`} wide>
      <div className="text-center mb-4">
        <span className="text-lg font-bold">{local}</span>
        <span className="text-muted mx-3">vs</span>
        <span className="text-lg font-bold">{visitante}</span>
      </div>

      {!canScore && (
        <p className="chip mb-4" style={{ background: '#ff9f0a22', color: '#c77700', width: '100%', justifyContent: 'center' }}>
          Equipos aún por definir. Podrás introducir el resultado cuando se resuelvan las rondas previas.
        </p>
      )}

      {canScore && (
        <>
          <div className="flex flex-col gap-2 mb-3">
            <div className="grid text-sm text-muted font-semibold" style={{ gridTemplateColumns: '60px 1fr 1fr 40px' }}>
              <span>Set</span><span className="text-center">{local}</span><span className="text-center">{visitante}</span><span />
            </div>
            {sets.map((s, i) => (
              <div key={i} className="grid items-center gap-2" style={{ gridTemplateColumns: '60px 1fr 1fr 40px' }}>
                <span className="font-semibold">#{i + 1}</span>
                <input className="input text-center" type="number" min={0} value={s.local} onChange={(e) => setSet(i, 'local', Number(e.target.value))} />
                <input className="input text-center" type="number" min={0} value={s.visitante} onChange={(e) => setSet(i, 'visitante', Number(e.target.value))} />
                {sets.length > 1 ? <button className="btn btn-ghost" style={{ padding: 4 }} onClick={() => removeSet(i)}>✕</button> : <span />}
              </div>
            ))}
            {sets.length < maxSets && <button className="btn btn-ghost text-sm self-start" onClick={addSet}>+ Añadir set</button>}
          </div>
          {errors.filter(Boolean).length > 0 && (
            <div className="mb-3" style={{ color: '#ff3b30', fontSize: 13 }}>
              {errors.filter(Boolean).map((e, i) => <div key={i}>• {e}</div>)}
            </div>
          )}
        </>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Estado">
          <Select value={status} onChange={(v) => setStatus(v as MatchStatus)} options={STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
        </Field>
        <Field label="Pista / campo"><input className="input" value={pista} onChange={(e) => setPista(e.target.value)} placeholder="Pista 1" /></Field>
        <Field label="Hora"><input className="input" type="time" value={hora} onChange={(e) => setHora(e.target.value)} /></Field>
      </div>
      <Field label="Observaciones"><textarea className="input" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} /></Field>

      <div className="flex justify-end gap-2 mt-4">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={save}>Guardar resultado</button>
      </div>
    </Modal>
  )
}
