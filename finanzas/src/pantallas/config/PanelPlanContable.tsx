import { useMemo, useState } from 'react'
import { useStore } from '../../store/store'
import { Campo, Select, Modal } from '../../componentes/formularios'
import { Tarjeta, Boton } from '../../componentes/ui'
import { PLAN_CONTABLE_DEFECTO } from '../../dominio/defaults'
import type { CuentaPGC } from '../../dominio/tipos'

const NATURALEZAS: { valor: CuentaPGC['naturaleza']; texto: string }[] = [
  { valor: 'ACTIVO', texto: 'Activo' },
  { valor: 'PASIVO', texto: 'Pasivo' },
  { valor: 'PN', texto: 'Patrimonio neto' },
  { valor: 'INGRESO', texto: 'Ingreso' },
  { valor: 'GASTO', texto: 'Gasto' },
]

export function PanelPlanContable() {
  const cuentas = useStore((s) => s.config.planContable)
  const actualizar = useStore((s) => s.actualizarConfig)
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState<CuentaPGC | null>(null)
  const [esNuevo, setEsNuevo] = useState(false)

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const lista = [...cuentas].sort((a, b) => a.codigo.localeCompare(b.codigo))
    if (!q) return lista
    return lista.filter((c) => c.codigo.includes(q) || c.nombre.toLowerCase().includes(q))
  }, [cuentas, busqueda])

  const guardar = () => {
    if (!editando) return
    if (!/^\d{3,}$/.test(editando.codigo)) return
    const grupo = Number(editando.codigo[0])
    const cuenta = { ...editando, grupo }
    const lista = esNuevo
      ? [...cuentas.filter((c) => c.codigo !== cuenta.codigo), cuenta]
      : cuentas.map((c) => (c.codigo === editando.codigo ? cuenta : c))
    actualizar({ planContable: lista })
    setEditando(null)
  }
  const eliminar = (codigo: string) => actualizar({ planContable: cuentas.filter((c) => c.codigo !== codigo) })
  const restaurar = () => actualizar({ planContable: [...PLAN_CONTABLE_DEFECTO] })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex-1 min-w-[200px]">
          <Campo etiqueta="" valor={busqueda} onChange={setBusqueda} placeholder="Buscar por código o nombre…" />
        </div>
        <div className="flex gap-2">
          <Boton variante="secundario" onClick={restaurar}>Restaurar PGC</Boton>
          <Boton onClick={() => { setEditando({ codigo: '', nombre: '', grupo: 0, naturaleza: 'GASTO' }); setEsNuevo(true) }}>+ Cuenta</Boton>
        </div>
      </div>

      <Tarjeta className="!p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: 'var(--text-muted)' }} className="text-left">
              <th className="px-4 py-2.5 font-medium">Código</th>
              <th className="px-4 py-2.5 font-medium">Cuenta</th>
              <th className="px-4 py-2.5 font-medium hidden sm:table-cell">Naturaleza</th>
              <th className="px-4 py-2.5 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((c) => (
              <tr key={c.codigo} className="border-t" style={{ borderColor: 'var(--border)' }}>
                <td className="px-4 py-2.5 tabular font-medium">{c.codigo}</td>
                <td className="px-4 py-2.5">{c.nombre}</td>
                <td className="px-4 py-2.5 hidden sm:table-cell" style={{ color: 'var(--text-muted)' }}>
                  {NATURALEZAS.find((n) => n.valor === c.naturaleza)?.texto}
                </td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap">
                  <button className="underline text-xs mr-3" onClick={() => { setEditando({ ...c }); setEsNuevo(false) }}>Editar</button>
                  <button className="underline text-xs" style={{ color: 'var(--neg)' }} onClick={() => eliminar(c.codigo)}>Borrar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Tarjeta>

      {editando && (
        <Modal titulo={esNuevo ? 'Nueva cuenta' : `Editar cuenta ${editando.codigo}`} onCerrar={() => setEditando(null)}>
          <div className="space-y-4">
            <Campo etiqueta="Código PGC" valor={editando.codigo} onChange={(v) => setEditando({ ...editando, codigo: v.replace(/\D/g, '') })} placeholder="700" ayuda="Solo dígitos, mínimo 3. El primero marca el grupo." autoFocus={esNuevo} />
            <Campo etiqueta="Nombre" valor={editando.nombre} onChange={(v) => setEditando({ ...editando, nombre: v })} placeholder="Ventas de mercaderías" />
            <Select etiqueta="Naturaleza" valor={editando.naturaleza} onChange={(v) => setEditando({ ...editando, naturaleza: v })} opciones={NATURALEZAS} />
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
