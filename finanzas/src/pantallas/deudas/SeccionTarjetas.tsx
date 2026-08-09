import { useState } from 'react'
import { useStore } from '../../store/store'
import { Tarjeta, Boton, EstadoVacio, ImporteEuro } from '../../componentes/ui'
import { Campo, CampoNumero, Select, Modal } from '../../componentes/formularios'
import { hoyISO } from '../../lib/fechas'
import { nuevoId } from '../../dominio/id'
import { formatearEuro } from '../../dominio/dinero'
import { UMBRAL_TARJETA, avisosTarjeta, costeAnualTarjeta, gastoDelMes, situacionTarjeta } from '../../dominio/tarjeta-credito'
import type { TarjetaCredito } from '../../dominio/tipos'

export function tarjetaCreditoNueva(): TarjetaCredito {
  return {
    id: nuevoId(),
    creadoEn: new Date().toISOString(),
    creadoPor: 'admin',
    origen: 'MANUAL',
    entidad: '',
    alias: '',
    limite: 0,
    dispuesto: 0,
    modalidad: 'FIN_DE_MES',
  }
}

export function SeccionTarjetas({ plantilla, onCerrarPlantilla }: { plantilla?: TarjetaCredito | null; onCerrarPlantilla?: () => void }) {
  const tarjetas = useStore((s) => s.datos.tarjetasCredito).filter((t) => !t.anuladoEn)
  const compras = useStore((s) => s.datos.compras)
  const cuentas = useStore((s) => s.datos.cuentasTesoreria).filter((c) => !c.anuladoEn)
  const tarjetasConfig = useStore((s) => s.config.tarjetas)
  const guardar = useStore((s) => s.guardarTarjetaCredito)
  const anular = useStore((s) => s.anularTarjetaCredito)
  const hoy = hoyISO()
  const mes = hoy.slice(0, 7)
  const [edit, setEdit] = useState<TarjetaCredito | null>(null)

  const abierta = plantilla ?? edit
  const cerrar = () => {
    setEdit(null)
    onCerrarPlantilla?.()
  }

  const totalDispuesto = tarjetas.reduce((s, t) => s + t.dispuesto, 0)
  const totalLimite = tarjetas.reduce((s, t) => s + t.limite, 0)
  const costeAplazado = tarjetas.reduce((s, t) => s + costeAnualTarjeta(t), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Tarjetas de crédito</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Deuda financiera a corto plazo: lo gastado se le debe al banco hasta la liquidación.
          </p>
        </div>
        <Boton variante="secundario" onClick={() => setEdit(tarjetaCreditoNueva())}>+ Tarjeta</Boton>
      </div>

      {abierta && (
        <ModalTarjeta
          tarjeta={abierta}
          cuentas={cuentas}
          tarjetasConfig={tarjetasConfig}
          onCerrar={cerrar}
          onGuardar={(t) => { guardar(t); cerrar() }}
        />
      )}

      {tarjetas.length === 0 ? (
        <Tarjeta>
          <EstadoVacio
            icono="deuda"
            titulo="Aún no hay tarjetas de crédito"
            descripcion="Da de alta las tarjetas de crédito de cada banco con su límite y su saldo. Cuentan como deuda financiera a corto plazo y suman en el total."
            accion={<Boton onClick={() => setEdit(tarjetaCreditoNueva())}>Añadir la primera</Boton>}
          />
        </Tarjeta>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <Tarjeta className="!p-4">
              <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Saldo pendiente</div>
              <div className="text-lg font-semibold"><ImporteEuro valor={totalDispuesto} /></div>
            </Tarjeta>
            <Tarjeta className="!p-4">
              <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Límite total</div>
              <div className="text-lg font-semibold"><ImporteEuro valor={totalLimite} /></div>
            </Tarjeta>
            <Tarjeta className="!p-4">
              <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Coste del saldo aplazado</div>
              <div className="text-lg font-semibold" style={{ color: costeAplazado > 0 ? 'var(--warn)' : undefined }}>
                <ImporteEuro valor={costeAplazado} /> <span className="text-xs">/ año</span>
              </div>
            </Tarjeta>
          </div>

          <Tarjeta className="!p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: 'var(--text-muted)' }} className="text-left">
                  <th className="px-4 py-2.5 font-medium">Tarjeta</th>
                  <th className="px-4 py-2.5 font-medium hidden sm:table-cell">Modalidad</th>
                  <th className="px-4 py-2.5 font-medium text-right">Pendiente</th>
                  <th className="px-4 py-2.5 font-medium text-right hidden sm:table-cell">Límite</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {tarjetas.map((t) => {
                  const s = situacionTarjeta(t)
                  const umbral = t.umbralAviso ?? UMBRAL_TARJETA
                  const avisos = avisosTarjeta(t, compras, mes)
                  return (
                    <tr key={t.id} className="border-t align-top" style={{ borderColor: 'var(--border)' }}>
                      <td className="px-4 py-2.5">
                        <div>{t.alias || t.entidad || '(sin nombre)'}</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {t.entidad}
                          {t.ultimos4 ? ` ····${t.ultimos4}` : ''}
                        </div>
                        {/* Barra de uso con la marca del umbral, igual que en la póliza. */}
                        <div className="relative h-1.5 rounded-full overflow-hidden mt-2 max-w-[220px]" style={{ background: 'var(--surface-2)' }}>
                          <div
                            className="h-full"
                            style={{ width: `${Math.min(100, s.porcentajeDispuesto)}%`, background: s.excedida ? 'var(--neg)' : s.porcentajeDispuesto >= umbral ? 'var(--warn)' : 'var(--pos)' }}
                          />
                          <div className="absolute top-0 bottom-0 w-px" style={{ left: `${umbral}%`, background: 'var(--text-muted)' }} />
                        </div>
                        {avisos.map((a) => (
                          <div key={a} className="text-xs mt-1" style={{ color: 'var(--warn)' }}>· {a}</div>
                        ))}
                      </td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        {t.modalidad === 'FIN_DE_MES' ? 'Pago a fin de mes' : `Aplazado${t.tipoInteres ? ` · ${t.tipoInteres} %` : ''}`}
                        {t.diaLiquidacion ? <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Cargo el día {t.diaLiquidacion}</div> : null}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular">
                        {formatearEuro(t.dispuesto)}
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.porcentajeDispuesto.toFixed(0)} %</div>
                        {t.tarjetaId && (
                          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            compras del mes {formatearEuro(gastoDelMes(t, compras, mes))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular hidden sm:table-cell">{formatearEuro(t.limite)}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <button className="underline text-xs mr-3" onClick={() => setEdit({ ...t })}>Editar</button>
                        <button className="underline text-xs" style={{ color: 'var(--neg)' }} onClick={() => anular(t.id)}>Anular</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Tarjeta>
        </>
      )}
    </div>
  )
}

function ModalTarjeta({
  tarjeta,
  cuentas,
  tarjetasConfig,
  onCerrar,
  onGuardar,
}: {
  tarjeta: TarjetaCredito
  cuentas: { id: string; nombre: string }[]
  tarjetasConfig: { id: string; nombre: string; banco: string }[]
  onCerrar: () => void
  onGuardar: (t: TarjetaCredito) => void
}) {
  const [t, setT] = useState<TarjetaCredito>(tarjeta)
  const s = situacionTarjeta(t)
  const listo = (t.alias.trim() !== '' || t.entidad.trim() !== '') && t.limite > 0

  return (
    <Modal titulo={tarjeta.alias ? 'Editar tarjeta de crédito' : 'Nueva tarjeta de crédito'} onCerrar={onCerrar}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Campo etiqueta="Entidad" valor={t.entidad} onChange={(v) => setT({ ...t, entidad: v })} autoFocus />
          <Campo etiqueta="Nombre de la tarjeta" valor={t.alias} onChange={(v) => setT({ ...t, alias: v })} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Campo etiqueta="Últimos 4 dígitos" valor={t.ultimos4 ?? ''} onChange={(v) => setT({ ...t, ultimos4: v || undefined })} />
          <CampoNumero etiqueta="Límite" valor={t.limite} onChange={(v) => setT({ ...t, limite: v })} sufijo="€" />
          <CampoNumero etiqueta="Saldo pendiente" valor={t.dispuesto} onChange={(v) => setT({ ...t, dispuesto: v })} sufijo="€" paso="0.01" />
        </div>

        {/* La modalidad es lo que decide si la tarjeta cuesta dinero o no. */}
        <div className="grid grid-cols-3 gap-4">
          <Select
            etiqueta="Forma de pago"
            valor={t.modalidad}
            onChange={(v) => setT({ ...t, modalidad: v, tipoInteres: v === 'FIN_DE_MES' ? undefined : t.tipoInteres })}
            opciones={[{ valor: 'FIN_DE_MES', texto: 'Pago a fin de mes' }, { valor: 'APLAZADO', texto: 'Aplazado (con intereses)' }]}
          />
          {t.modalidad === 'APLAZADO' ? (
            <CampoNumero etiqueta="Tipo de interés anual" valor={t.tipoInteres ?? 0} onChange={(v) => setT({ ...t, tipoInteres: v || undefined })} sufijo="%" paso="0.01" />
          ) : (
            <div className="text-xs self-end pb-2" style={{ color: 'var(--text-muted)' }}>
              Pagando a fin de mes no devenga intereses.
            </div>
          )}
          <CampoNumero
            etiqueta="Día del cargo"
            valor={t.diaLiquidacion ?? 0}
            onChange={(v) => setT({ ...t, diaLiquidacion: v > 0 && v <= 31 ? v : undefined })}
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Select
            etiqueta="Cuenta donde se carga"
            valor={t.cuentaCargoId ?? ''}
            onChange={(v) => setT({ ...t, cuentaCargoId: v || undefined })}
            opciones={[{ valor: '', texto: '(sin indicar)' }, ...cuentas.map((c) => ({ valor: c.id, texto: c.nombre }))]}
          />
          <Select
            etiqueta="Tarjeta con la que se pagan compras"
            valor={t.tarjetaId ?? ''}
            onChange={(v) => setT({ ...t, tarjetaId: v || undefined })}
            opciones={[{ valor: '', texto: '(sin enlazar)' }, ...tarjetasConfig.map((c) => ({ valor: c.id, texto: `${c.nombre} · ${c.banco}` }))]}
          />
          <CampoNumero
            etiqueta="% de consumo para avisar"
            valor={t.umbralAviso ?? UMBRAL_TARJETA}
            onChange={(v) => setT({ ...t, umbralAviso: v || undefined })}
            sufijo="%"
          />
        </div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Al enlazarla con una tarjeta de Configuración, la app suma las compras que hayas pagado con ella y te dice si cuadra
          con el saldo. No lo cambia solo: el saldo bueno es el del extracto.
        </p>

        <div className="rounded-xl p-3 text-sm space-y-1" style={{ background: 'var(--surface-2)' }}>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>Disponible</span>
            <span className="tabular font-medium">{formatearEuro(s.disponible)}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>Coste del saldo aplazado</span>
            <span className="tabular">{formatearEuro(costeAnualTarjeta(t))} / año</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={() => { if (listo) onGuardar(t) }}>Guardar</Boton>
        </div>
        {!listo && <p className="text-xs text-right" style={{ color: 'var(--warn)' }}>Indica al menos la entidad y el límite.</p>}
      </div>
    </Modal>
  )
}
