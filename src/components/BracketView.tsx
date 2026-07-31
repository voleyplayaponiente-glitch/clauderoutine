import type { Category, Match, Phase } from '@/types'
import { computeOutcome } from '@/engine/match'
import { teamLabel } from './MatchResult'
import { PHASE_LABEL } from '@/lib/labels'
import { IconTrophy } from './icons'

const ROUND_ORDER: Phase[] = ['dieciseisavos', 'octavos', 'cuartos', 'semifinales', 'final']

export function BracketView({ cat, onPick }: { cat: Category; onPick?: (m: Match) => void }) {
  const bracket = cat.matches.filter((m) => m.phase !== 'grupos')
  const roundsPresent = ROUND_ORDER.filter((p) => bracket.some((m) => m.phase === p))
  const thirdPlace = bracket.find((m) => m.phase === 'tercer_puesto')
  const final = bracket.find((m) => m.phase === 'final')
  const champ = final ? computeOutcome(final, cat.config).winnerId : undefined
  const champName = cat.teams.find((t) => t.id === champ)?.nombre

  if (bracket.length === 0) {
    return <div className="card text-center text-muted py-10">El cuadro se generará al crear los grupos.</div>
  }

  return (
    <div>
      {champName && (
        <div className="card mb-4 flex items-center gap-3" style={{ borderLeft: `6px solid ${cat.color}`, padding: '14px 18px' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: cat.color, color: '#fff', display: 'grid', placeItems: 'center' }}>
            <IconTrophy size={24} />
          </div>
          <div>
            <div className="text-muted text-sm">Campeón</div>
            <div className="text-xl font-bold">{champName}</div>
          </div>
        </div>
      )}

      <div className="scroll-x pb-2">
        <div style={{ display: 'flex', gap: 24, minWidth: 'min-content' }}>
          {roundsPresent.map((phase) => {
            const ms = bracket
              .filter((m) => m.phase === phase)
              .sort((a, b) => (a.bracketSlot ?? '').localeCompare(b.bracketSlot ?? ''))
            return (
              <div key={phase} style={{ display: 'flex', flexDirection: 'column', minWidth: 210 }}>
                <div className="text-sm font-bold mb-2 text-muted" style={{ position: 'sticky', left: 0 }}>{PHASE_LABEL[phase]}</div>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', flex: 1, gap: 12 }}>
                  {ms.map((m) => (
                    <BracketCard key={m.id} cat={cat} m={m} onPick={onPick} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {thirdPlace && (
        <div className="mt-5" style={{ maxWidth: 260 }}>
          <div className="text-sm font-bold mb-2 text-muted">{PHASE_LABEL.tercer_puesto}</div>
          <BracketCard cat={cat} m={thirdPlace} onPick={onPick} />
        </div>
      )}
    </div>
  )
}

function BracketCard({ cat, m, onPick }: { cat: Category; m: Match; onPick?: (m: Match) => void }) {
  const o = computeOutcome(m, cat.config)
  const finished = m.status === 'finalizado' && o.played
  const rows: ('local' | 'visitante')[] = ['local', 'visitante']
  return (
    <button
      onClick={() => onPick?.(m)}
      className="card"
      style={{ padding: 0, overflow: 'hidden', textAlign: 'left', cursor: onPick ? 'pointer' : 'default', width: '100%' }}
    >
      {rows.map((side, i) => {
        const id = side === 'local' ? m.localId : m.visitanteId
        const isWinner = finished && o.winnerId === id
        const score = side === 'local' ? o.localSets : o.visitanteSets
        return (
          <div
            key={side}
            className="flex items-center justify-between gap-2"
            style={{
              padding: '8px 12px',
              borderTop: i === 1 ? '1px solid var(--border)' : 'none',
              background: isWinner ? `${cat.color}18` : 'transparent',
              fontWeight: isWinner ? 700 : 500,
            }}
          >
            <span className="truncate text-sm" style={{ opacity: finished && !isWinner ? 0.55 : 1 }}>
              {teamLabel(cat, m, side)}
            </span>
            {finished && <span className="font-bold text-sm">{score}</span>}
          </div>
        )
      })}
      <div className="text-muted px-3 py-1" style={{ fontSize: 10, borderTop: '1px dashed var(--border)' }}>
        Nº{m.numero}{m.pista ? ` · ${m.pista}` : ''}{m.hora ? ` · ${m.hora}` : ''}
      </div>
    </button>
  )
}
