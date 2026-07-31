/** Cabecera de pantalla + estado vacío genérico para módulos aún sin datos. */
import { Tarjeta, EstadoVacio, Semaforo } from '../componentes/ui'
import type { Modulo } from '../lib/modulos'

export function CabeceraPantalla({ titulo, descripcion }: { titulo: string; descripcion?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
      {descripcion && (
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          {descripcion}
        </p>
      )}
    </div>
  )
}

/** Pantalla de módulo pendiente de implementar en su fase. */
export function PantallaModulo({ modulo }: { modulo: Modulo }) {
  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{modulo.titulo}</h1>
        </div>
        <Semaforo estado="neutro" texto={`Fase ${modulo.fase}`} />
      </div>
      <Tarjeta>
        <EstadoVacio
          icono={modulo.icono}
          titulo={`${modulo.titulo}, todavía sin datos`}
          descripcion={`${modulo.resumen} Este módulo se activa en la Fase ${modulo.fase} del plan. La navegación, el diseño y la persistencia ya funcionan.`}
        />
      </Tarjeta>
    </>
  )
}
