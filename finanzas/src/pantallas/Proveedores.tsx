import { useState } from 'react'
import { useStore } from '../store/store'
import { Campo, CampoNumero, Toggle, Modal } from '../componentes/formularios'
import { Tarjeta, Boton, EstadoVacio, Semaforo } from '../componentes/ui'
import { validarNifCif } from '../dominio/validacion'
import { nuevoId } from '../dominio/id'
import type { Tercero } from '../dominio/tipos'

export function terceroNuevo(): Tercero {
  return {
    id: nuevoId(), creadoEn: new Date().toISOString(), creadoPor: 'admin', origen: 'MANUAL',
    nombre: '', cif: '', esProveedor: true, esCliente: false, esVinculada: false, condicionesPagoDias: 30,
  }
}

export function Proveedores() {
  const terceros = useStore((s) => s.datos.terceros).filter((t) => !t.anuladoEn)
  const guardar = useStore((s) => s.guardarTercero)
  const [edit, setEdit] = useState<Tercero | null>(null)
  const [nuevo, setNuevo] = useState(false)

  const avisoCif = edit && edit.cif.trim() !== '' && !validarNifCif(edit.cif).valido ? 'El CIF no supera la validación.' : undefined

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Fichas de proveedor con CIF, condiciones de pago e IBAN.</p>
        <Boton onClick={() => { setEdit(terceroNuevo()); setNuevo(true) }}>+ Proveedor</Boton>
      </div>

      {terceros.length === 0 ? (
        <Tarjeta><EstadoVacio icono="compras" titulo="Aún no hay proveedores" descripcion="Da de alta tus proveedores para registrar compras y controlar volumen anual (modelo 347) y condiciones de pago." accion={<Boton onClick={() => { setEdit(terceroNuevo()); setNuevo(true) }}>Añadir el primero</Boton>} /></Tarjeta>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {terceros.map((t) => (
            <Tarjeta key={t.id} className="!p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{t.nombre}</div>
                  <div className="text-xs tabular" style={{ color: 'var(--text-muted)' }}>{t.cif || '—'}</div>
                </div>
                {t.esVinculada && <Semaforo estado="atencion" texto="Vinculada" />}
              </div>
              <div className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Pago a {t.condicionesPagoDias ?? 0} días</div>
              <button className="underline text-xs mt-3" onClick={() => { setEdit({ ...t }); setNuevo(false) }}>Editar</button>
            </Tarjeta>
          ))}
        </div>
      )}

      {edit && (
        <Modal titulo={nuevo ? 'Nuevo proveedor' : 'Editar proveedor'} onCerrar={() => setEdit(null)}>
          <div className="space-y-4">
            <Campo etiqueta="Nombre / Razón social" valor={edit.nombre} onChange={(v) => setEdit({ ...edit, nombre: v })} autoFocus />
            <div className="grid grid-cols-2 gap-4">
              <Campo etiqueta="CIF / NIF" valor={edit.cif} onChange={(v) => setEdit({ ...edit, cif: v.toUpperCase() })} aviso={avisoCif} />
              <CampoNumero etiqueta="Condiciones de pago" valor={edit.condicionesPagoDias ?? 0} onChange={(v) => setEdit({ ...edit, condicionesPagoDias: v })} sufijo="días" />
            </div>
            <Campo etiqueta="IBAN" valor={edit.iban ?? ''} onChange={(v) => setEdit({ ...edit, iban: v })} placeholder="ES.." />
            <Campo etiqueta="Contacto" valor={edit.contacto ?? ''} onChange={(v) => setEdit({ ...edit, contacto: v })} />
            <Toggle etiqueta="Operación vinculada (socio o empresa del grupo)" valor={edit.esVinculada} onChange={(v) => setEdit({ ...edit, esVinculada: v })} />
            <div className="flex justify-end gap-2 pt-1">
              <Boton variante="secundario" onClick={() => setEdit(null)}>Cancelar</Boton>
              <Boton onClick={() => { if (edit.nombre.trim()) { guardar(edit); setEdit(null) } }}>Guardar</Boton>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
