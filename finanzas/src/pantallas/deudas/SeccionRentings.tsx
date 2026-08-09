import { Fragment, useMemo, useState } from 'react'
import { useStore } from '../../store/store'
import { Tarjeta, Boton, EstadoVacio, Semaforo, ImporteEuro } from '../../componentes/ui'
import { Campo, CampoNumero, Select, Modal } from '../../componentes/formularios'
import { hoyISO, formatearFecha } from '../../lib/fechas'
import { nuevoId } from '../../dominio/id'
import { formatearEuro } from '../../dominio/dinero'
import { avisosRenting, cuadroRenting, resumenRenting } from '../../dominio/renting'
import type { DatosRenting } from '../../dominio/renting-archivo'
import type { Renting } from '../../dominio/tipos'

/** Tipo de IVA marcado por defecto en Configuración (nunca uno inventado). */
function ivaPorDefecto(tipos: { tipo: number; porDefecto?: boolean }[]): number {
  return tipos.find((t) => t.porDefecto)?.tipo ?? tipos[0]?.tipo ?? 21
}

export function rentingNuevo(tipoIva: number): Renting {
  return {
    id: nuevoId(),
    creadoEn: new Date().toISOString(),
    creadoPor: 'admin',
    origen: 'MANUAL',
    arrendador: '',
    descripcion: '',
    cuotaBase: 0,
    tipoIva,
    periodicidad: 'MENSUAL',
    nCuotas: 48,
    fechaInicio: hoyISO(),
  }
}

/** Convierte lo leído del PDF del banco en un renting listo para revisar. */
export function rentingDesdeFichero(d: DatosRenting, tipoIva: number): Renting {
  return {
    ...rentingNuevo(tipoIva),
    origen: 'PDF',
    arrendador: d.arrendador ?? '',
    numeroContrato: d.numeroContrato,
    cuentaVinculada: d.cuentaVinculada,
    descripcion: d.descripcion ?? '',
    matricula: d.matricula,
    bastidor: d.bastidor,
    cuotaBase: d.cuotaBase ?? 0,
    // Si la ficha dice que la cuota NO lleva IVA, se respeta: 0.
    tipoIva: d.llevaIva === false ? 0 : tipoIva,
    periodicidad: d.periodicidad ?? 'MENSUAL',
    nCuotas: d.nCuotas ?? 48,
    cuotasFacturadas: d.cuotasFacturadas,
    fechaInicio: d.fechaInicio ?? hoyISO(),
    fechaFin: d.fechaFin,
    fianza: d.fianza,
    kmContratados: d.kmContratados,
    notas: d.version ? `Versión ${d.version}` : undefined,
  }
}

