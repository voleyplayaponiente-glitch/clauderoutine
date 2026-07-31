import { useState } from 'react'
import { useStore } from '../../store/store'
import { Campo, CampoNumero, Select, Modal } from '../../componentes/formularios'
import { Tarjeta, Boton, Semaforo } from '../../componentes/ui'
import { formatearPorcentaje, formatearEuro } from '../../dominio/dinero'
import { nuevoId } from '../../dominio/id'
import type { TipoIva, ImpuestoEspecial, RegimenIva } from '../../dominio/tipos'

const REGIMENES: { valor: RegimenIva; texto: string }[] = [
  { valor: 'GENERAL', texto: 'General (repercute)' },
  { valor: 'EXENTO', texto: 'Exento' },
  { valor: 'NO_SUJETO', texto: 'No sujeto' },
  { valor: 'ISP', texto: 'Inversión del sujeto pasivo' },
]

export function PanelImpuestos() {
  const config = useStore((s) => s.config)
  const actualizar = useStore((s) => s.actualizarConfig)
  const [iva, setIva] = useState<TipoIva | null>(null)
  const [ivaNuevo, setIvaNuevo] = useState(false)
  const [iiee, setIiee] = useState<ImpuestoEspecial | null>(null)
  const [iieeNuevo, setIieeNuevo] = useState(false)

  const guardarIva = () => {
    if (!iva) return
    const lista = ivaNuevo ? [...config.tiposIva, iva] : config.tiposIva.map((t) => (t.id === iva.id ? iva : t))
    actualizar({ tiposIva: lista })
    setIva(null)
  }
  const guardarIiee = () => {
    if (!iiee) return
    const lista = iieeNuevo ? [...config.impuestosEspeciales, iiee] : config.impuestosEspeciales.map((t) => (t.id === iiee.id ? iiee : t))
    actualizar({ impuestosEspeciales: lista })
    setIiee(null)
  }

  return (
    <div className="space-y-6">
      {/* Tipos de IVA */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Tipos de IVA y retenciones</h3>
          <Boton onClick={() => { setIva({ id: nuevoId(), nombre: '', tipo: 21, regimen: 'GENERAL', vigenteDesde: new Date().toISOString().slice(0, 10) }); setIvaNuevo(true) }}>+ Tipo</Boton>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {config.tiposIva.map((t) => (
            <Tarjeta key={t.id} className="!p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">{t.nombre}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {t.regimen === 'GENERAL' ? formatearPorcentaje(t.tipo) : REGIMENES.find((r) => r.valor === t.regimen)?.texto}
                  </div>
                </div>
                {t.porDefecto && <Semaforo estado="positivo" texto="Por defecto" />}
              </div>
              <div className="flex gap-3 text-xs mt-3">
                <button className="underline" onClick={() => { setIva({ ...t }); setIvaNuevo(false) }}>Editar</button>
                {!t.porDefecto && (
                  <button className="underline" style={{ color: 'var(--neg)' }} onClick={() => actualizar({ tiposIva: config.tiposIva.filter((x) => x.id !== t.id) })}>Borrar</button>
                )}
              </div>
            </Tarjeta>
          ))}
        </div>
      </section>

      {/* Impuestos especiales */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Impuestos especiales</h3>
          <Boton onClick={() => { setIiee({ id: nuevoId(), nombre: '', base: 'POR_ML', importePorUnidad: 0, familiasAplicables: [], vigenteDesde: new Date().toISOString().slice(0, 10) }); setIieeNuevo(true) }}>+ Impuesto</Boton>
        </div>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
          Parametrizable por familia de producto (por ml o por unidad). Verifica el tipo vigente antes de aplicarlo.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {config.impuestosEspeciales.map((t) => (
            <Tarjeta key={t.id} className="!p-4">
              <div className="font-medium">{t.nombre}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {formatearEuro(t.importePorUnidad)} {t.base === 'POR_ML' ? 'por ml' : 'por unidad'} · desde {t.vigenteDesde}
              </div>
              <div className="flex gap-3 text-xs mt-3">
                <button className="underline" onClick={() => { setIiee({ ...t }); setIieeNuevo(false) }}>Editar</button>
                <button className="underline" style={{ color: 'var(--neg)' }} onClick={() => actualizar({ impuestosEspeciales: config.impuestosEspeciales.filter((x) => x.id !== t.id) })}>Borrar</button>
              </div>
            </Tarjeta>
          ))}
        </div>
      </section>

      {/* Calendario fiscal */}
      <section>
        <h3 className="font-semibold mb-3">Calendario fiscal</h3>
        <Tarjeta className="!p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--text-muted)' }} className="text-left">
                <th className="px-4 py-2.5 font-medium">Modelo</th>
                <th className="px-4 py-2.5 font-medium">Descripción</th>
                <th className="px-4 py-2.5 font-medium">Periodicidad</th>
              </tr>
            </thead>
            <tbody>
              {config.obligacionesFiscales.map((o) => (
                <tr key={o.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                  <td className="px-4 py-2.5 font-medium tabular">{o.modelo}</td>
                  <td className="px-4 py-2.5">{o.descripcion}</td>
                  <td className="px-4 py-2.5" style={{ color: 'var(--text-muted)' }}>{o.periodicidad.toLowerCase()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tarjeta>
      </section>

      {iva && (
        <Modal titulo={ivaNuevo ? 'Nuevo tipo de IVA' : 'Editar tipo de IVA'} onCerrar={() => setIva(null)}>
          <div className="space-y-4">
            <Campo etiqueta="Nombre" valor={iva.nombre} onChange={(v) => setIva({ ...iva, nombre: v })} placeholder="General 21 %" autoFocus />
            <div className="grid grid-cols-2 gap-4">
              <CampoNumero etiqueta="Tipo" valor={iva.tipo} onChange={(v) => setIva({ ...iva, tipo: v })} sufijo="%" />
              <Select etiqueta="Régimen" valor={iva.regimen} onChange={(v) => setIva({ ...iva, regimen: v })} opciones={REGIMENES} />
            </div>
            <Campo etiqueta="Vigente desde" valor={iva.vigenteDesde} onChange={(v) => setIva({ ...iva, vigenteDesde: v })} tipo="date" />
            <div className="flex justify-end gap-2 pt-2">
              <Boton variante="secundario" onClick={() => setIva(null)}>Cancelar</Boton>
              <Boton onClick={guardarIva}>Guardar</Boton>
            </div>
          </div>
        </Modal>
      )}

      {iiee && (
        <Modal titulo={iieeNuevo ? 'Nuevo impuesto especial' : 'Editar impuesto especial'} onCerrar={() => setIiee(null)}>
          <div className="space-y-4">
            <Campo etiqueta="Nombre" valor={iiee.nombre} onChange={(v) => setIiee({ ...iiee, nombre: v })} placeholder="Líquidos vapeo ≤ 15 mg/ml" autoFocus />
            <div className="grid grid-cols-2 gap-4">
              <CampoNumero etiqueta="Importe" valor={iiee.importePorUnidad} onChange={(v) => setIiee({ ...iiee, importePorUnidad: v })} sufijo="€" paso="0.01" />
              <Select etiqueta="Base" valor={iiee.base} onChange={(v) => setIiee({ ...iiee, base: v })} opciones={[{ valor: 'POR_ML', texto: 'Por ml' }, { valor: 'POR_UNIDAD', texto: 'Por unidad' }]} />
            </div>
            <Campo etiqueta="Familias aplicables (separadas por coma)" valor={iiee.familiasAplicables.join(', ')} onChange={(v) => setIiee({ ...iiee, familiasAplicables: v.split(',').map((s) => s.trim()).filter(Boolean) })} placeholder="Líquidos, Sales de nicotina" />
            <Campo etiqueta="Vigente desde" valor={iiee.vigenteDesde} onChange={(v) => setIiee({ ...iiee, vigenteDesde: v })} tipo="date" />
            <div className="flex justify-end gap-2 pt-2">
              <Boton variante="secundario" onClick={() => setIiee(null)}>Cancelar</Boton>
              <Boton onClick={guardarIiee}>Guardar</Boton>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
