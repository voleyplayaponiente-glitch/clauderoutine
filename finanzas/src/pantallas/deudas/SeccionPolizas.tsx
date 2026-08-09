import { useMemo, useState } from 'react'
import { useStore } from '../../store/store'
import { Tarjeta, Boton, EstadoVacio, ImporteEuro } from '../../componentes/ui'
import { Campo, CampoNumero, Select, Toggle, Modal } from '../../componentes/formularios'
import { hoyISO, formatearFecha } from '../../lib/fechas'
import { nuevoId } from '../../dominio/id'
import { formatearEuro, formatearPorcentaje } from '../../dominio/dinero'
import { avisosPoliza, estimarLiquidacion, fechasLiquidacion, situacionPoliza } from '../../dominio/poliza'
import type { DatosPoliza } from '../../dominio/poliza-archivo'
import type { Poliza } from '../../dominio/tipos'

export function polizaNueva(): Poliza {
  return {
    id: nuevoId(),
    creadoEn: new Date().toISOString(),
    creadoPor: 'admin',
    origen: 'MANUAL',
    entidad: '',
    limiteConcedido: 0,
    limiteActual: 0,
    dispuesto: 0,
    tipoInteresDispuesto: 0,
    comisionDisponibilidad: 0,
    periodicidadLiquidacion: 'MENSUAL',
    fechaConstitucion: hoyISO(),
    seRenueva: true,
  }
}

/** Convierte lo leído de la ficha del banco en una póliza lista para revisar. */
export function polizaDesdeFichero(d: DatosPoliza): Poliza {
  const limite = d.limiteActual ?? d.limiteConcedido ?? 0
  return {
    ...polizaNueva(),
    origen: 'PDF',
    entidad: d.entidad ?? '',
    numeroContrato: d.numeroContrato,
    cuentaRelacionada: d.cuentaRelacionada,
    limiteConcedido: d.limiteConcedido ?? limite,
    limiteActual: limite,
    dispuesto: d.dispuesto ?? 0,
    saldoContable: d.saldoContable,
    importeExcedido: d.importeExcedido,
    tipoInteresDispuesto: d.tipoInteresDispuesto ?? 0,
    comisionDisponibilidad: d.comisionDisponibilidad ?? 0,
    comisionExcedido: d.comisionExcedido,
    periodicidadLiquidacion: d.periodicidadLiquidacion ?? 'MENSUAL',
    fechaConstitucion: d.fechaConstitucion ?? hoyISO(),
    fechaVencimiento: d.fechaVencimiento,
    fechaUltimaLiquidacion: d.fechaUltimaLiquidacion,
    fechaProximaLiquidacion: d.fechaProximaLiquidacion,
    seRenueva: true,
  }
}

