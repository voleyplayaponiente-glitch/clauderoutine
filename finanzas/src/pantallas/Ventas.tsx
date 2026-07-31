import { useMemo, useState } from 'react'
import { useStore } from '../store/store'
import { CabeceraPantalla } from './Pantalla'
import { Tarjeta, Boton, EstadoVacio, Semaforo, ImporteEuro } from '../componentes/ui'
import { Campo, CampoNumero, Select, Modal } from '../componentes/formularios'
import { EditorLineasIva } from '../componentes/EditorLineasIva'
import { navegar } from '../lib/router'
import { hoyISO, formatearFecha, mesDe, nombreMes } from '../lib/fechas'
import { nuevoId } from '../dominio/id'
import { brutoVenta, ticketMedio, cuadreVenta, totalCobros } from '../dominio/ventas'
import { formatearEuro } from '../dominio/dinero'
import type { Venta, FormaCobro, LineaIva } from '../dominio/tipos'

const FORMAS: { forma: FormaCobro; texto: string }[] = [
  { forma: 'EFECTIVO', texto: 'Efectivo' },
  { forma: 'TARJETA', texto: 'Tarjeta' },
  { forma: 'BIZUM', texto: 'Bizum' },
  { forma: 'TRANSFERENCIA', texto: 'Transferencia' },
  { forma: 'PASARELA', texto: 'Pasarela online' },
  { forma: 'APLAZADO', texto: 'Aplazado' },
]

function ventaNueva(centroCosteId: string): Venta {
  return {
    id: nuevoId(), creadoEn: new Date().toISOString(), creadoPor: 'admin', origen: 'MANUAL',
    centroCosteId, fecha: hoyISO(), lineasIva: [], cobros: [], numTickets: 0, unidades: 0, cerrado: false,
  }
}

