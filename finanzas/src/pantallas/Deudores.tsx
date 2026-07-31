import { useMemo, useState } from 'react'
import { useStore } from '../store/store'
import { CabeceraPantalla } from './Pantalla'
import { Tarjeta, Boton, EstadoVacio, Semaforo, ImporteEuro } from '../componentes/ui'
import { Campo, CampoNumero, Select, Toggle, Modal } from '../componentes/formularios'
import { TramosBarra } from '../componentes/TramosBarra'
import { hoyISO, formatearFecha } from '../lib/fechas'
import { nuevoId } from '../dominio/id'
import { formatearEuro } from '../dominio/dinero'
import { agruparPorTramo, diasVencido, provisionSugerida, type ItemVencimiento } from '../dominio/vencimientos'
import type { DeudorVario, TipoDeudor, EstadoDeudor, Reclamacion } from '../dominio/tipos'

const TIPOS: { valor: TipoDeudor; texto: string }[] = [
  { valor: 'CLIENTE_APLAZADO', texto: 'Cliente (venta aplazada)' },
  { valor: 'PRESTAMO_CONCEDIDO', texto: 'Préstamo concedido' },
  { valor: 'ANTICIPO_PROVEEDOR', texto: 'Anticipo a proveedor' },
  { valor: 'FIANZA', texto: 'Fianza depositada' },
  { valor: 'GRUPO', texto: 'Empresa del grupo' },
  { valor: 'ANTICIPO_EMPLEADO', texto: 'Anticipo a empleado' },
]
const ESTADOS: { valor: EstadoDeudor; texto: string; estado: 'positivo' | 'atencion' | 'negativo' | 'neutro' }[] = [
  { valor: 'AL_CORRIENTE', texto: 'Al corriente', estado: 'positivo' },
  { valor: 'VENCIDO', texto: 'Vencido', estado: 'atencion' },
  { valor: 'EN_RECLAMACION', texto: 'En reclamación', estado: 'negativo' },
  { valor: 'INCOBRABLE', texto: 'Incobrable', estado: 'neutro' },
]

function deudorNuevo(): DeudorVario {
  return { id: nuevoId(), creadoEn: new Date().toISOString(), creadoPor: 'admin', origen: 'MANUAL', tipo: 'CLIENTE_APLAZADO', nombre: '', importe: 0, fechaOrigen: hoyISO(), estado: 'AL_CORRIENTE', esVinculada: false, reclamaciones: [] }
}

