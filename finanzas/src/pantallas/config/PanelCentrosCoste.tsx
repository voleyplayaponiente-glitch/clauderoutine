import { useState } from 'react'
import { useStore } from '../../store/store'
import { Campo, CampoNumero, Select, Modal } from '../../componentes/formularios'
import { Tarjeta, Boton, EstadoVacio, Semaforo, ImporteEuro } from '../../componentes/ui'
import { nuevoId } from '../../dominio/id'
import type { CentroCoste, TipoCentroCoste, TipoPuntoVenta } from '../../dominio/tipos'

const TIPOS_CENTRO: { valor: TipoCentroCoste; texto: string }[] = [
  { valor: 'PUNTO_VENTA', texto: 'Punto de venta' },
  { valor: 'ESTRUCTURA', texto: 'Estructura (gastos generales)' },
  { valor: 'PROYECTO', texto: 'Proyecto' },
]
const TIPOS_PV: { valor: TipoPuntoVenta; texto: string }[] = [
  { valor: 'TIENDA', texto: 'Tienda física' },
  { valor: 'STAND', texto: 'Stand en centro comercial' },
  { valor: 'WEB', texto: 'Tienda online' },
  { valor: 'MARKETPLACE', texto: 'Marketplace' },
  { valor: 'MAYORISTA', texto: 'Mayorista' },
  { valor: 'EVENTO', texto: 'Evento' },
]

function centroNuevo(): CentroCoste {
  return {
    id: nuevoId(),
    creadoEn: new Date().toISOString(),
    creadoPor: 'admin',
    origen: 'MANUAL',
    codigo: '',
    nombre: '',
    tipo: 'PUNTO_VENTA',
    tipoPuntoVenta: 'TIENDA',
    activoDesde: new Date().toISOString().slice(0, 10),
    costeFijoMensual: 0,
    objetivoVentaMensual: 0,
  }
}

export function PanelCentrosCoste() {
  const centros = useStore((s) => s.config.centrosCoste)
  const actualizar = useStore((s) => s.actualizarConfig)
  const [editando, setEditando] = useState<CentroCoste | null>(null)
  const [esNuevo, setEsNuevo] = useState(false)

  const abrirNuevo = () => {
    setEditando(centroNuevo())
    setEsNuevo(true)
  }
  const abrirEditar = (c: CentroCoste) => {
    setEditando({ ...c })
    setEsNuevo(false)
  }
  const guardar = () => {
    if (!editando) return
    const lista = esNuevo
      ? [...centros, editando]
      : centros.map((c) => (c.id === editando.id ? editando : c))
    actualizar({ centrosCoste: lista })
    setEditando(null)
  }
  const cerrarCentro = (c: CentroCoste) => {
    const lista = centros.map((x) =>
      x.id === c.id ? { ...x, activoHasta: new Date().toISOString().slice(0, 10) } : x,
    )
    actualizar({ centrosCoste: lista })
  }
  const reabrir = (c: CentroCoste) => {
    const lista = centros.map((x) => (x.id === c.id ? { ...x, activoHasta: undefined } : x))
    actualizar({ centrosCoste: lista })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Puntos de venta y centros de coste. Cerrar uno conserva su histórico.
        </p>
        <Boton onClick={abrirNuevo}>+ Añadir</Boton>
      </div>

      {centros.length === 0 ? (
        <Tarjeta>
          <EstadoVacio
            icono="ventas"
            titulo="Aún no hay puntos de venta"
            descripcion="Da de alta tus tiendas, stands, la web y la estructura. Cada uno tendrá su caja, su objetivo de venta y su margen de contribución."
            accion={<Boton onClick={abrirNuevo}>Añadir el primero</Boton>}
          />
        </Tarjeta>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {centros.map((c) => {
            const cerrado = !!c.activoHasta
            return (
              <Tarjeta key={c.id} className="!p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.nombre || '(sin nombre)'}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {c.codigo || '—'} · {TIPOS_CENTRO.find((t) => t.valor === c.tipo)?.texto}
                    </div>
                  </div>
                  <Semaforo estado={cerrado ? 'neutro' : 'positivo'} texto={cerrado ? 'Cerrado' : 'Activo'} />
                </div>
                {c.tipo === 'PUNTO_VENTA' && (
                  <div className="text-xs space-y-0.5 mb-3" style={{ color: 'var(--text-muted)' }}>
                    <div>{TIPOS_PV.find((t) => t.valor === c.tipoPuntoVenta)?.texto}</div>
                    <div>Objetivo: <ImporteEuro valor={c.objetivoVentaMensual ?? 0} />/mes</div>
                    <div>Coste fijo: <ImporteEuro valor={c.costeFijoMensual ?? 0} />/mes</div>
                  </div>
                )}
                <div className="flex gap-3 text-xs">
                  <button className="underline" onClick={() => abrirEditar(c)}>Editar</button>
                  {cerrado ? (
                    <button className="underline" style={{ color: 'var(--color-brand-500)' }} onClick={() => reabrir(c)}>Reabrir</button>
                  ) : (
                    <button className="underline" style={{ color: 'var(--neg)' }} onClick={() => cerrarCentro(c)}>Cerrar</button>
                  )}
                </div>
              </Tarjeta>
            )
          })}
        </div>
      )}

      {editando && (
        <Modal titulo={esNuevo ? 'Nuevo centro de coste' : 'Editar centro de coste'} onCerrar={() => setEditando(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Campo etiqueta="Código" valor={editando.codigo} onChange={(v) => setEditando({ ...editando, codigo: v })} placeholder="T01" autoFocus />
              <Select etiqueta="Tipo" valor={editando.tipo} onChange={(v) => setEditando({ ...editando, tipo: v })} opciones={TIPOS_CENTRO} />
            </div>
            <Campo etiqueta="Nombre" valor={editando.nombre} onChange={(v) => setEditando({ ...editando, nombre: v })} placeholder="Tienda Centro" />
            {editando.tipo === 'PUNTO_VENTA' && (
              <>
                <Select etiqueta="Tipo de punto de venta" valor={editando.tipoPuntoVenta ?? 'TIENDA'} onChange={(v) => setEditando({ ...editando, tipoPuntoVenta: v })} opciones={TIPOS_PV} />
                <Campo etiqueta="Dirección" valor={editando.direccion ?? ''} onChange={(v) => setEditando({ ...editando, direccion: v })} />
                <Campo etiqueta="Responsable" valor={editando.responsable ?? ''} onChange={(v) => setEditando({ ...editando, responsable: v })} />
                <div className="grid grid-cols-2 gap-4">
                  <CampoNumero etiqueta="Coste fijo mensual" valor={editando.costeFijoMensual ?? 0} onChange={(v) => setEditando({ ...editando, costeFijoMensual: v })} sufijo="€" />
                  <CampoNumero etiqueta="Objetivo de venta" valor={editando.objetivoVentaMensual ?? 0} onChange={(v) => setEditando({ ...editando, objetivoVentaMensual: v })} sufijo="€/mes" />
                </div>
              </>
            )}
            <Campo etiqueta="Activo desde" valor={editando.activoDesde} onChange={(v) => setEditando({ ...editando, activoDesde: v })} tipo="date" />
            <div className="flex justify-end gap-2 pt-2">
              <Boton variante="secundario" onClick={() => setEditando(null)}>Cancelar</Boton>
              <Boton onClick={guardar}>Guardar</Boton>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
