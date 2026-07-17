import { useState } from 'react'
import { useStore } from '@/store/store'
import { Card, PageHeader, Field, Modal, Select, useToast, useConfirm } from '@/components/ui'
import { IconPlus, IconTrash, IconUsers, IconGrid } from '@/components/icons'
import { RequireTournament } from '@/components/Guards'
import { CATEGORY_COLORS } from '@/engine/defaults'
import type { Category } from '@/types'

export function Categories() {
  const addCategory = useStore((s) => s.addCategory)
  const updateCategory = useStore((s) => s.updateCategory)
  const deleteCategory = useStore((s) => s.deleteCategory)
  const toast = useToast()
  const confirm = useConfirm()
  const [modal, setModal] = useState(false)
  const [nombre, setNombre] = useState('')
  const [numEquipos, setNumEquipos] = useState<'8' | '16' | '32'>('16')

  return (
    <RequireTournament>
      {(t) => (
        <>
          <PageHeader
            title="Categorías"
            subtitle="Cada categoría es independiente: equipos, grupos, resultados y cuadro propios"
            actions={
              <button className="btn btn-primary" onClick={() => setModal(true)}>
                <IconPlus size={18} /> Nueva categoría
              </button>
            }
          />

          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {t.categories.map((cat) => (
              <Card key={cat.id} style={{ borderTop: `4px solid ${cat.color}` }}>
                <div className="flex items-center gap-2 mb-4">
                  <input
                    className="input"
                    style={{ fontWeight: 700, fontSize: 18 }}
                    value={cat.nombre}
                    onChange={(e) => updateCategory(t.id, cat.id, { nombre: e.target.value })}
                  />
                </div>
                <div className="grid gap-3">
                  <Field label="Número de equipos">
                    <Select
                      value={String(cat.config.numEquipos)}
                      onChange={(v) => {
                        const n = Number(v) as 8 | 16 | 32
                        updateCategory(t.id, cat.id, {
                          config: { ...cat.config, numEquipos: n, numGrupos: n / 4, equiposPorGrupo: 4 },
                        })
                      }}
                      options={[
                        { value: '8', label: '8 equipos (2 grupos)' },
                        { value: '16', label: '16 equipos (4 grupos)' },
                        { value: '32', label: '32 equipos (8 grupos)' },
                      ]}
                    />
                  </Field>
                  <Field label="Color identificativo">
                    <div className="flex gap-2 flex-wrap">
                      {CATEGORY_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => updateCategory(t.id, cat.id, { color: c })}
                          style={{
                            width: 30, height: 30, borderRadius: 99, background: c,
                            border: cat.color === c ? '3px solid var(--text)' : '2px solid var(--border)',
                            cursor: 'pointer',
                          }}
                        />
                      ))}
                    </div>
                  </Field>
                </div>
                <div className="flex items-center gap-4 mt-4 text-sm text-muted">
                  <span className="flex items-center gap-1"><IconUsers size={15} /> {cat.teams.length} equipos</span>
                  <span className="flex items-center gap-1"><IconGrid size={15} /> {cat.groups.length} grupos</span>
                </div>
                <button
                  className="btn btn-ghost text-sm mt-4"
                  style={{ color: '#ff3b30' }}
                  onClick={async () => {
                    const ok = await confirm({ title: 'Eliminar categoría', message: `¿Eliminar "${cat.nombre}" con sus equipos y resultados?`, danger: true, confirmLabel: 'Eliminar' })
                    if (ok) { deleteCategory(t.id, cat.id); toast('Categoría eliminada') }
                  }}
                >
                  <IconTrash size={16} /> Eliminar categoría
                </button>
              </Card>
            ))}
          </div>

          <Modal open={modal} onClose={() => setModal(false)} title="Nueva categoría">
            <div className="grid gap-4">
              <Field label="Nombre" hint="Ej. SUB-10, VETERANOS, MIXTO…">
                <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="SUB-15" autoFocus />
              </Field>
              <Field label="Número de equipos">
                <Select value={numEquipos} onChange={(v) => setNumEquipos(v as any)} options={[
                  { value: '8', label: '8 equipos' },
                  { value: '16', label: '16 equipos' },
                  { value: '32', label: '32 equipos' },
                ]} />
              </Field>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
              <button className="btn btn-primary" disabled={!nombre.trim()} onClick={() => {
                addCategory(t.id, nombre.trim(), Number(numEquipos) as 8 | 16 | 32)
                setNombre(''); setModal(false); toast('Categoría creada')
              }}>Crear</button>
            </div>
          </Modal>
        </>
      )}
    </RequireTournament>
  )
}

export type { Category }
