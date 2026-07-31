import type { ReactNode } from 'react'
import { EmptyState } from './ui'
import { IconTrophy } from './icons'
import { navigate } from '@/lib/router'
import { useActiveTournament, useActiveCategory } from '@/store/store'

export function RequireTournament({ children }: { children: (t: NonNullable<ReturnType<typeof useActiveTournament>>) => ReactNode }) {
  const t = useActiveTournament()
  if (!t) {
    return (
      <EmptyState
        icon={<IconTrophy size={44} />}
        title="Selecciona o crea un torneo"
        message="Necesitas un torneo activo para acceder a esta sección."
        action={<button className="btn btn-primary" onClick={() => navigate('/')}>Ir al panel</button>}
      />
    )
  }
  return <>{children(t)}</>
}

export function RequireCategory({ children }: { children: (t: NonNullable<ReturnType<typeof useActiveTournament>>, c: NonNullable<ReturnType<typeof useActiveCategory>>) => ReactNode }) {
  const t = useActiveTournament()
  const c = useActiveCategory()
  if (!t) return <RequireTournament>{() => null}</RequireTournament>
  if (!c) {
    return (
      <EmptyState title="Sin categorías" message="Crea una categoría para continuar." action={<button className="btn btn-primary" onClick={() => navigate('/categorias')}>Gestionar categorías</button>} />
    )
  }
  return <>{children(t, c)}</>
}
