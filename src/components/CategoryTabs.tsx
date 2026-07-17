import { useStore, useActiveTournament, useActiveCategory } from '@/store/store'

export function CategoryTabs() {
  const tournament = useActiveTournament()
  const active = useActiveCategory()
  const setActiveCategory = useStore((s) => s.setActiveCategory)
  if (!tournament || tournament.categories.length === 0) return null

  return (
    <div className="flex gap-2 mb-5 flex-wrap no-print">
      {tournament.categories.map((c) => {
        const isActive = c.id === active?.id
        return (
          <button
            key={c.id}
            onClick={() => setActiveCategory(c.id)}
            className="chip"
            style={{
              padding: '0.4rem 0.9rem',
              fontSize: '0.9rem',
              background: isActive ? c.color : 'var(--surface)',
              color: isActive ? '#fff' : 'var(--text)',
              border: `1.5px solid ${isActive ? c.color : 'var(--border)'}`,
              cursor: 'pointer',
            }}
          >
            <span style={{ width: 9, height: 9, borderRadius: 99, background: isActive ? '#fff' : c.color, display: 'inline-block' }} />
            {c.nombre}
            <span style={{ opacity: 0.7, fontWeight: 500 }}>· {c.config.numEquipos}</span>
          </button>
        )
      })}
    </div>
  )
}
