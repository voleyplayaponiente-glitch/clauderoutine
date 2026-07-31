import { useState } from 'react'
import { useStore } from '../../store/store'
import { Campo, Select, Toggle, Modal } from '../../componentes/formularios'
import { Tarjeta, Boton, Semaforo } from '../../componentes/ui'
import { nuevoId } from '../../dominio/id'
import type { CategoriaGasto } from '../../dominio/tipos'

export function PanelCategorias() {
  const config = useStore((s) => s.config)
  const actualizar = useStore((s) => s.actualizarConfig)
  const [edit, setEdit] = useState<CategoriaGasto | null>(null)
  const [nuevo, setNuevo] = useState(false)

  const cuentasGasto = config.planContable
    .filter((c) => c.naturaleza === 'GASTO')
    .map((c) => ({ valor: c.codigo, texto: `${c.codigo} · ${c.nombre}` }))

  const guardar = () => {
    if (!edit) return
    const lista = nuevo ? [...config.categoriasGasto, edit] : config.categoriasGasto.map((c) => (c.id === edit.id ? edit : c))
    actualizar({ categoriasGasto: lista })
    setEdit(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Categorías de gasto con su deducibilidad por defecto y cuenta contable.</p>
        <Boton onClick={() => { setEdit({ id: nuevoId(), nombre: '', cuentaPGC: cuentasGasto[0]?.valor ?? '629', deduciblePorDefecto: true }); setNuevo(true) }}>+ Categoría</Boton>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {config.categoriasGasto.map((c) => (
          <Tarjeta key={c.id} className="!p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium">{c.nombre}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Cuenta {c.cuentaPGC}</div>
              </div>
              <Semaforo estado={c.deduciblePorDefecto ? 'positivo' : 'atencion'} texto={c.deduciblePorDefecto ? 'Deducible' : 'No deducible'} />
            </div>
            <div className="flex gap-3 text-xs mt-3">
              <button className="underline" onClick={() => { setEdit({ ...c }); setNuevo(false) }}>Editar</button>
              <button className="underline" style={{ color: 'var(--neg)' }} onClick={() => actualizar({ categoriasGasto: config.categoriasGasto.filter((x) => x.id !== c.id) })}>Borrar</button>
            </div>
          </Tarjeta>
        ))}
      </div>

      {edit && (
        <Modal titulo={nuevo ? 'Nueva categoría' : 'Editar categoría'} onCerrar={() => setEdit(null)}>
          <div className="space-y-4">
            <Campo etiqueta="Nombre" valor={edit.nombre} onChange={(v) => setEdit({ ...edit, nombre: v })} placeholder="Alquileres" autoFocus />
            <Select etiqueta="Cuenta contable" valor={edit.cuentaPGC} onChange={(v) => setEdit({ ...edit, cuentaPGC: v })} opciones={cuentasGasto} />
            <Toggle etiqueta="Deducible por defecto" valor={edit.deduciblePorDefecto} onChange={(v) => setEdit({ ...edit, deduciblePorDefecto: v })} />
            <div className="flex justify-end gap-2 pt-2">
              <Boton variante="secundario" onClick={() => setEdit(null)}>Cancelar</Boton>
              <Boton onClick={guardar}>Guardar</Boton>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
