import { useState } from 'react'
import { useRoute, navigate } from './lib/router'
import { useStore, useActiveTournament } from './store/store'
import {
  IconHome, IconTrophy, IconSettings, IconLayers, IconUsers, IconGrid,
  IconCalendar, IconTable, IconBracket, IconEye, IconDownload, IconDatabase,
  IconMoon, IconSun, IconMenu, IconEdit,
} from './components/icons'
import { Dashboard } from './screens/Dashboard'
import { TournamentEdit } from './screens/TournamentEdit'
import { ConfigScreen } from './screens/ConfigScreen'
import { Categories } from './screens/Categories'
import { Teams } from './screens/Teams'
import { Draw } from './screens/Draw'
import { Schedule } from './screens/Schedule'
import { Results } from './screens/Results'
import { Standings } from './screens/Standings'
import { BracketScreen } from './screens/Bracket'
import { PublicView } from './screens/PublicView'
import { ExportScreen } from './screens/Export'
import { Backup } from './screens/Backup'
import { CategoryTabs } from './components/CategoryTabs'

interface NavItem {
  path: string
  label: string
  icon: React.ComponentType<{ size?: number }>
  admin?: boolean
}

const NAV: NavItem[] = [
  { path: '/', label: 'Panel principal', icon: IconHome },
  { path: '/torneo', label: 'Torneo', icon: IconTrophy, admin: true },
  { path: '/config', label: 'Sistema de competición', icon: IconSettings, admin: true },
  { path: '/categorias', label: 'Categorías', icon: IconLayers, admin: true },
  { path: '/equipos', label: 'Equipos y jugadores', icon: IconUsers, admin: true },
  { path: '/grupos', label: 'Sorteo y grupos', icon: IconGrid, admin: true },
  { path: '/calendario', label: 'Calendario', icon: IconCalendar },
  { path: '/resultados', label: 'Resultados', icon: IconEdit, admin: true },
  { path: '/clasificacion', label: 'Clasificaciones', icon: IconTable },
  { path: '/cuadro', label: 'Cuadro eliminatorio', icon: IconBracket },
  { path: '/publico', label: 'Vista pública', icon: IconEye },
  { path: '/exportar', label: 'Impresión y export.', icon: IconDownload },
  { path: '/backup', label: 'Copia de seguridad', icon: IconDatabase, admin: true },
]

export default function App() {
  const route = useRoute()
  const role = useStore((s) => s.role)
  const setRole = useStore((s) => s.setRole)
  const theme = useStore((s) => s.theme)
  const toggleTheme = useStore((s) => s.toggleTheme)
  const tournaments = useStore((s) => s.tournaments)
  const activeTournament = useActiveTournament()
  const setActiveTournament = useStore((s) => s.setActiveTournament)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const visibleNav = NAV.filter((n) => (role === 'admin' ? true : !n.admin))

  const screen = () => {
    const p = route.path
    if (p === '/') return <Dashboard />
    if (p === '/torneo') return <TournamentEdit />
    if (p === '/config') return <ConfigScreen />
    if (p === '/categorias') return <Categories />
    if (p === '/equipos') return <Teams />
    if (p === '/grupos') return <Draw />
    if (p === '/calendario') return <Schedule />
    if (p === '/resultados') return <Results />
    if (p === '/clasificacion') return <Standings />
    if (p === '/cuadro') return <BracketScreen />
    if (p === '/publico') return <PublicView />
    if (p === '/exportar') return <ExportScreen />
    if (p === '/backup') return <Backup />
    return <Dashboard />
  }

  const showCategoryTabs =
    activeTournament && !['/', '/torneo', '/categorias', '/backup'].includes(route.path)

  const NavList = () => (
    <nav className="flex flex-col gap-1">
      {visibleNav.map((item) => {
        const Icon = item.icon
        const active = route.path === item.path
        return (
          <button
            key={item.path}
            onClick={() => {
              navigate(item.path)
              setDrawerOpen(false)
            }}
            className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition"
            style={{
              background: active ? 'var(--color-brand-500)' : 'transparent',
              color: active ? '#fff' : 'var(--text)',
              fontWeight: active ? 700 : 500,
            }}
          >
            <Icon size={20} />
            <span className="text-sm">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )

  return (
    <div style={{ minHeight: '100%', display: 'flex' }}>
      {/* Sidebar desktop */}
      <aside
        className="no-print"
        style={{
          width: 260,
          borderRight: '1px solid var(--border)',
          padding: 16,
          position: 'sticky',
          top: 0,
          height: '100vh',
          overflowY: 'auto',
          background: 'var(--surface)',
          flexShrink: 0,
        }}
      >
        <Brand />
        <div style={{ height: 16 }} />
        <NavList />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="no-print" style={{ position: 'fixed', inset: 0, zIndex: 90, display: 'flex' }}>
          <div onClick={() => setDrawerOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)' }} />
          <aside style={{ position: 'relative', width: 270, background: 'var(--surface)', padding: 16, height: '100%', overflowY: 'auto' }}>
            <Brand />
            <div style={{ height: 16 }} />
            <NavList />
          </aside>
        </div>
      )}

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header
          className="no-print"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 40,
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <button className="btn btn-ghost sidebar-toggle" onClick={() => setDrawerOpen(true)} style={{ padding: 8 }}>
            <IconMenu />
          </button>
          <select
            className="input"
            style={{ maxWidth: 260, width: 'auto' }}
            value={activeTournament?.id ?? ''}
            onChange={(e) => setActiveTournament(e.target.value)}
          >
            {tournaments.length === 0 && <option value="">Sin torneos</option>}
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
          <div style={{ flex: 1 }} />
          <div className="chip" style={{ background: 'var(--surface-2)' }}>
            {role === 'admin' ? 'Administrador' : 'Público'}
          </div>
          <button
            className="btn btn-ghost"
            style={{ padding: 8 }}
            onClick={() => setRole(role === 'admin' ? 'public' : 'admin')}
            title="Cambiar rol"
          >
            {role === 'admin' ? <IconEye size={18} /> : <IconEdit size={18} />}
          </button>
          <button className="btn btn-ghost" style={{ padding: 8 }} onClick={toggleTheme} title="Tema">
            {theme === 'light' ? <IconMoon size={18} /> : <IconSun size={18} />}
          </button>
        </header>

        <main style={{ padding: 20, maxWidth: 1200, width: '100%', margin: '0 auto', flex: 1 }}>
          {showCategoryTabs && <CategoryTabs />}
          {screen()}
        </main>
      </div>

      <style>{`
        @media (min-width: 900px) { .sidebar-toggle { display: none !important; } }
        @media (max-width: 899px) { aside:first-of-type { display: none !important; } }
      `}</style>
    </div>
  )
}

function Brand() {
  return (
    <button onClick={() => navigate('/')} className="flex items-center gap-2.5" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
      <div style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--color-brand-500)', display: 'grid', placeItems: 'center', color: '#fff' }}>
        <IconTrophy size={22} />
      </div>
      <div style={{ textAlign: 'left', lineHeight: 1.1 }}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>Torneos</div>
        <div className="text-muted" style={{ fontSize: 12 }}>Vóley Playa</div>
      </div>
    </button>
  )
}
