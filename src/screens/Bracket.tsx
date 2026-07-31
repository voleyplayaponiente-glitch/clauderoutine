import { useState } from 'react'
import { PageHeader } from '@/components/ui'
import { RequireCategory } from '@/components/Guards'
import { BracketView } from '@/components/BracketView'
import { MatchResultModal } from '@/components/MatchResult'
import { useStore } from '@/store/store'
import { groupsComplete } from '@/lib/category'
import type { Match } from '@/types'

export function BracketScreen() {
  const role = useStore((s) => s.role)
  const [editing, setEditing] = useState<Match | null>(null)
  return (
    <RequireCategory>
      {(t, cat) => (
        <>
          <PageHeader
            title={`Cuadro eliminatorio · ${cat.nombre}`}
            subtitle={groupsComplete(cat) ? 'Fase final' : 'Se completará automáticamente al terminar la fase de grupos'}
          />
          {!groupsComplete(cat) && cat.groups.length > 0 && (
            <p className="chip mb-4" style={{ background: '#0a84ff18', color: 'var(--color-brand-600)' }}>
              Faltan resultados de la fase de grupos para definir todos los cruces.
            </p>
          )}
          <BracketView cat={cat} onPick={role === 'admin' ? (m) => setEditing(m) : undefined} />
          {editing && <MatchResultModal tournamentId={t.id} cat={cat} match={cat.matches.find((x) => x.id === editing.id) ?? editing} onClose={() => setEditing(null)} />}
        </>
      )}
    </RequireCategory>
  )
}
