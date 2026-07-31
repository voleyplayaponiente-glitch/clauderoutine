import { useStore } from '@/store/store'
import { Card, PageHeader, Field, useToast, useConfirm } from '@/components/ui'
import { IconTrash } from '@/components/icons'
import { RequireTournament } from '@/components/Guards'

export function TournamentEdit() {
  const updateTournament = useStore((s) => s.updateTournament)
  const deleteTournament = useStore((s) => s.deleteTournament)
  const toast = useToast()
  const confirm = useConfirm()

  return (
    <RequireTournament>
      {(t) => (
        <>
          <PageHeader title="Editar torneo" subtitle="Datos generales del torneo" />
          <Card className="max-w-2xl">
            <div className="grid gap-4">
              <Field label="Nombre del torneo">
                <input className="input" value={t.nombre} onChange={(e) => updateTournament(t.id, { nombre: e.target.value })} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Lugar">
                  <input className="input" value={t.lugar ?? ''} onChange={(e) => updateTournament(t.id, { lugar: e.target.value })} placeholder="Playa / polideportivo" />
                </Field>
                <Field label="Fecha">
                  <input className="input" type="date" value={t.fecha ?? ''} onChange={(e) => updateTournament(t.id, { fecha: e.target.value })} />
                </Field>
              </div>
            </div>
          </Card>

          <Card className="max-w-2xl mt-4" style={{ borderColor: '#ff3b3055' }}>
            <h3 className="font-bold mb-1">Zona de riesgo</h3>
            <p className="text-muted text-sm mb-4">Eliminar el torneo borra todas sus categorías, equipos y resultados de forma permanente.</p>
            <button
              className="btn btn-danger"
              onClick={async () => {
                const ok = await confirm({ title: 'Eliminar torneo', message: `¿Seguro que deseas eliminar "${t.nombre}"? Esta acción no se puede deshacer.`, danger: true, confirmLabel: 'Eliminar' })
                if (ok) {
                  deleteTournament(t.id)
                  toast('Torneo eliminado')
                }
              }}
            >
              <IconTrash size={18} /> Eliminar torneo
            </button>
          </Card>
        </>
      )}
    </RequireTournament>
  )
}
