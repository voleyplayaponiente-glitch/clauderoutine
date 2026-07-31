import { useState } from 'react'
import { CabeceraPantalla } from './Pantalla'
import { PanelEmpresa } from './config/PanelEmpresa'
import { PanelCentrosCoste } from './config/PanelCentrosCoste'
import { PanelPlanContable } from './config/PanelPlanContable'
import { PanelImpuestos } from './config/PanelImpuestos'
import { PanelCategorias } from './config/PanelCategorias'
import { PanelUmbrales } from './config/PanelUmbrales'
import { PanelApariencia } from './config/PanelApariencia'
import { PanelDatos } from './config/PanelDatos'
import { PanelConexiones } from './config/PanelConexiones'

const PESTANAS = [
  { id: 'empresa', texto: 'Empresa', panel: PanelEmpresa },
  { id: 'centros', texto: 'Puntos de venta', panel: PanelCentrosCoste },
  { id: 'plan', texto: 'Plan contable', panel: PanelPlanContable },
  { id: 'impuestos', texto: 'Impuestos', panel: PanelImpuestos },
  { id: 'categorias', texto: 'Categorías', panel: PanelCategorias },
  { id: 'umbrales', texto: 'Umbrales', panel: PanelUmbrales },
  { id: 'apariencia', texto: 'Apariencia', panel: PanelApariencia },
  { id: 'conexiones', texto: 'Conexiones', panel: PanelConexiones },
  { id: 'datos', texto: 'Datos', panel: PanelDatos },
] as const

export function Configuracion() {
  const [activa, setActiva] = useState<(typeof PESTANAS)[number]['id']>('empresa')
  const Panel = PESTANAS.find((p) => p.id === activa)!.panel

  return (
    <>
      <CabeceraPantalla titulo="Configuración" descripcion="Empresa, puntos de venta, plan contable, impuestos, umbrales y apariencia." />
      <div
        className="flex gap-1 overflow-x-auto mb-6 pb-px -mx-1 px-1 border-b"
        style={{ borderColor: 'var(--border)' }}
        role="tablist"
      >
        {PESTANAS.map((p) => {
          const activo = p.id === activa
          return (
            <button
              key={p.id}
              role="tab"
              aria-selected={activo}
              onClick={() => setActiva(p.id)}
              className="px-3.5 py-2 text-sm whitespace-nowrap rounded-t-lg transition-colors"
              style={{
                color: activo ? 'var(--text)' : 'var(--text-muted)',
                fontWeight: activo ? 600 : 400,
                borderBottom: activo ? '2px solid var(--color-brand-500)' : '2px solid transparent',
              }}
            >
              {p.texto}
            </button>
          )
        })}
      </div>
      <Panel />
    </>
  )
}
