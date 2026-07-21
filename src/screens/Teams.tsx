import { useRef, useState } from 'react'
import { useStore } from '@/store/store'
import { Card, PageHeader, Field, Select, Modal, useToast, useConfirm } from '@/components/ui'
import { IconPlus, IconTrash, IconDownload, IconUsers } from '@/components/icons'
import { RequireCategory } from '@/components/Guards'
import { newTeam } from '@/lib/factory'
import { teamsToCSV, csvToTeams, downloadText } from '@/lib/csv'
import type { RegistrationStatus, Team } from '@/types'

const ESTADOS: RegistrationStatus[] = ['inscrito', 'pendiente', 'confirmado', 'baja']

export function Teams() {
  const setTeams = useStore((s) => s.setTeams)
  const toast = useToast()
  const confirm = useConfirm()
  const fileRef = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState<Team | null>(null)

  return (
    <RequireCategory>
      {(t, cat) => {
        const update = (teams: Team[]) => setTeams(t.id, cat.id, teams)
        const addOne = () => {
          const nt = newTeam(cat.teams.length + 1)
          update([...cat.teams, nt])
          setEditing(nt)
        }
        const remove = async (team: Team) => {
          const ok = await confirm({ title: 'Eliminar equipo', message: `¿Eliminar "${team.nombre}"?`, danger: true, confirmLabel: 'Eliminar' })
          if (ok) update(cat.teams.filter((x) => x.id !== team.id))
        }
        const patch = (id: string, p: Partial<Team>) => update(cat.teams.map((x) => (x.id === id ? { ...x, ...p } : x)))

        const capacity = cat.config.numEquipos
        const full = cat.teams.length >= capacity

        return (
          <>
            <PageHeader
              title={`Equipos · ${cat.nombre}`}
              subtitle={`${cat.teams.length} de ${capacity} equipos registrados`}
              actions={
                <>
                  <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={async (e) => {
                    const f = e.target.files?.[0]
                    if (!f) return
                    const text = await f.text()
                    const imported = csvToTeams(text, 1).slice(0, capacity)
                    update(imported.map((tm, i) => ({ ...tm, numero: i + 1 })))
                    toast(`${imported.length} equipos importados`)
                    if (fileRef.current) fileRef.current.value = ''
                  }} />
                  <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>Importar CSV</button>
                  <button className="btn btn-ghost" onClick={() => downloadText(`equipos-${cat.nombre}.csv`, teamsToCSV(cat.teams))}>
                    <IconDownload size={17} /> Exportar
                  </button>
                  <button className="btn btn-primary" onClick={addOne} disabled={full}>
                    <IconPlus size={18} /> Añadir equipo
                  </button>
                </>
              }
            />

            {full && <p className="chip mb-3" style={{ background: '#ff9f0a22', color: '#c77700' }}>El grupo está completo para {capacity} equipos.</p>}

            {cat.teams.length === 0 ? (
              <Card className="text-center text-muted py-10">
                <IconUsers size={40} className="mx-auto mb-3 opacity-50" />
                <p>No hay equipos. Añade equipos manualmente o importa un CSV.</p>
                <p className="text-xs mt-2">Formato CSV: Numero;Equipo;Jugador1;Jugador2;Jugador3;Jugador4;Jugador5;Telefono;CabezaSerie;Estado;Importe;Observaciones</p>
              </Card>
            ) : (
              <div className="card p-0 overflow-hidden">
                <div className="scroll-x">
                  <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 720 }}>
                    <thead>
                      <tr className="surface-2 text-left text-sm text-muted">
                        <Th>#</Th><Th>Equipo</Th><Th>Jugadores</Th><Th>Teléfono</Th><Th>Serie</Th><Th>Estado</Th><Th>Pago</Th><Th></Th>
                      </tr>
                    </thead>
                    <tbody>
                      {cat.teams.map((team) => (
                        <tr key={team.id} style={{ borderTop: '1px solid var(--border)' }} className="border-app">
                          <Td>{team.numero}</Td>
                          <Td>
                            <button className="font-semibold text-left" style={{ color: 'var(--color-brand-500)', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setEditing(team)}>
                              {team.nombre}
                            </button>
                          </Td>
                          <Td className="text-sm text-muted">{team.jugadores.map((j) => j.nombre).filter(Boolean).join(' / ') || '—'}</Td>
                          <Td className="text-sm">{team.telefono || '—'}</Td>
                          <Td>
                            <input type="checkbox" checked={team.cabezaSerie} onChange={(e) => patch(team.id, { cabezaSerie: e.target.checked, seedRank: e.target.checked ? cat.teams.filter((x) => x.cabezaSerie).length + 1 : undefined })} />
                          </Td>
                          <Td>
                            <Select className="text-sm" value={team.estadoInscripcion} onChange={(v) => patch(team.id, { estadoInscripcion: v as RegistrationStatus })} options={ESTADOS.map((s) => ({ value: s, label: cap(s) }))} />
                          </Td>
                          <Td className="text-sm">{(team.importePagado ?? 0).toFixed(0)} €</Td>
                          <Td>
                            <button className="btn btn-ghost" style={{ padding: 6, color: '#ff3b30' }} onClick={() => remove(team)}><IconTrash size={16} /></button>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {editing && (
              <TeamModal
                team={cat.teams.find((x) => x.id === editing.id) ?? editing}
                onClose={() => setEditing(null)}
                onChange={(p) => patch(editing.id, p)}
              />
            )}
          </>
        )
      }}
    </RequireCategory>
  )
}

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }

function Th({ children }: { children?: React.ReactNode }) { return <th className="px-3 py-2.5 font-semibold">{children}</th> }
function Td({ children, className = '' }: { children?: React.ReactNode; className?: string }) { return <td className={`px-3 py-2.5 ${className}`}>{children}</td> }

function TeamModal({ team, onClose, onChange }: { team: Team; onClose: () => void; onChange: (p: Partial<Team>) => void }) {
  const setPlayer = (idx: number, nombre: string) => {
    const jugadores = [...team.jugadores]
    while (jugadores.length <= idx) jugadores.push({ id: Math.random().toString(36), nombre: '' })
    jugadores[idx] = { ...jugadores[idx], nombre }
    onChange({ jugadores })
  }
  return (
    <Modal open onClose={onClose} title={`Equipo ${team.numero}`} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre del equipo"><input className="input" value={team.nombre} onChange={(e) => onChange({ nombre: e.target.value })} /></Field>
        <Field label="Teléfono de contacto"><input className="input" value={team.telefono ?? ''} onChange={(e) => onChange({ telefono: e.target.value })} /></Field>
        <Field label="Jugador 1"><input className="input" value={team.jugadores[0]?.nombre ?? ''} onChange={(e) => setPlayer(0, e.target.value)} /></Field>
        <Field label="Jugador 2"><input className="input" value={team.jugadores[1]?.nombre ?? ''} onChange={(e) => setPlayer(1, e.target.value)} /></Field>
        <Field label="Jugador 3"><input className="input" value={team.jugadores[2]?.nombre ?? ''} onChange={(e) => setPlayer(2, e.target.value)} /></Field>
        <Field label="Jugador 4"><input className="input" value={team.jugadores[3]?.nombre ?? ''} onChange={(e) => setPlayer(3, e.target.value)} /></Field>
        <Field label="Jugador 5"><input className="input" value={team.jugadores[4]?.nombre ?? ''} onChange={(e) => setPlayer(4, e.target.value)} /></Field>
        <Field label="Estado de inscripción">
          <Select value={team.estadoInscripcion} onChange={(v) => onChange({ estadoInscripcion: v as RegistrationStatus })} options={ESTADOS.map((s) => ({ value: s, label: cap(s) }))} />
        </Field>
        <Field label="Importe pagado (€)"><input className="input" type="number" value={team.importePagado ?? 0} onChange={(e) => onChange({ importePagado: Number(e.target.value) })} /></Field>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <input id="seed" type="checkbox" checked={team.cabezaSerie} onChange={(e) => onChange({ cabezaSerie: e.target.checked })} />
        <label htmlFor="seed">Cabeza de serie</label>
        {team.cabezaSerie && (
          <input className="input" type="number" min={1} style={{ width: 90, marginLeft: 8 }} value={team.seedRank ?? 1} onChange={(e) => onChange({ seedRank: Number(e.target.value) })} placeholder="Ranking" />
        )}
      </div>
      <Field label="Observaciones"><textarea className="input" rows={2} value={team.observaciones ?? ''} onChange={(e) => onChange({ observaciones: e.target.value })} /></Field>
      <div className="flex justify-end mt-4"><button className="btn btn-primary" onClick={onClose}>Hecho</button></div>
    </Modal>
  )
}
