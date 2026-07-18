import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { Empresa } from '@shared/types'
import { UIProvider } from './components'
import { PantallaEmpresas } from './screens/Empresas'
import { PantallaCentros } from './screens/Centros'
import { PantallaTrabajadores } from './screens/Trabajadores'
import { PantallaCuadrante } from './screens/Cuadrante'
import { PantallaInformes } from './screens/Informes'
import { PantallaExportar } from './screens/Exportar'
import { PantallaAjustes } from './screens/Ajustes'

export type Vista =
  | 'empresas'
  | 'centros'
  | 'trabajadores'
  | 'cuadrante'
  | 'informes'
  | 'exportar'
  | 'ajustes'

interface AppState {
  empresas: Empresa[]
  empresa: Empresa | null
  setEmpresaId: (id: number) => void
  recargarEmpresas: () => Promise<void>
  ir: (v: Vista) => void
}
const AppCtx = createContext<AppState>(null as unknown as AppState)
export const useApp = (): AppState => useContext(AppCtx)

const NAV: Array<{ v: Vista; label: string; icon: string }> = [
  { v: 'empresas', label: 'Empresas', icon: '🏢' },
  { v: 'centros', label: 'Centros', icon: '🏬' },
  { v: 'trabajadores', label: 'Trabajadores', icon: '👤' },
  { v: 'cuadrante', label: 'Cuadrantes / Agenda', icon: '🗓️' },
  { v: 'informes', label: 'Informes', icon: '📊' },
  { v: 'exportar', label: 'Exportación', icon: '📄' },
  { v: 'ajustes', label: 'Ajustes', icon: '⚙️' }
]

export function App(): React.JSX.Element {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [empresaId, setEmpresaIdState] = useState<number | null>(null)
  const [vista, setVista] = useState<Vista>('empresas')

  const recargarEmpresas = useCallback(async () => {
    const lista = await window.api.empresas.listar()
    setEmpresas(lista)
    setEmpresaIdState((prev) => {
      if (prev && lista.some((e) => e.id === prev)) return prev
      return lista[0]?.id ?? null
    })
  }, [])

  useEffect(() => {
    recargarEmpresas()
  }, [recargarEmpresas])

  const empresa = empresas.find((e) => e.id === empresaId) ?? null

  const ctx: AppState = {
    empresas,
    empresa,
    setEmpresaId: setEmpresaIdState,
    recargarEmpresas,
    ir: setVista
  }

  return (
    <UIProvider>
      <AppCtx.Provider value={ctx}>
        <div className="app">
          <aside className="sidebar">
            <div className="brand">⚖️ Gestor Laboral</div>
            {NAV.map((n) => (
              <button
                key={n.v}
                className={'nav-item' + (vista === n.v ? ' active' : '')}
                onClick={() => setVista(n.v)}
              >
                <span>{n.icon}</span>
                {n.label}
              </button>
            ))}
            <div className="spacer" />
            <div className="nav-sep">Empresa activa</div>
            <select
              className="mini"
              style={{ width: '100%' }}
              value={empresaId ?? ''}
              onChange={(e) => setEmpresaIdState(Number(e.target.value))}
            >
              {empresas.length === 0 && <option value="">— sin empresas —</option>}
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.razon_social}
                </option>
              ))}
            </select>
          </aside>

          <main className="main">
            {vista === 'empresas' && <PantallaEmpresas />}
            {vista === 'centros' && <PantallaCentros />}
            {vista === 'trabajadores' && <PantallaTrabajadores />}
            {vista === 'cuadrante' && <PantallaCuadrante />}
            {vista === 'informes' && <PantallaInformes />}
            {vista === 'exportar' && <PantallaExportar />}
            {vista === 'ajustes' && <PantallaAjustes />}
          </main>
        </div>
      </AppCtx.Provider>
    </UIProvider>
  )
}