export function Deudores() {
  const config = useStore((s) => s.config)
  const deudores = useStore((s) => s.datos.deudores).filter((d) => !d.anuladoEn)
  const guardar = useStore((s) => s.guardarDeudor)
  const anular = useStore((s) => s.anularDeudor)
  const hoy = hoyISO()
  const umbral = config.umbrales.diasRetrasoReclamar
  const [edit, setEdit] = useState<DeudorVario | null>(null)
  const [reclamar, setReclamar] = useState<DeudorVario | null>(null)

  const filas = useMemo(() => deudores.map((d) => {
    const dv = diasVencido(d.fechaVencimiento, hoy)
    const prov = d.provisionManual ?? provisionSugerida(d.importe, dv, umbral)
    return { d, diasVenc: dv, provision: prov }
  }), [deudores, hoy, umbral])

  const totalPendiente = filas.reduce((s, f) => s + f.d.importe, 0)
  const totalVencido = filas.filter((f) => f.diasVenc > 0).reduce((s, f) => s + f.d.importe, 0)
  const totalProvision = filas.reduce((s, f) => s + f.provision, 0)

  const items: ItemVencimiento[] = deudores.map((d) => ({ importe: d.importe, fechaVencimiento: d.fechaVencimiento }))
  const tramos = agruparPorTramo(items, hoy)

  const emailReclamacion = (d: DeudorVario) => {
    const asunto = encodeURIComponent(`Reclamación de importe pendiente — ${formatearEuro(d.importe)}`)
    const cuerpo = encodeURIComponent(`Estimados,\n\nLes recordamos que consta pendiente de pago el importe de ${formatearEuro(d.importe)} con fecha de origen ${formatearFecha(d.fechaOrigen)}${d.fechaVencimiento ? ` y vencimiento ${formatearFecha(d.fechaVencimiento)}` : ''}.\n\nLes rogamos regularicen la situación a la mayor brevedad.\n\nUn saludo,\n${config.empresa.razonSocial || 'La empresa'}`)
    window.open(`mailto:?subject=${asunto}&body=${cuerpo}`)
  }

  const anadirReclamacion = (medio: Reclamacion['medio'], nota: string) => {
    if (!reclamar) return
    const rec: Reclamacion = { id: nuevoId(), fecha: hoy, medio, nota: nota || undefined }
    guardar({ ...reclamar, reclamaciones: [...reclamar.reclamaciones, rec], estado: reclamar.estado === 'AL_CORRIENTE' || reclamar.estado === 'VENCIDO' ? 'EN_RECLAMACION' : reclamar.estado })
    setReclamar(null)
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4 mb-6">
        <CabeceraPantalla titulo="Deudores" descripcion="Cobros pendientes, antigüedad de saldos y provisión por insolvencia." />
        <Boton onClick={() => setEdit(deudorNuevo())}>+ Deudor</Boton>
      </div>

      {deudores.length === 0 ? (
        <Tarjeta><EstadoVacio icono="deudor" titulo="Aún no hay deudores" descripcion="Registra clientes con venta aplazada, préstamos concedidos, anticipos y fianzas. Verás la antigüedad de los saldos y la provisión sugerida." accion={<Boton onClick={() => setEdit(deudorNuevo())}>Añadir el primero</Boton>} /></Tarjeta>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Tarjeta className="!p-4"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Pendiente total</div><div className="text-lg font-semibold"><ImporteEuro valor={totalPendiente} /></div></Tarjeta>
            <Tarjeta className="!p-4"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Vencido</div><div className="text-lg font-semibold" style={{ color: totalVencido > 0 ? 'var(--neg)' : 'var(--text)' }}><ImporteEuro valor={totalVencido} /></div></Tarjeta>
            <Tarjeta className="!p-4"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Provisión sugerida</div><div className="text-lg font-semibold"><ImporteEuro valor={totalProvision} /></div></Tarjeta>
          </div>

          <Tarjeta><h3 className="font-semibold mb-3">Antigüedad de saldos</h3><TramosBarra tramos={tramos} /></Tarjeta>

          <Tarjeta className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr style={{ color: 'var(--text-muted)' }} className="text-left"><th className="px-4 py-2.5 font-medium">Deudor</th><th className="px-4 py-2.5 font-medium hidden sm:table-cell">Tipo</th><th className="px-4 py-2.5 font-medium text-right">Importe</th><th className="px-4 py-2.5 font-medium text-right">Días</th><th className="px-4 py-2.5 font-medium text-right">Provisión</th><th className="px-4 py-2.5 font-medium text-center">Estado</th><th className="px-4 py-2.5"></th></tr></thead>
                <tbody>
                  {filas.map(({ d, diasVenc, provision }) => (
                    <tr key={d.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                      <td className="px-4 py-2.5">{d.nombre}{d.reclamaciones.length > 0 && <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>· {d.reclamaciones.length} recl.</span>}</td>
                      <td className="px-4 py-2.5 hidden sm:table-cell" style={{ color: 'var(--text-muted)' }}>{TIPOS.find((t) => t.valor === d.tipo)?.texto}</td>
                      <td className="px-4 py-2.5 text-right"><ImporteEuro valor={d.importe} /></td>
                      <td className="px-4 py-2.5 text-right tabular" style={{ color: diasVenc > 0 ? 'var(--neg)' : 'var(--text-muted)' }}>{diasVenc > 0 ? `${diasVenc}` : '—'}</td>
                      <td className="px-4 py-2.5 text-right"><ImporteEuro valor={provision} /></td>
                      <td className="px-4 py-2.5 text-center"><Semaforo estado={ESTADOS.find((e) => e.valor === d.estado)!.estado} texto={ESTADOS.find((e) => e.valor === d.estado)!.texto} /></td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <button className="underline text-xs mr-3" onClick={() => setReclamar(d)}>Reclamar</button>
                        <button className="underline text-xs mr-3" onClick={() => emailReclamacion(d)}>Email</button>
                        <button className="underline text-xs mr-3" onClick={() => setEdit({ ...d })}>Editar</button>
                        <button className="underline text-xs" style={{ color: 'var(--neg)' }} onClick={() => anular(d.id)}>Anular</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tarjeta>
        </div>
      )}

      {edit && <ModalDeudor deudor={edit} setDeudor={setEdit} onGuardar={(d) => { if (d.nombre.trim()) { guardar(d); setEdit(null) } }} tipos={TIPOS} estados={ESTADOS} />}
      {reclamar && <ModalReclamacion onCerrar={() => setReclamar(null)} onGuardar={anadirReclamacion} />}
    </>
  )
}

function ModalDeudor({ deudor, setDeudor, onGuardar, tipos, estados }: { deudor: DeudorVario; setDeudor: (d: DeudorVario | null) => void; onGuardar: (d: DeudorVario) => void; tipos: { valor: TipoDeudor; texto: string }[]; estados: { valor: EstadoDeudor; texto: string }[] }) {
  return (
    <Modal titulo={deudor.nombre ? 'Editar deudor' : 'Nuevo deudor'} onCerrar={() => setDeudor(null)}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Select etiqueta="Tipo" valor={deudor.tipo} onChange={(v) => setDeudor({ ...deudor, tipo: v })} opciones={tipos.map((t) => ({ valor: t.valor, texto: t.texto }))} />
          <Campo etiqueta="Nombre" valor={deudor.nombre} onChange={(v) => setDeudor({ ...deudor, nombre: v })} autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <CampoNumero etiqueta="Importe" valor={deudor.importe} onChange={(v) => setDeudor({ ...deudor, importe: v })} sufijo="€" />
          <Select etiqueta="Estado" valor={deudor.estado} onChange={(v) => setDeudor({ ...deudor, estado: v })} opciones={estados.map((e) => ({ valor: e.valor, texto: e.texto }))} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Campo etiqueta="Fecha de origen" valor={deudor.fechaOrigen} onChange={(v) => setDeudor({ ...deudor, fechaOrigen: v })} tipo="date" />
          <Campo etiqueta="Vencimiento" valor={deudor.fechaVencimiento ?? ''} onChange={(v) => setDeudor({ ...deudor, fechaVencimiento: v || undefined })} tipo="date" />
        </div>
        <CampoNumero etiqueta="Provisión manual (opcional)" valor={deudor.provisionManual ?? 0} onChange={(v) => setDeudor({ ...deudor, provisionManual: v || undefined })} sufijo="€" ayuda="Deja 0 para usar la provisión sugerida automática." />
        <Toggle etiqueta="Saldo con empresa vinculada (grupo/socios)" valor={deudor.esVinculada} onChange={(v) => setDeudor({ ...deudor, esVinculada: v })} />
        <div className="flex justify-end gap-2 pt-1"><Boton variante="secundario" onClick={() => setDeudor(null)}>Cancelar</Boton><Boton onClick={() => onGuardar(deudor)}>Guardar</Boton></div>
      </div>
    </Modal>
  )
}

function ModalReclamacion({ onCerrar, onGuardar }: { onCerrar: () => void; onGuardar: (medio: Reclamacion['medio'], nota: string) => void }) {
  const [medio, setMedio] = useState<Reclamacion['medio']>('EMAIL')
  const [nota, setNota] = useState('')
  return (
    <Modal titulo="Registrar reclamación" onCerrar={onCerrar}>
      <div className="space-y-4">
        <Select etiqueta="Medio" valor={medio} onChange={setMedio} opciones={[{ valor: 'EMAIL', texto: 'Email' }, { valor: 'CARTA', texto: 'Carta' }, { valor: 'TELEFONO', texto: 'Teléfono' }, { valor: 'BUROFAX', texto: 'Burofax' }]} />
        <Campo etiqueta="Nota" valor={nota} onChange={setNota} placeholder="Detalle de la gestión" />
        <div className="flex justify-end gap-2 pt-1"><Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton><Boton onClick={() => onGuardar(medio, nota)}>Registrar</Boton></div>
      </div>
    </Modal>
  )
}
