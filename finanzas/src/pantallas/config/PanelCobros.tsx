/**
 * Tarjetas de empresa y datáfonos.
 *
 * Las dos cosas responden a la misma pregunta desde lados opuestos: **por qué
 * banco ha salido o ha entrado el dinero**. Sin eso, ni un gasto con tarjeta ni
 * una venta con datáfono se pueden cuadrar con el extracto.
 *
 * El datáfono se mueve de tienda con un clic, porque en la práctica se mueven:
 * el terminal es el que viaja, no la tienda.
 */
import { useState } from 'react'
import { useStore } from '../../store/store'
import { Tarjeta as TarjetaUI, Boton, EstadoVacio, Semaforo } from '../../componentes/ui'
import { Campo, Select, Toggle, Modal } from '../../componentes/formularios'
import { nuevoId } from '../../dominio/id'
import { marcarPrincipal, tiendasSinDatafono } from '../../dominio/datafonos'
import type { Tarjeta, Datafono } from '../../dominio/tipos'

const tarjetaNueva = (): Tarjeta => ({ id: nuevoId(), nombre: '', banco: '', activa: true })
const datafonoNuevo = (): Datafono => ({ id: nuevoId(), nombre: '', banco: '', activo: true })

export function PanelCobros() {
  const config = useStore((s) => s.config)
  const cuentas = useStore((s) => s.datos.cuentasTesoreria).filter((c) => c.tipo !== 'CAJA' && !c.anuladoEn)
  const actualizar = useStore((s) => s.actualizarConfig)

  const [tarjeta, setTarjeta] = useState<Tarjeta | null>(null)
  const [datafono, setDatafono] = useState<Datafono | null>(null)

  const puntos = config.centrosCoste.filter((c) => c.tipo === 'PUNTO_VENTA' && !c.activoHasta)
  const nombrePunto = (id?: string) => puntos.find((p) => p.id === id)?.nombre

  const guardarTarjeta = () => {
    if (!tarjeta?.nombre.trim()) return
    const existe = config.tarjetas.some((t) => t.id === tarjeta.id)
    actualizar({ tarjetas: existe ? config.tarjetas.map((t) => (t.id === tarjeta.id ? tarjeta : t)) : [...config.tarjetas, tarjeta] })
    setTarjeta(null)
  }

  const guardarDatafono = () => {
    if (!datafono?.nombre.trim()) return
    const existe = config.datafonos.some((d) => d.id === datafono.id)
    actualizar({ datafonos: existe ? config.datafonos.map((d) => (d.id === datafono.id ? datafono : d)) : [...config.datafonos, datafono] })
    setDatafono(null)
  }

  /** Mover un datáfono de tienda: un clic, sin abrir nada. */
  const moverDatafono = (id: string, centroCosteId: string) => {
    actualizar({ datafonos: config.datafonos.map((d) => (d.id === id ? { ...d, centroCosteId: centroCosteId || undefined } : d)) })
  }

  const opcionesCuenta = [
    { valor: '', texto: '— Sin asignar —' },
    ...cuentas.map((c) => ({ valor: c.id, texto: c.nombre })),
  ]

  return (
    <div className="space-y-6">
      <TarjetaUI>
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <h3 className="font-semibold">Tarjetas de empresa</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Al pagar una factura con tarjeta hay que decir cuál: es lo que permite cuadrar el cargo con el extracto del banco
              que la emite.
            </p>
          </div>
          <Boton variante="secundario" onClick={() => setTarjeta(tarjetaNueva())}>+ Tarjeta</Boton>
        </div>

        {config.tarjetas.length === 0 ? (
          <p className="text-sm mt-3" style={{ color: 'var(--text-muted)' }}>Aún no hay tarjetas.</p>
        ) : (
          <table className="w-full text-sm mt-3">
            <thead>
              <tr style={{ color: 'var(--text-muted)' }} className="text-left">
                <th className="py-2 pr-3 font-medium">Tarjeta</th>
                <th className="py-2 pr-3 font-medium">Banco</th>
                <th className="py-2 pr-3 font-medium">Últimos 4</th>
                <th className="py-2 pr-3 font-medium">Cuenta</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {config.tarjetas.map((t) => (
                <tr key={t.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                  <td className="py-2 pr-3">
                    {t.nombre} {!t.activa && <Semaforo estado="neutro" texto="baja" />}
                  </td>
                  <td className="py-2 pr-3">{t.banco}</td>
                  <td className="py-2 pr-3 tabular">{t.ultimos4 ? `···${t.ultimos4}` : '—'}</td>
                  <td className="py-2 pr-3" style={{ color: 'var(--text-muted)' }}>
                    {cuentas.find((c) => c.id === t.cuentaTesoreriaId)?.nombre ?? '—'}
                  </td>
                  <td className="py-2 text-right">
                    <button className="text-xs underline" style={{ color: 'var(--color-brand-500)' }} onClick={() => setTarjeta({ ...t })}>Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TarjetaUI>

      <TarjetaUI>
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <h3 className="font-semibold">Datáfonos</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Qué terminal hay en cada tienda. El de la tienda se propone solo al registrar la venta; si un día cobró otro, se
              cambia allí mismo. Para moverlo de tienda, cambia aquí la asignación: es inmediato.
            </p>
          </div>
          <Boton variante="secundario" onClick={() => setDatafono(datafonoNuevo())}>+ Datáfono</Boton>
        </div>

        {config.datafonos.length === 0 ? (
          <div className="mt-3">
            <EstadoVacio icono="banco" titulo="Sin datáfonos" descripcion="Da de alta los terminales que tienes en las tiendas para poder cuadrar los cobros con tarjeta." />
          </div>
        ) : (
          <table className="w-full text-sm mt-3">
            <thead>
              <tr style={{ color: 'var(--text-muted)' }} className="text-left">
                <th className="py-2 pr-3 font-medium">Datáfono</th>
                <th className="py-2 pr-3 font-medium">Banco</th>
                <th className="py-2 pr-3 font-medium">Tienda donde está</th>
                <th className="py-2 pr-3 font-medium text-center">Principal</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {config.datafonos.map((d) => (
                <tr key={d.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                  <td className="py-2 pr-3">
                    {d.nombre} {!d.activo && <Semaforo estado="neutro" texto="baja" />}
                    {d.numeroTerminal && <span className="block text-xs tabular" style={{ color: 'var(--text-muted)' }}>{d.numeroTerminal}</span>}
                  </td>
                  <td className="py-2 pr-3">{d.banco}</td>
                  <td className="py-2 pr-3">
                    <select
                      value={d.centroCosteId ?? ''}
                      onChange={(e) => moverDatafono(d.id, e.target.value)}
                      className="rounded-lg px-2 py-1 text-xs"
                      style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: d.centroCosteId ? 'var(--text)' : 'var(--text-muted)' }}
                      aria-label={`Tienda de ${d.nombre}`}
                    >
                      <option value="">— sin asignar —</option>
                      {puntos.map((p) => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-3 text-center">
                    {/* El principal es el que se aplica solo a los cobros con
                        tarjeta de esa tienda. Un clic y ya. */}
                    {d.principal ? (
                      <Semaforo estado="positivo" texto="Principal" />
                    ) : d.centroCosteId ? (
                      <button
                        className="text-xs underline"
                        style={{ color: 'var(--color-brand-500)' }}
                        onClick={() => actualizar({ datafonos: marcarPrincipal(config.datafonos, d.id) })}
                      >
                        Hacer principal
                      </button>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td className="py-2 text-right">
                    <button className="text-xs underline" style={{ color: 'var(--color-brand-500)' }} onClick={() => setDatafono({ ...d })}>Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Una tienda sin datáfono no puede cuadrar sus cobros con tarjeta. */}
        {tiendasSinDatafono(config.datafonos, puntos).map((p) => (
          <p key={p.id} className="text-xs mt-2" style={{ color: 'var(--warn)' }}>
            {p.nombre} no tiene datáfono asignado: sus cobros con tarjeta quedarán sin banco.
          </p>
        ))}
      </TarjetaUI>

      {tarjeta && (
        <Modal titulo={config.tarjetas.some((t) => t.id === tarjeta.id) ? 'Editar tarjeta' : 'Nueva tarjeta'} onCerrar={() => setTarjeta(null)}>
          <div className="space-y-3">
            <Campo etiqueta="Nombre" valor={tarjeta.nombre} onChange={(v) => setTarjeta({ ...tarjeta, nombre: v })} autoFocus placeholder="Tarjeta Sabadell" />
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Banco" valor={tarjeta.banco} onChange={(v) => setTarjeta({ ...tarjeta, banco: v })} />
              <Campo etiqueta="Últimos 4 dígitos" valor={tarjeta.ultimos4 ?? ''} onChange={(v) => setTarjeta({ ...tarjeta, ultimos4: v.replace(/\D/g, '').slice(0, 4) || undefined })} />
            </div>
            <Select etiqueta="Cuenta a la que se carga" valor={tarjeta.cuentaTesoreriaId ?? ''} onChange={(v) => setTarjeta({ ...tarjeta, cuentaTesoreriaId: v || undefined })} opciones={opcionesCuenta} />
            <Toggle etiqueta="Activa" valor={tarjeta.activa} onChange={(v) => setTarjeta({ ...tarjeta, activa: v })} />
            <div className="flex justify-end gap-2">
              <Boton variante="secundario" onClick={() => setTarjeta(null)}>Cancelar</Boton>
              <Boton onClick={guardarTarjeta}>Guardar</Boton>
            </div>
          </div>
        </Modal>
      )}

      {datafono && (
        <Modal titulo={config.datafonos.some((d) => d.id === datafono.id) ? 'Editar datáfono' : 'Nuevo datáfono'} onCerrar={() => setDatafono(null)}>
          <div className="space-y-3">
            <Campo etiqueta="Nombre" valor={datafono.nombre} onChange={(v) => setDatafono({ ...datafono, nombre: v })} autoFocus placeholder="Datáfono San Juan" />
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Banco que liquida" valor={datafono.banco} onChange={(v) => setDatafono({ ...datafono, banco: v })} />
              <Campo etiqueta="Nº de terminal" valor={datafono.numeroTerminal ?? ''} onChange={(v) => setDatafono({ ...datafono, numeroTerminal: v || undefined })} />
            </div>
            <Select
              etiqueta="Tienda donde está"
              valor={datafono.centroCosteId ?? ''}
              onChange={(v) => setDatafono({ ...datafono, centroCosteId: v || undefined })}
              opciones={[{ valor: '', texto: '— Sin asignar —' }, ...puntos.map((p) => ({ valor: p.id, texto: p.nombre }))]}
            />
            <Select etiqueta="Cuenta donde liquida" valor={datafono.cuentaTesoreriaId ?? ''} onChange={(v) => setDatafono({ ...datafono, cuentaTesoreriaId: v || undefined })} opciones={opcionesCuenta} />
            <Toggle etiqueta="Activo" valor={datafono.activo} onChange={(v) => setDatafono({ ...datafono, activo: v })} />
            <div className="flex justify-end gap-2">
              <Boton variante="secundario" onClick={() => setDatafono(null)}>Cancelar</Boton>
              <Boton onClick={guardarDatafono}>Guardar</Boton>
            </div>
            {nombrePunto(datafono.centroCosteId) && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Quedará asignado a {nombrePunto(datafono.centroCosteId)}.</p>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