export function SeccionPolizas({ lectura, onCerrarLectura }: { lectura: DatosPoliza | null; onCerrarLectura: () => void }) {
  const polizas = useStore((s) => s.datos.polizas).filter((p) => !p.anuladoEn)
  const guardar = useStore((s) => s.guardarPoliza)
  const anular = useStore((s) => s.anularPoliza)
  const hoy = hoyISO()
  const [edit, setEdit] = useState<Poliza | null>(null)

  const revisar = useMemo(() => (lectura ? polizaDesdeFichero(lectura) : null), [lectura])

  const totalDispuesto = polizas.reduce((s, p) => s + p.dispuesto, 0)
  const totalDisponible = polizas.reduce((s, p) => s + situacionPoliza(p).disponible, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Pólizas de crédito</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Sin cuotas: se dispone y se devuelve hasta un límite, se liquidan intereses cada periodo y se renueva al vencimiento.
          </p>
        </div>
        <Boton variante="secundario" onClick={() => setEdit(polizaNueva())}>+ Póliza</Boton>
      </div>

      {revisar && (
        <ModalPoliza
          poliza={revisar}
          titulo="Alta de póliza desde la ficha del banco"
          leido={lectura?.encontrados ?? []}
          avisos={lectura?.avisos ?? []}
          onCerrar={onCerrarLectura}
          onGuardar={(p) => { guardar(p); onCerrarLectura() }}
        />
      )}

      {polizas.length === 0 ? (
        <Tarjeta>
          <EstadoVacio
            icono="deuda"
            titulo="Aún no hay pólizas de crédito"
            descripcion="Sube la ficha «Datos generales» de la cuenta de crédito o dala de alta a mano. Verás el disponible, el coste del dispuesto y el de la parte que no usas."
            accion={<Boton onClick={() => setEdit(polizaNueva())}>Añadir la primera</Boton>}
          />
        </Tarjeta>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Tarjeta className="!p-4">
              <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Dispuesto</div>
              <div className="text-lg font-semibold"><ImporteEuro valor={totalDispuesto} /></div>
            </Tarjeta>
            <Tarjeta className="!p-4">
              <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Disponible</div>
              <div className="text-lg font-semibold"><ImporteEuro valor={totalDisponible} /></div>
            </Tarjeta>
          </div>

          {polizas.map((p) => {
            const s = situacionPoliza(p)
            const avisos = avisosPoliza(p, hoy)
            const fechas = fechasLiquidacion(p, Number(hoy.slice(0, 4)))
            const proxima = fechas.find((f) => f >= hoy) ?? p.fechaProximaLiquidacion
            const liq = estimarLiquidacion(p, 30, proxima ?? hoy)
            return (
              <Tarjeta key={p.id}>
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="font-semibold">{p.entidad || '(sin entidad)'}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {p.numeroContrato ? `Contrato ${p.numeroContrato}` : ''}
                      {p.fechaVencimiento ? ` · vence el ${formatearFecha(p.fechaVencimiento)}` : ''}
                      {p.seRenueva ? ' · se renueva' : ' · no se renueva'}
                    </div>
                  </div>
                  <div className="whitespace-nowrap">
                    <button className="underline text-xs mr-3" onClick={() => setEdit({ ...p })}>Editar</button>
                    <button className="underline text-xs" style={{ color: 'var(--neg)' }} onClick={() => anular(p.id)}>Anular</button>
                  </div>
                </div>

                {/* Barra de uso: de un vistazo, cuánto queda antes del excedido. */}
                <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: 'var(--surface-2)' }}>
                  <div
                    className="h-full"
                    style={{ width: `${Math.min(100, s.porcentajeDispuesto)}%`, background: s.excedido > 0 ? 'var(--neg)' : s.porcentajeDispuesto >= 90 ? 'var(--warn)' : 'var(--pos)' }}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Límite</div>
                    <div className="tabular">{formatearEuro(s.limite)}</div>
                  </div>
                  <div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Dispuesto</div>
                    <div className="tabular">{formatearEuro(s.dispuesto)}</div>
                  </div>
                  <div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Disponible</div>
                    <div className="tabular">{formatearEuro(s.disponible)}</div>
                  </div>
                  <div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Liquidación estimada (30 días)</div>
                    <div className="tabular">{formatearEuro(liq.total)}</div>
                  </div>
                </div>

                <div className="mt-3 rounded-xl p-3 text-xs space-y-1" style={{ background: 'var(--surface-2)' }}>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Intereses del dispuesto ({formatearPorcentaje(p.tipoInteresDispuesto, 3)})</span>
                    <span className="tabular">{formatearEuro(liq.intereses)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--text-muted)' }}>Comisión de disponibilidad ({formatearPorcentaje(p.comisionDisponibilidad, 3)})</span>
                    <span className="tabular">{formatearEuro(liq.comisionDisponibilidad)}</span>
                  </div>
                  {liq.comisionExcedido > 0 && (
                    <div className="flex justify-between" style={{ color: 'var(--neg)' }}>
                      <span>Comisión de máximo excedido ({formatearPorcentaje(p.comisionExcedido ?? 0, 3)})</span>
                      <span className="tabular">{formatearEuro(liq.comisionExcedido)}</span>
                    </div>
                  )}
                  <p style={{ color: 'var(--text-muted)' }}>
                    Estimación con el saldo de hoy y base 360. El banco liquida sobre el saldo medio diario, así que la cifra
                    real cambiará; sirve para presupuestar, no para cuadrar el recibo.
                  </p>
                </div>

                {avisos.map((a) => (
                  <p key={a} className="text-xs mt-2" style={{ color: 'var(--warn)' }}>· {a}</p>
                ))}
              </Tarjeta>
            )
          })}
        </>
      )}

      {edit && (
        <ModalPoliza
          poliza={edit}
          titulo={edit.entidad ? 'Editar póliza' : 'Nueva póliza de crédito'}
          leido={[]}
          avisos={[]}
          onCerrar={() => setEdit(null)}
          onGuardar={(p) => { guardar(p); setEdit(null) }}
        />
      )}
    </div>
  )
}

