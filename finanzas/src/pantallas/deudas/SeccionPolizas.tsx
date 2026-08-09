import { useMemo, useState } from 'react'
import { useStore } from '../../store/store'
import { Tarjeta, Boton, EstadoVacio, ImporteEuro } from '../../componentes/ui'
import { Campo, CampoNumero, Select, Toggle, Modal } from '../../componentes/formularios'
import { hoyISO, formatearFecha } from '../../lib/fechas'
import { nuevoId } from '../../dominio/id'
import { formatearEuro, formatearPorcentaje } from '../../dominio/dinero'
import {
  UMBRAL_CONSUMO,
  avisosPoliza,
  consumoMedio,
  estimarLiquidacion,
  fechasLiquidacion,
  polizaConCuenta,
  situacionPoliza,
} from '../../dominio/poliza'
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

export function SeccionPolizas({
  lectura,
  onCerrarLectura,
  plantilla,
  onCerrarPlantilla,
}: {
  lectura: DatosPoliza | null
  onCerrarLectura: () => void
  /** Póliza a medio empezar que llega desde fuera (p. ej. del modal de deuda). */
  plantilla?: Poliza | null
  onCerrarPlantilla?: () => void
}) {
  const guardadas = useStore((s) => s.datos.polizas).filter((p) => !p.anuladoEn)
  const cuentas = useStore((s) => s.datos.cuentasTesoreria).filter((c) => !c.anuladoEn)
  const movimientos = useStore((s) => s.datos.movimientos)
  const guardar = useStore((s) => s.guardarPoliza)
  const anular = useStore((s) => s.anularPoliza)
  const hoy = hoyISO()
  const [edit, setEdit] = useState<Poliza | null>(null)

  const revisar = useMemo(() => (lectura ? polizaDesdeFichero(lectura) : (plantilla ?? null)), [lectura, plantilla])
  const cerrarRevision = () => {
    onCerrarLectura()
    onCerrarPlantilla?.()
  }

  // Con la cuenta como origen, lo dispuesto se recalcula en cada pintada: es el
  // saldo negativo de la cuenta, no un número que haya que ir actualizando.
  const polizas = guardadas.map((p) => polizaConCuenta(p, cuentas, movimientos, hoy))

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
          titulo={lectura ? 'Alta de póliza desde la ficha del banco' : 'Nueva póliza de crédito'}
          cuentas={cuentas}
          leido={lectura?.encontrados ?? []}
          avisos={lectura?.avisos ?? []}
          onCerrar={cerrarRevision}
          onGuardar={(p) => { guardar(p); cerrarRevision() }}
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
            const cuenta = cuentas.find((c) => c.id === p.cuentaTesoreriaId)
            // La renovación se juega con la media del año, no con la foto de hoy.
            const consumo = cuenta ? consumoMedio(cuenta, movimientos, `${hoy.slice(0, 4)}-01-01`, hoy, s.limite) : undefined
            const umbral = p.umbralAviso ?? UMBRAL_CONSUMO
            const avisos = avisosPoliza(p, hoy, consumo)
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

                {/* Barra de uso con la marca del umbral: de un vistazo se ve si
                    se ha pasado del consumo que se ha fijado. */}
                <div className="relative h-2 rounded-full overflow-hidden mb-1" style={{ background: 'var(--surface-2)' }}>
                  <div
                    className="h-full"
                    style={{ width: `${Math.min(100, s.porcentajeDispuesto)}%`, background: s.excedido > 0 ? 'var(--neg)' : s.porcentajeDispuesto >= umbral ? 'var(--warn)' : 'var(--pos)' }}
                  />
                  <div className="absolute top-0 bottom-0 w-px" style={{ left: `${umbral}%`, background: 'var(--text-muted)' }} />
                </div>
                <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                  Consumida el {s.porcentajeDispuesto.toFixed(1)} % · marca de aviso en el {umbral} %
                  {consumo ? ` · media del año ${consumo.porcentajeMedio.toFixed(1)} %` : ''}
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

                {consumo && (
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Consumo medio del año</div>
                      <div className="tabular" style={{ color: consumo.porcentajeMedio > umbral ? 'var(--warn)' : undefined }}>
                        {formatearEuro(consumo.medio)} ({consumo.porcentajeMedio.toFixed(1)} %)
                      </div>
                    </div>
                    <div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Máximo dispuesto</div>
                      <div className="tabular">{formatearEuro(consumo.maximo)}</div>
                    </div>
                    <div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Origen del dispuesto</div>
                      <div>{p.origenDispuesto === 'CUENTA' ? `Saldo de ${cuenta?.nombre ?? 'la cuenta'}` : 'A mano'}</div>
                    </div>
                  </div>
                )}

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
          cuentas={cuentas}
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
  cuentas,
  leido,
  avisos,
  onCerrar,
  onGuardar,
}: {
  poliza: Poliza
  titulo: string
  cuentas: { id: string; nombre: string }[]
  leido: string[]
  avisos: string[]
  onCerrar: () => void
  onGuardar: (p: Poliza) => void
}) {
  const [p, setP] = useState<Poliza>(poliza)
  const s = situacionPoliza(p)
  const listo = p.entidad.trim() !== '' && (p.limiteActual || p.limiteConcedido) > 0

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
        <div className="grid grid-cols-2 gap-4">
          <CampoNumero etiqueta="Capital concedido" valor={p.limiteConcedido} onChange={(v) => setP({ ...p, limiteConcedido: v, limiteActual: p.limiteActual || v })} sufijo="€" />
          <CampoNumero etiqueta="Límite actual (si el banco lo ha bajado)" valor={p.limiteActual} onChange={(v) => setP({ ...p, limiteActual: v })} sufijo="€" />
        </div>

        {/* Lo dispuesto no se teclea si la póliza va en cuenta corriente: es el
            saldo negativo de esa cuenta y se actualiza solo con cada extracto. */}
        <div className="grid grid-cols-2 gap-4">
          <Select
            etiqueta="De dónde sale lo dispuesto"
            valor={p.cuentaTesoreriaId ?? ''}
            onChange={(v) =>
              setP({ ...p, cuentaTesoreriaId: v || undefined, origenDispuesto: v ? 'CUENTA' : 'MANUAL', saldoContable: v ? undefined : p.saldoContable })
            }
            opciones={[
              { valor: '', texto: 'Lo escribo a mano' },
              ...cuentas.map((c) => ({ valor: c.id, texto: `Saldo negativo de ${c.nombre}` })),
            ]}
          />
          <CampoNumero
            etiqueta={`% de consumo a partir del cual avisar`}
            valor={p.umbralAviso ?? UMBRAL_CONSUMO}
            onChange={(v) => setP({ ...p, umbralAviso: v || undefined })}
            sufijo="%"
          />
        </div>

        {p.origenDispuesto === 'CUENTA' ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            El capital dispuesto se toma del saldo negativo de la cuenta elegida, así que se actualiza solo al importar el
            extracto. No hace falta teclearlo ni mantenerlo.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            <CampoNumero etiqueta="Capital dispuesto" valor={p.dispuesto} onChange={(v) => setP({ ...p, dispuesto: v })} sufijo="€" paso="0.01" />
            <CampoNumero etiqueta="Saldo contable" valor={p.saldoContable ?? 0} onChange={(v) => setP({ ...p, saldoContable: v || undefined })} sufijo="€" paso="0.01" />
            <CampoNumero etiqueta="Importe excedido" valor={p.importeExcedido ?? 0} onChange={(v) => setP({ ...p, importeExcedido: v || undefined })} sufijo="€" paso="0.01" />
          </div>
        )}

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
          {/* El límite actual puede quedarse vacío: si solo se rellena el
              capital concedido, se toma ese. */}
          <Boton onClick={() => { if (listo) onGuardar({ ...p, limiteActual: p.limiteActual || p.limiteConcedido }) }}>Guardar</Boton>
        </div>
        {!listo && (
          <p className="text-xs text-right" style={{ color: 'var(--warn)' }}>
            Indica la entidad y el capital concedido de la póliza.
          </p>
        )}
      </div>
    </Modal>
  )
}
