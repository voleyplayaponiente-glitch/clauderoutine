import { useState } from 'react'
import { useStore, useActiveTournament } from '@/store/store'
import { Card, PageHeader, EmptyState, Modal, Field, useToast } from '@/components/ui'
import { IconTrophy, IconPlus, IconUsers, IconCalendar, IconBracket } from '@/components/icons'
import { navigate } from '@/lib/router'
import { demoTournament, demoSmall } from '@/lib/demo'
import { categoryStandings, groupsComplete } from '@/lib/category'
import { champion } from '@/engine/bracket'
import type { Category } from '@/types'

export function Dashboard() {
  const tournaments = useStore((s) => s.tournaments)
  const tournament = useActiveTournament()
  const createTournament = useStore((s) => s.createTournament)
  const importTournament = useStore((s) => s.importTournament)
  const toast = useToast()
  const [modal, setModal] = useState(false)
  const [nombre, setNombre] = useState('')

  if (tournaments.length === 0) {
    return (
      <>
        <PageHeader title="Panel principal" subtitle="Gestión de torneos de vóley playa" />
        <EmptyState
          icon={<IconTrophy size={48} />}
          title="No hay ningún torneo todavía"
          message="Crea tu primer torneo o carga datos de demostración para explorar la aplicación (categorías SUB-17 de 16 equipos y SÉNIOR de 32 equipos con resultados de ejemplo)."
          action={
            <div className="flex gap-2 flex-wrap justify-center">
              <button className="btn btn-primary" onClick={() => setModal(true)}>
                <IconPlus size={18} /> Crear torneo
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  importTournament(demoTournament())
                  toast('Torneo de demostración cargado')
                }}
              >
                Cargar demo (16 + 32)
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  importTournament(demoSmall())
                  toast('Torneo de 8 equipos cargado')
                }}
              >
                Cargar demo (8)
              </button>
            </div>
          }
        />
        <CreateModal open={modal} onClose={() => setModal(false)} nombre={nombre} setNombre={setNombre} onCreate={() => {
          if (!nombre.trim()) return
          createTournament(nombre.trim())
          setModal(false)
          setNombre('')
          navigate('/categorias')
        }} />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={tournament?.nombre ?? 'Panel principal'}
        subtitle={[tournament?.lugar, tournament?.fecha].filter(Boolean).join(' · ') || 'Resumen del torneo'}
        actions={
          <>
            <button className="btn btn-ghost" onClick={() => setModal(true)}>
              <IconPlus size={18} /> Nuevo torneo
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/categorias')}>
              Gestionar categorías
            </button>
          </>
        }
      />

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {tournament?.categories.map((cat) => (
          <CategoryCard key={cat.id} cat={cat} />
        ))}
      </div>

      <CreateModal open={modal} onClose={() => setModal(false)} nombre={nombre} setNombre={setNombre} onCreate={() => {
        if (!nombre.trim()) return
        createTournament(nombre.trim())
        setModal(false)
        setNombre('')
        navigate('/categorias')
      }} />
    </>
  )
}

function CategoryCard({ cat }: { cat: Category }) {
  const setActiveCategory = useStore((s) => s.setActiveCategory)
  const standings = categoryStandings(cat)
  const played = cat.matches.filter((m) => m.status === 'finalizado').length
  const total = cat.matches.length
  const champ = champion(cat.matches.filter((m) => m.phase !== 'grupos'), cat.config)
  const champTeam = cat.teams.find((t) => t.id === champ)

  return (
    <Card style={{ borderTop: `4px solid ${cat.color}` }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <span style={{ width: 12, height: 12, borderRadius: 99, background: cat.color, display: 'inline-block' }} />
          {cat.nombre}
        </h3>
        <span className="chip" style={{ background: 'var(--surface-2)' }}>{cat.config.numEquipos} equipos</span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4 text-center">
        <Stat icon={<IconUsers size={16} />} value={cat.teams.length} label="Equipos" />
        <Stat icon={<IconCalendar size={16} />} value={`${played}/${total}`} label="Partidos" />
        <Stat icon={<IconBracket size={16} />} value={cat.groups.length} label="Grupos" />
      </div>

      {champTeam ? (
        <div className="chip mb-3" style={{ background: cat.color, color: '#fff', width: '100%', justifyContent: 'center', padding: '0.5rem' }}>
          <IconTrophy size={16} /> Campeón: {champTeam.nombre}
        </div>
      ) : (
        <p className="text-muted text-sm mb-3">
          {cat.groups.length === 0
            ? 'Sin sorteo realizado'
            : groupsComplete(cat)
              ? 'Fase de grupos completa'
              : `Fase de grupos en curso (${standings.length} grupos)`}
        </p>
      )}

      <div className="flex gap-2">
        <button className="btn btn-ghost text-sm" style={{ flex: 1 }} onClick={() => { setActiveCategory(cat.id); navigate('/clasificacion') }}>
          Clasificación
        </button>
        <button className="btn btn-primary text-sm" style={{ flex: 1 }} onClick={() => { setActiveCategory(cat.id); navigate('/cuadro') }}>
          Cuadro
        </button>
      </div>
    </Card>
  )
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: React.ReactNode; label: string }) {
  return (
    <div className="surface-2 rounded-xl py-2.5" style={{ borderRadius: 14 }}>
      <div className="flex justify-center text-muted mb-1">{icon}</div>
      <div className="font-bold text-lg leading-none">{value}</div>
      <div className="text-muted" style={{ fontSize: 11 }}>{label}</div>
    </div>
  )
}

function CreateModal({ open, onClose, nombre, setNombre, onCreate }: { open: boolean; onClose: () => void; nombre: string; setNombre: (v: string) => void; onCreate: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Crear nuevo torneo">
      <Field label="Nombre del torneo">
        <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Torneo de Verano 2026" autoFocus onKeyDown={(e) => e.key === 'Enter' && onCreate()} />
      </Field>
      <p className="text-muted text-sm mt-3">Se crearán automáticamente las categorías SUB-17 y SÉNIOR, que podrás configurar después.</p>
      <div className="flex justify-end gap-2 mt-5">
        <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={onCreate} disabled={!nombre.trim()}>Crear</button>
      </div>
    </Modal>
  )
}