function ModalPoliza({
  poliza,
  titulo,
  leido,
  avisos,
  onCerrar,
  onGuardar,
}: {
  poliza: Poliza
  titulo: string
  leido: string[]
  avisos: string[]
  onCerrar: () => void
  onGuardar: (p: Poliza) => void
}) {
  const [p, setP] = useState<Poliza>(poliza)
  const s = situacionPoliza(p)

  return (
    <Modal titulo={titulo} onCerrar={onCerrar}>
      <div className="space-y-4">
        {leido.length > 0 && (
          <div className="rounded-xl p-3 text-sm space-y-1" style={{ background: 'var(--surface-2)' }}>
            <p className="font-medium">Leído de la ficha: {leido.join(', ')}. Revísalo antes de guardar.</p>
            {avisos.map((a) => <p key={a} style={{ color: 'var(--warn)' }}>· {a}</p>)}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Campo etiqueta="Entidad" valor={p.entidad} onChange={(v) => setP({ ...p, entidad: v })} autoFocus />
          <Campo etiqueta="Nº de contrato" valor={p.numeroContrato ?? ''} onChange={(v) => setP({ ...p, numeroContrato: v || undefined })} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <CampoNumero etiqueta="Capital concedido" valor={p.limiteConcedido} onChange={(v) => setP({ ...p, limiteConcedido: v, limiteActual: p.limiteActual || v })} sufijo="€" />
          <CampoNumero etiqueta="Límite actual" valor={p.limiteActual} onChange={(v) => setP({ ...p, limiteActual: v })} sufijo="€" />
          <CampoNumero etiqueta="Capital dispuesto" valor={p.dispuesto} onChange={(v) => setP({ ...p, dispuesto: v })} sufijo="€" paso="0.01" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <CampoNumero etiqueta="Saldo contable" valor={p.saldoContable ?? 0} onChange={(v) => setP({ ...p, saldoContable: v || undefined })} sufijo="€" paso="0.01" />
          <CampoNumero etiqueta="Importe excedido" valor={p.importeExcedido ?? 0} onChange={(v) => setP({ ...p, importeExcedido: v || undefined })} sufijo="€" paso="0.01" />
        </div>

        {/* Los tres precios de la póliza, que es lo que la hace distinta. */}
        <div className="grid grid-cols-3 gap-4">
          <CampoNumero etiqueta="Interés del dispuesto" valor={p.tipoInteresDispuesto} onChange={(v) => setP({ ...p, tipoInteresDispuesto: v })} sufijo="%" paso="0.001" />
          <CampoNumero etiqueta="Comisión de disponibilidad" valor={p.comisionDisponibilidad} onChange={(v) => setP({ ...p, comisionDisponibilidad: v })} sufijo="%" paso="0.001" />
          <CampoNumero etiqueta="Comisión de excedido" valor={p.comisionExcedido ?? 0} onChange={(v) => setP({ ...p, comisionExcedido: v || undefined })} sufijo="%" paso="0.001" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            etiqueta="Periodicidad de las liquidaciones"
            valor={p.periodicidadLiquidacion}
            onChange={(v) => setP({ ...p, periodicidadLiquidacion: v })}
            opciones={[{ valor: 'MENSUAL', texto: 'Mensual' }, { valor: 'TRIMESTRAL', texto: 'Trimestral' }, { valor: 'SEMESTRAL', texto: 'Semestral' }, { valor: 'ANUAL', texto: 'Anual' }]}
          />
          <Campo etiqueta="Próxima liquidación" valor={p.fechaProximaLiquidacion ?? ''} onChange={(v) => setP({ ...p, fechaProximaLiquidacion: v || undefined })} tipo="date" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Campo etiqueta="Fecha de constitución" valor={p.fechaConstitucion} onChange={(v) => setP({ ...p, fechaConstitucion: v })} tipo="date" />
          <Campo etiqueta="Cancelación prevista" valor={p.fechaVencimiento ?? ''} onChange={(v) => setP({ ...p, fechaVencimiento: v || undefined })} tipo="date" />
        </div>

        <Toggle etiqueta="Se prevé renovar al vencimiento" valor={p.seRenueva} onChange={(v) => setP({ ...p, seRenueva: v })} />
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Si no se renueva, el presupuesto incluirá la devolución del capital dispuesto en el mes del vencimiento.
        </p>

        <div className="rounded-xl p-3 text-sm space-y-1" style={{ background: 'var(--surface-2)' }}>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>Disponible (límite − saldo contable)</span>
            <span className="tabular font-medium">{formatearEuro(s.disponible)}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>Dispuesto sobre el límite</span>
            <span className="tabular">{s.porcentajeDispuesto.toFixed(1)} %</span>
          </div>
        </div>

        {avisosPoliza(p, hoyISO()).map((a) => (
          <p key={a} className="text-xs" style={{ color: 'var(--warn)' }}>· {a}</p>
        ))}

        <div className="flex justify-end gap-2 pt-1">
          <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={() => { if (p.entidad.trim() && p.limiteActual > 0) onGuardar(p) }}>Guardar</Boton>
        </div>
        {(!p.entidad.trim() || p.limiteActual <= 0) && (
          <p className="text-xs text-right" style={{ color: 'var(--warn)' }}>Indica la entidad y el límite de la póliza.</p>
        )}
      </div>
    </Modal>
  )
}
