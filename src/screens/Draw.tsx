import { useState } from 'react'
import { useStore } from '@/store/store'
import { Card, PageHeader, Select, useToast, useConfirm } from '@/components/ui'
import { IconGrid, IconPlus, IconTrash } from '@/components/icons'
import { RequireCategory } from '@/components/Guards'
import { generateCategoryDraw } from '@/lib/category'
import type { Category, Tournament } from '@/types'

export function Draw() {
  const updateCategory = useStore((s) => s.updateCategory)
  const toast = useToast()
  const confirm = useConfirm()
  const [keepApart, setKeepApart] = useState<[string, string][]>([])
  const [a, setA] = useState('')
  const [b, setB] = useState('')

  return (
    <RequireCategory>
      {(t, cat) => {
        const doDraw = async () => {
          if (cat.teams.length < cat.config.numEquipos) {
            const ok = await confirm({ title: 'Faltan equipos', message: `Hay ${cat.teams.length} equipos de ${cat.config.numEquipos}. ¿Generar el sorteo igualmente con los equipos disponibles?`, confirmLabel: 'Generar' })
            if (!ok) return
          }
          if (cat.matches.some((m) => m.status === 'finalizado')) {
            const ok = await confirm({ title: 'Rehacer sorteo', message: 'Ya hay resultados registrados. Volver a sortear los grupos borrará todos los resultados de esta categoría. ¿Continuar?', danger: true, confirmLabel: 'Rehacer' })
            if (!ok) return
          }
          const next = generateCategoryDraw(cat, { keepApart })
          updateCategory(t.id, cat.id, { groups: next.groups, matches: next.matches, manualTiebreaks: {} })
          toast('Grupos generados')
        }

        const move = (teamId: string, toGroupId: string) => {
          const groups = cat.groups.map((g) => ({ ...g, teamIds: g.teamIds.filter((id) => id !== teamId) }))
          const target = groups.find((g) => g.id === toGroupId)
          target?.teamIds.push(teamId)
          // regenerate fixtures for changed groups -> simplest: rebuild matches from new groups
          const rebuilt = generateCategoryDraw({ ...cat, groups }, {})
          updateCategory(t.id, cat.id, { groups, matches: rebuilt.matches, manualTiebreaks: {} })
        }

        const teamName = (id: string) => cat.teams.find((x) => x.id === id)?.nombre ?? id

        return (
          <>
            <PageHeader
              title={`Sorteo y grupos · ${cat.nombre}`}
              subtitle={`${cat.config.numGrupos} grupos · ${cat.config.equiposPorGrupo} equipos por grupo`}
              actions={
                <>
                  <Select
                    value={cat.config.sorteoAutomatico ? 'auto' : 'manual'}
                    onChange={(v) => updateCategory(t.id, cat.id, { config: { ...cat.config, sorteoAutomatico: v === 'auto' } })}
                    options={[{ value: 'auto', label: 'Sorteo automático' }, { value: 'manual', label: 'Distribución manual' }]}
                  />
                  <button className="btn btn-primary" onClick={doDraw}><IconGrid size={18} /> Generar grupos</button>
                </>
              }
            />

            <Card className="mb-4">
              <h3 className="font-semibold mb-2">Equipos que no deben coincidir</h3>
              <div className="flex flex-wrap gap-2 items-end">
                <Select value={a} onChange={setA} options={[{ value: '', label: 'Equipo A' }, ...cat.teams.map((tm) => ({ value: tm.id, label: tm.nombre }))]} />
                <Select value={b} onChange={setB} options={[{ value: '', label: 'Equipo B' }, ...cat.teams.map((tm) => ({ value: tm.id, label: tm.nombre }))]} />
                <button className="btn btn-ghost" disabled={!a || !b || a === b} onClick={() => { setKeepApart([...keepApart, [a, b]]); setA(''); setB('') }}>
                  <IconPlus size={16} /> Añadir restricción
                </button>
              </div>
              {keepApart.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {keepApart.map((pair, i) => (
                    <span key={i} className="chip surface-2" style={{ background: 'var(--surface-2)' }}>
                      {teamName(pair[0])} ✕ {teamName(pair[1])}
                      <button onClick={() => setKeepApart(keepApart.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff3b30' }}><IconTrash size={13} /></button>
                    </span>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted mt-2">Las restricciones se aplican al pulsar «Generar grupos» (sorteo automático).</p>
            </Card>

            {cat.groups.length === 0 ? (
              <Card className="text-center text-muted py-10">Aún no se han generado los grupos.</Card>
            ) : (
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                {cat.groups.map((g) => (
                  <Card key={g.id} style={{ borderTop: `4px solid ${cat.color}` }}>
                    <h3 className="font-bold mb-3">{g.nombre}</h3>
                    <div className="flex flex-col gap-2">
                      {g.teamIds.map((id) => (
                        <div key={id} className="flex items-center justify-between gap-2 surface-2 rounded-xl px-3 py-2" style={{ borderRadius: 12 }}>
                          <span className="text-sm font-medium truncate">{teamName(id)}</span>
                          <select className="input" style={{ width: 'auto', padding: '2px 6px', fontSize: 12 }} value={g.id} onChange={(e) => move(id, e.target.value)}>
                            {cat.groups.map((gg) => <option key={gg.id} value={gg.id}>{gg.nombre.replace('Grupo ', '')}</option>)}
                          </select>
                        </div>
                      ))}
                      {g.teamIds.length === 0 && <span className="text-muted text-sm">Vacío</span>}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )
      }}
    </RequireCategory>
  )
}

export type { Category, Tournament }
