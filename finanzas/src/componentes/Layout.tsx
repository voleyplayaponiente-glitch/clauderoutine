/** Estructura base: barra lateral con navegación + cabecera con filtros y tema. */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { MODULOS, type Modulo } from '../lib/modulos'
import { useRuta, navegar } from '../lib/router'
import { useStore } from '../store/store'
import { Icono } from './Icono'

const GRUPOS: Modulo['grupo'][] = ['Dirección', 'Operativa', 'Tesorería', 'Planificación', 'Sistema']

function NavItem({ m, activo }: { m: Modulo; activo: boolean }) {
  return (
    <button
      onClick={() => navegar(m.ruta)}
      className="flex items-center gap-3 w-full rounded-xl px-3 py-2 text-sm text-left transition-colors"
      style={{
        background: activo ? 'var(--surface-2)' : 'transparent',
        color: activo ? 'var(--text)' : 'var(--text-muted)',
        fontWeight: activo ? 600 : 400,
      }}
      aria-current={activo ? 'page' : undefined}
    >
      <span style={{ color: activo ? 'var(--color-brand-500)' : 'inherit' }}>
        <Icono nombre={m.icono} className="w-[18px] h-[18px]" />
      </span>
      {m.titulo}
    </button>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const ruta = useRuta()
  const tema = useStore((s) => s.tema)
  const alternarTema = useStore((s) => s.alternarTema)
  const empresa = useStore((s) => s.config.empresa)
  const [abierto, setAbierto] = useState(false)

  const nav = (
    <nav className="flex flex-col gap-6 p-3">
      {GRUPOS.map((g) => {
        const items = MODULOS.filter((m) => m.grupo === g)
        return (
          <div key={g}>
            <div className="px-3 mb-1.5 text-[11px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>
              {g}
            </div>
            <div className="flex flex-col gap-0.5">
              {items.map((m) => (
                <NavItem key={m.id} m={m} activo={ruta === m.ruta} />
              ))}
            </div>
          </div>
        )
      })}
    </nav>
  )

  return (
    <div className="flex h-full">
      {/* Barra lateral escritorio */}
      <aside
        className="hidden md:flex md:flex-col w-64 shrink-0 border-r overflow-y-auto"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2.5 px-5 h-16 shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg text-white text-sm font-bold" style={{ background: 'var(--color-brand-500)' }}>
            F
          </div>
          <span className="font-semibold">Finanzas</span>
        </div>
        {nav}
      </aside>

      {/* Panel lateral móvil */}
      {abierto && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setAbierto(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside
            className="absolute left-0 top-0 bottom-0 w-72 overflow-y-auto border-r"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center h-16 px-5 font-semibold">Finanzas</div>
            {nav}
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="flex items-center gap-3 h-16 px-4 md:px-6 border-b shrink-0"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <button className="md:hidden p-2 -ml-2" onClick={() => setAbierto(true)} aria-label="Abrir menú">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex-1 truncate">
            <div className="text-sm font-medium truncate">{empresa.razonSocial || 'Sin empresa configurada'}</div>
            {empresa.cif && <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{empresa.cif}</div>}
          </div>
          <button
            onClick={alternarTema}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            aria-label={tema === 'oscuro' ? 'Modo claro' : 'Modo oscuro'}
          >
            <Icono nombre={tema === 'oscuro' ? 'sol' : 'luna'} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  )
}