export function Ventas() {
  const config = useStore((s) => s.config)
  const ventas = useStore((s) => s.datos.ventas).filter((v) => !v.anuladoEn)
  const guardarVenta = useStore((s) => s.guardarVenta)
  const anularVenta = useStore((s) => s.anularVenta)

  const puntos = config.centrosCoste.filter((c) => c.tipo === 'PUNTO_VENTA' && !c.activoHasta)
  const [editando, setEditando] = useState<Venta | null>(null)
  const [firma, setFirma] = useState('')

  const nombrePunto = (id: string) => config.centrosCoste.find((c) => c.id === id)?.nombre ?? '—'

  const porMes = useMemo(() => {
    const mapa = new Map<string, Venta[]>()
    for (const v of [...ventas].sort((a, b) => b.fecha.localeCompare(a.fecha))) {
      const k = mesDe(v.fecha)
      mapa.set(k, [...(mapa.get(k) ?? []), v])
    }
    return [...mapa.entries()]
  }, [ventas])

  if (puntos.length === 0) {
    return (
      <>
        <CabeceraPantalla titulo="Ventas diarias" />
        <Tarjeta>
          <EstadoVacio
            icono="ventas"
            titulo="Primero da de alta un punto de venta"
            descripcion="Las ventas se registran por punto de venta. Crea tus tiendas, stands o la web en Configuración y vuelve aquí."
            accion={<Boton onClick={() => navegar('/configuracion')}>Ir a Configuración</Boton>}
          />
        </Tarjeta>
      </>
    )
  }

  const abrirNueva = () => { setEditando(ventaNueva(puntos[0].id)); setFirma('') }

  const setCobro = (forma: FormaCobro, importe: number) => {
    if (!editando) return
    const otros = editando.cobros.filter((c) => c.forma !== forma)
    const cobros = importe > 0 ? [...otros, { forma, importe }] : otros
    setEditando({ ...editando, cobros })
  }
  const cobroDe = (forma: FormaCobro) => editando?.cobros.find((c) => c.forma === forma)?.importe ?? 0

  const guardar = (cerrar: boolean) => {
    if (!editando) return
    const cuadre = cuadreVenta(editando)
    if (cerrar && !cuadre.cuadra) return // no se puede cerrar un día descuadrado
    guardarVenta({ ...editando, cerrado: cerrar, firmadoPor: cerrar ? firma || 'admin' : editando.firmadoPor })
    setEditando(null)
  }

  const cuadre = editando ? cuadreVenta(editando) : null

  return (
    <>
      <div className="flex items-start justify-between gap-4 mb-6">
        <CabeceraPantalla titulo="Ventas diarias" descripcion="Registro diario de ingresos por punto de venta, IVA y forma de cobro." />
        <Boton onClick={abrirNueva}>+ Registrar venta</Boton>
      </div>

      {ventas.length === 0 ? (
        <Tarjeta>
          <EstadoVacio icono="ventas" titulo="Aún no hay ventas registradas" descripcion="Registra la venta del día de cada punto de venta: importe por tipo de IVA y por forma de cobro." accion={<Boton onClick={abrirNueva}>Registrar la primera</Boton>} />
        </Tarjeta>
      ) : (
        <div className="space-y-6">
          {porMes.map(([mes, lista]) => {
            const totalMes = lista.reduce((s, v) => s + brutoVenta(v), 0)
            return (
              <div key={mes}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 className="font-semibold capitalize">{nombreMes(mes)}</h3>
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Total <ImporteEuro valor={totalMes} className="font-medium" /></span>
                </div>
                <Tarjeta className="!p-0 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ color: 'var(--text-muted)' }} className="text-left">
                        <th className="px-4 py-2.5 font-medium">Fecha</th>
                        <th className="px-4 py-2.5 font-medium">Punto de venta</th>
                        <th className="px-4 py-2.5 font-medium text-right">Bruto</th>
                        <th className="px-4 py-2.5 font-medium text-right hidden sm:table-cell">Tickets</th>
                        <th className="px-4 py-2.5 font-medium text-right hidden sm:table-cell">T. medio</th>
                        <th className="px-4 py-2.5 font-medium text-center">Estado</th>
                        <th className="px-4 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map((v) => {
                        const c = cuadreVenta(v)
                        return (
                          <tr key={v.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                            <td className="px-4 py-2.5 tabular">{formatearFecha(v.fecha)}</td>
                            <td className="px-4 py-2.5">{nombrePunto(v.centroCosteId)}</td>
                            <td className="px-4 py-2.5 text-right"><ImporteEuro valor={brutoVenta(v)} /></td>
                            <td className="px-4 py-2.5 text-right tabular hidden sm:table-cell">{v.numTickets}</td>
                            <td className="px-4 py-2.5 text-right hidden sm:table-cell"><ImporteEuro valor={ticketMedio(v)} /></td>
                            <td className="px-4 py-2.5 text-center">
                              {!c.cuadra ? <Semaforo estado="negativo" texto="Descuadre" /> : v.cerrado ? <Semaforo estado="positivo" texto="Cerrado" /> : <Semaforo estado="atencion" texto="Abierto" />}
                            </td>
                            <td className="px-4 py-2.5 text-right whitespace-nowrap">
                              <button className="underline text-xs mr-3" onClick={() => { setEditando({ ...v }); setFirma(v.firmadoPor ?? '') }}>Editar</button>
                              <button className="underline text-xs" style={{ color: 'var(--neg)' }} onClick={() => anularVenta(v.id)}>Anular</button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </Tarjeta>
              </div>
            )
          })}
        </div>
      )}

      {editando && cuadre && (
        <Modal titulo="Registrar venta del día" onCerrar={() => setEditando(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Select etiqueta="Punto de venta" valor={editando.centroCosteId} onChange={(v) => setEditando({ ...editando, centroCosteId: v })} opciones={puntos.map((p) => ({ valor: p.id, texto: p.nombre }))} />
              <Campo etiqueta="Fecha" valor={editando.fecha} onChange={(v) => setEditando({ ...editando, fecha: v })} tipo="date" />
            </div>

            <EditorLineasIva lineas={editando.lineasIva} tiposIva={config.tiposIva} onChange={(l: LineaIva[]) => setEditando({ ...editando, lineasIva: l })} />

            <div>
              <div className="text-sm font-medium mb-2">Cobros por forma de pago</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {FORMAS.map(({ forma, texto }) => (
                  <label key={forma} className="block">
                    <span className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{texto}</span>
                    <input type="number" step="0.01" value={cobroDe(forma) || ''} placeholder="0,00"
                      className="w-full rounded-lg px-2.5 py-1.5 text-sm tabular"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                      onChange={(e) => setCobro(forma, Number(e.target.value))} />
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <CampoNumero etiqueta="Nº de tickets" valor={editando.numTickets} onChange={(v) => setEditando({ ...editando, numTickets: v })} />
              <CampoNumero etiqueta="Unidades vendidas" valor={editando.unidades} onChange={(v) => setEditando({ ...editando, unidades: v })} />
            </div>

            {/* Resumen y cuadre */}
            <div className="rounded-xl p-3 text-sm" style={{ background: 'var(--surface-2)' }}>
              <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Bruto</span><span className="tabular font-medium">{formatearEuro(cuadre.bruto)}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Cobrado</span><span className="tabular">{formatearEuro(totalCobros(editando))}</span></div>
              <div className="flex justify-between items-center mt-1 pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Ticket medio {formatearEuro(ticketMedio(editando))}</span>
                {cuadre.cuadra ? <Semaforo estado="positivo" texto="Cuadra" /> : <Semaforo estado="negativo" texto={`Descuadre ${formatearEuro(cuadre.diferencia)}`} />}
              </div>
            </div>

            <Campo etiqueta="Firma del responsable (para el cierre)" valor={firma} onChange={setFirma} placeholder="Nombre del responsable" />

            <div className="flex justify-end gap-2 pt-1">
              <Boton variante="secundario" onClick={() => guardar(false)}>Guardar borrador</Boton>
              <Boton onClick={() => guardar(true)}>Guardar y cerrar día</Boton>
            </div>
            {!cuadre.cuadra && <p className="text-xs text-right" style={{ color: 'var(--warn)' }}>No se puede cerrar el día con descuadre; corrige los cobros.</p>}
          </div>
        </Modal>
      )}
    </>
  )
}