export function SeccionRentings({
  lectura,
  onCerrarLectura,
  plantilla,
  onCerrarPlantilla,
}: {
  lectura: DatosRenting | null
  onCerrarLectura: () => void
  /** Renting a medio empezar que llega desde fuera (p. ej. del modal de deuda). */
  plantilla?: Renting | null
  onCerrarPlantilla?: () => void
}) {
  const rentings = useStore((s) => s.datos.rentings).filter((r) => !r.anuladoEn)
  const tiposIva = useStore((s) => s.config.tiposIva)
  const centros = useStore((s) => s.config.centrosCoste)
  const guardar = useStore((s) => s.guardarRenting)
  const anular = useStore((s) => s.anularRenting)
  const hoy = hoyISO()
  const [edit, setEdit] = useState<Renting | null>(null)
  const [expandido, setExpandido] = useState<string | null>(null)
  const ivaDefecto = ivaPorDefecto(tiposIva)

  // La revisión del fichero se monta en cuanto llega la lectura.
  const revisar = useMemo(
    () => (lectura ? rentingDesdeFichero(lectura, ivaDefecto) : (plantilla ?? null)),
    [lectura, ivaDefecto, plantilla],
  )
  const cerrarRevision = () => {
    onCerrarLectura()
    onCerrarPlantilla?.()
  }

  const conResumen = rentings.map((r) => ({ renting: r, res: resumenRenting(r, hoy), avisos: avisosRenting(r, hoy) }))
  const gastoAnual = conResumen.reduce((s, x) => s + x.res.cuotas.filter((c) => c.fecha.slice(0, 4) === hoy.slice(0, 4)).reduce((t, c) => t + c.base, 0), 0)
  const compromiso = conResumen.reduce((s, x) => s + x.res.compromisoPendiente, 0)
  const caja = conResumen.reduce((s, x) => s + x.res.cajaPendiente, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Rentings</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No son deuda: son un gasto mensual. Cuota lineal sin intereses y, al acabar, se devuelve el bien.
          </p>
        </div>
        <Boton variante="secundario" onClick={() => setEdit(rentingNuevo(ivaDefecto))}>+ Renting</Boton>
      </div>

      {revisar && (
        <ModalRenting
          renting={revisar}
          titulo={lectura ? 'Alta de renting desde el fichero del banco' : 'Nuevo renting'}
          avisos={lectura?.avisos ?? []}
          leido={lectura?.encontrados ?? []}
          centros={centros}
          tiposIva={tiposIva}
          onCerrar={cerrarRevision}
          onGuardar={(r) => { guardar(r); cerrarRevision() }}
        />
      )}

      {rentings.length === 0 ? (
        <Tarjeta>
          <EstadoVacio
            icono="deuda"
            titulo="Aún no hay rentings"
            descripcion="Sube la ficha del contrato que descarga el banco o dalo de alta a mano. Verás el gasto mensual, el IVA y lo que queda comprometido hasta la devolución."
            accion={<Boton onClick={() => setEdit(rentingNuevo(ivaDefecto))}>Añadir el primero</Boton>}
          />
        </Tarjeta>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <Tarjeta className="!p-4">
              <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Gasto de este año (sin IVA)</div>
              <div className="text-lg font-semibold"><ImporteEuro valor={gastoAnual} /></div>
            </Tarjeta>
            <Tarjeta className="!p-4">
              <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Compromiso pendiente (sin IVA)</div>
              <div className="text-lg font-semibold"><ImporteEuro valor={compromiso} /></div>
            </Tarjeta>
            <Tarjeta className="!p-4">
              <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Saldrá del banco (con IVA)</div>
              <div className="text-lg font-semibold"><ImporteEuro valor={caja} /></div>
            </Tarjeta>
          </div>

          <Tarjeta className="!p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: 'var(--text-muted)' }} className="text-left">
                  <th className="px-4 py-2.5 font-medium">Contrato</th>
                  <th className="px-4 py-2.5 font-medium hidden sm:table-cell">Arrendador</th>
                  <th className="px-4 py-2.5 font-medium text-right">Cuota + IVA</th>
                  <th className="px-4 py-2.5 font-medium text-right hidden sm:table-cell">Cuotas</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {conResumen.map((x) => {
                  const iva = x.res.cuotas[0]?.iva ?? 0
                  return (
                    <Fragment key={x.renting.id}>
                      <tr className="border-t" style={{ borderColor: 'var(--border)' }}>
                        <td className="px-4 py-2.5">
                          {x.renting.descripcion || '(sin descripción)'}
                          {x.renting.matricula && <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>{x.renting.matricula}</span>}
                        </td>
                        <td className="px-4 py-2.5 hidden sm:table-cell">{x.renting.arrendador || '—'}</td>
                        <td className="px-4 py-2.5 text-right tabular">
                          {formatearEuro(x.renting.cuotaBase)}
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}> + {formatearEuro(iva)}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular hidden sm:table-cell">{x.res.pagadas}/{x.renting.nCuotas}</td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <button className="underline text-xs mr-3" onClick={() => setExpandido(expandido === x.renting.id ? null : x.renting.id)}>
                            {expandido === x.renting.id ? 'Ocultar' : 'Cuotas'}
                          </button>
                          <button className="underline text-xs mr-3" onClick={() => setEdit({ ...x.renting })}>Editar</button>
                          <button className="underline text-xs" style={{ color: 'var(--neg)' }} onClick={() => anular(x.renting.id)}>Anular</button>
                        </td>
                      </tr>
                      {x.avisos.length > 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 pb-2 text-xs" style={{ color: 'var(--warn)' }}>
                            {x.avisos.map((a) => <div key={a}>· {a}</div>)}
                          </td>
                        </tr>
                      )}
                      {expandido === x.renting.id && (
                        <tr style={{ background: 'var(--surface-2)' }}>
                          <td colSpan={5} className="px-4 py-3">
                            <div className="overflow-x-auto max-h-72">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr style={{ color: 'var(--text-muted)' }} className="text-left">
                                    <th className="px-2 py-1">#</th><th className="px-2 py-1">Fecha</th>
                                    <th className="px-2 py-1 text-right">Cuota</th><th className="px-2 py-1 text-right">IVA</th>
                                    <th className="px-2 py-1 text-right">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {cuadroRenting(x.renting).map((c) => (
                                    <tr key={c.numero} style={{ opacity: c.fecha <= hoy ? 0.5 : 1 }}>
                                      <td className="px-2 py-1 tabular">{c.numero}</td>
                                      <td className="px-2 py-1 tabular">{formatearFecha(c.fecha)}</td>
                                      <td className="px-2 py-1 text-right tabular">{formatearEuro(c.base)}</td>
                                      <td className="px-2 py-1 text-right tabular">{formatearEuro(c.iva)}</td>
                                      <td className="px-2 py-1 text-right tabular">{formatearEuro(c.total)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </Tarjeta>
        </>
      )}

      {edit && (
        <ModalRenting
          renting={edit}
          titulo={edit.descripcion ? 'Editar renting' : 'Nuevo renting'}
          avisos={[]}
          leido={[]}
          centros={centros}
          tiposIva={tiposIva}
          onCerrar={() => setEdit(null)}
          onGuardar={(r) => { guardar(r); setEdit(null) }}
        />
      )}
    </div>
  )
}

function ModalRenting({
  renting,
  titulo,
  avisos,
  leido,
  centros,
  tiposIva,
  onCerrar,
  onGuardar,
}: {
  renting: Renting
  titulo: string
  avisos: string[]
  leido: string[]
  centros: { id: string; nombre: string }[]
  tiposIva: { id: string; nombre: string; tipo: number }[]
  onCerrar: () => void
  onGuardar: (r: Renting) => void
}) {
  const [r, setR] = useState<Renting>(renting)
  const res = resumenRenting(r, hoyISO())
  const cuota = res.cuotas[0]

  return (
    <Modal titulo={titulo} onCerrar={onCerrar}>
      <div className="space-y-4">
        {leido.length > 0 && (
          <div className="rounded-xl p-3 text-sm space-y-1" style={{ background: 'var(--surface-2)' }}>
            <p className="font-medium">Leído del fichero: {leido.join(', ')}. Revísalo antes de guardar.</p>
            {avisos.map((a) => <p key={a} style={{ color: 'var(--warn)' }}>· {a}</p>)}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Campo etiqueta="Qué se alquila" valor={r.descripcion} onChange={(v) => setR({ ...r, descripcion: v })} autoFocus />
          <Campo etiqueta="Arrendador" valor={r.arrendador} onChange={(v) => setR({ ...r, arrendador: v })} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Campo etiqueta="Nº de contrato" valor={r.numeroContrato ?? ''} onChange={(v) => setR({ ...r, numeroContrato: v || undefined })} />
          <Campo etiqueta="Matrícula" valor={r.matricula ?? ''} onChange={(v) => setR({ ...r, matricula: v || undefined })} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <CampoNumero etiqueta="Cuota sin IVA" valor={r.cuotaBase} onChange={(v) => setR({ ...r, cuotaBase: v })} sufijo="€" paso="0.01" />
          <Select
            etiqueta="IVA de la cuota"
            valor={String(r.tipoIva)}
            onChange={(v) => setR({ ...r, tipoIva: Number(v) })}
            opciones={[...tiposIva.map((t) => ({ valor: String(t.tipo), texto: t.nombre })), { valor: '0', texto: 'Sin IVA' }]}
          />
          <Select
            etiqueta="Periodicidad"
            valor={r.periodicidad}
            onChange={(v) => setR({ ...r, periodicidad: v })}
            opciones={[{ valor: 'MENSUAL', texto: 'Mensual' }, { valor: 'TRIMESTRAL', texto: 'Trimestral' }, { valor: 'ANUAL', texto: 'Anual' }]}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <CampoNumero etiqueta="Nº de cuotas" valor={r.nCuotas} onChange={(v) => setR({ ...r, nCuotas: Math.max(1, v) })} />
          <Campo etiqueta="Fecha de contratación" valor={r.fechaInicio} onChange={(v) => setR({ ...r, fechaInicio: v })} tipo="date" />
          <Campo etiqueta="Vencimiento" valor={r.fechaFin ?? ''} onChange={(v) => setR({ ...r, fechaFin: v || undefined })} tipo="date" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <CampoNumero etiqueta="Fianza" valor={r.fianza ?? 0} onChange={(v) => setR({ ...r, fianza: v || undefined })} sufijo="€" />
          <CampoNumero etiqueta="Km contratados" valor={r.kmContratados ?? 0} onChange={(v) => setR({ ...r, kmContratados: v || undefined })} />
          <Select
            etiqueta="Punto de venta"
            valor={r.centroCosteId ?? ''}
            onChange={(v) => setR({ ...r, centroCosteId: v || undefined })}
            opciones={[{ valor: '', texto: '(sin asignar)' }, ...centros.map((c) => ({ valor: c.id, texto: c.nombre }))]}
          />
        </div>

        {/* Lo que de verdad importa: cuánto es gasto y cuánto sale del banco. */}
        <div className="rounded-xl p-3 text-sm space-y-1" style={{ background: 'var(--surface-2)' }}>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>Cuota con IVA (lo que sale del banco)</span>
            <span className="tabular font-medium">{cuota ? formatearEuro(cuota.total) : '—'}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>Coste total del contrato (sin IVA)</span>
            <span className="tabular">{formatearEuro(res.costeTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>Última cuota</span>
            <span className="tabular">{res.fechaUltimaCuota ? formatearFecha(res.fechaUltimaCuota) : '—'}</span>
          </div>
          <p className="text-xs pt-1" style={{ color: 'var(--text-muted)' }}>
            Al presupuesto va la cuota SIN IVA, porque el IVA soportado se deduce. El renting no genera deuda en el balance:
            lo pendiente es un compromiso, y al final del contrato se devuelve el bien.
          </p>
        </div>

        {avisosRenting(r, hoyISO()).map((a) => (
          <p key={a} className="text-xs" style={{ color: 'var(--warn)' }}>· {a}</p>
        ))}

        <div className="flex justify-end gap-2 pt-1">
          <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={() => { if (r.descripcion.trim() && r.cuotaBase > 0) onGuardar(r) }}>Guardar</Boton>
        </div>
        {(!r.descripcion.trim() || r.cuotaBase <= 0) && (
          <p className="text-xs text-right" style={{ color: 'var(--warn)' }}>Indica qué se alquila y el importe de la cuota.</p>
        )}
      </div>
    </Modal>
  )
}
