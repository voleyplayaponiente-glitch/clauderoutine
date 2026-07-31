import { useStore } from '@/store/store'
import { Card, PageHeader } from '@/components/ui'
import { IconWarning } from '@/components/icons'
import { RequireCategory } from '@/components/Guards'
import { categoryStandings } from '@/lib/category'
import type { Category, StandingRow } from '@/types'

export function Standings() {
  return (
    <RequireCategory>
      {(_t, cat) => {
        const standings = categoryStandings(cat)
        if (cat.groups.length === 0) {
          return (
            <>
              <PageHeader title={`Clasificaciones · ${cat.nombre}`} />
              <Card className="text-center text-muted py-10">Genera primero los grupos.</Card>
            </>
          )
        }
        return (
          <>
            <PageHeader
              title={`Clasificaciones · ${cat.nombre}`}
              subtitle={`Clasifican los ${cat.config.clasificadosPorGrupo} primeros de cada grupo`}
            />
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
              {standings.map(({ group, rows }) => (
                <StandingsTable key={group.id} cat={cat} nombre={group.nombre} rows={rows} />
              ))}
            </div>
            <p className="text-xs text-muted mt-4 flex items-center gap-1.5">
              <IconWarning size={14} /> Un icono de aviso indica un empate que los criterios configurados no resuelven; deberás decidirlo manualmente.
            </p>
          </>
        )
      }}
    </RequireCategory>
  )
}

export function StandingsTable({ cat, nombre, rows }: { cat: Category; nombre: string; rows: StandingRow[] }) {
  const name = (id: string) => cat.teams.find((t) => t.id === id)?.nombre ?? '—'
  return (
    <Card style={{ borderTop: `4px solid ${cat.color}`, padding: 0 }}>
      <h3 className="font-bold px-4 pt-4 pb-2">{nombre}</h3>
      <div className="scroll-x">
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse', minWidth: 320 }}>
          <thead>
            <tr className="surface-2 text-muted" style={{ textAlign: 'center' }}>
              <th className="px-2 py-2 text-left">#</th>
              <th className="px-2 py-2 text-left">Equipo</th>
              <th className="px-2 py-2" title="Jugados">PJ</th>
              <th className="px-2 py-2" title="Ganados">PG</th>
              <th className="px-2 py-2" title="Perdidos">PP</th>
              <th className="px-2 py-2" title="Diferencia de sets">±S</th>
              <th className="px-2 py-2" title="Diferencia de puntos">±P</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const qualifies = r.posicion <= cat.config.clasificadosPorGrupo
              return (
                <tr key={r.teamId} style={{ borderTop: '1px solid var(--border)', textAlign: 'center', background: qualifies ? `${cat.color}12` : 'transparent' }}>
                  <td className="px-2 py-2 text-left font-bold" style={{ color: qualifies ? cat.color : 'inherit' }}>{r.posicion}</td>
                  <td className="px-2 py-2 text-left font-medium flex items-center gap-1">
                    {name(r.teamId)}
                    {r.empateSinResolver && <IconWarning size={13} className="text-muted" />}
                  </td>
                  <td className="px-2 py-2">{r.jugados}</td>
                  <td className="px-2 py-2 font-semibold">{r.ganados}</td>
                  <td className="px-2 py-2">{r.perdidos}</td>
                  <td className="px-2 py-2">{r.difSets > 0 ? '+' : ''}{r.difSets}</td>
                  <td className="px-2 py-2">{r.difPuntos > 0 ? '+' : ''}{r.difPuntos}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
