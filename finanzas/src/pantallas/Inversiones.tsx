/**
 * Cartera de inversiones: fondos, acciones, cripto, inmuebles y lo que surja.
 *
 * La pantalla insiste en una distinción que se confunde a menudo: la plusvalía
 * latente NO es beneficio (se enseña aparte y en gris), mientras que la
 * minusvalía SÍ obliga a dotar deterioro (se enseña en rojo).
 */
import { useMemo, useState } from 'react'
import { useStore } from '../store/store'
import { CabeceraPantalla } from './Pantalla'
import { Tarjeta, Boton, EstadoVacio, ImporteEuro, formatearEuro } from '../componentes/ui'
import { Campo, CampoNumero, Select, Modal } from '../componentes/formularios'
import { hoyISO, formatearFecha } from '../lib/fechas'
import { nuevoId } from '../dominio/id'
import {
  situacion,
  resumenCartera,
  avisosInversion,
  decimalesUnidades,
  costeCompra,
  netoVenta,
  ETIQUETA_TIPO_INVERSION,
  CUENTA_PGC_POR_TIPO,
  type Inversion,
  type OperacionInversion,
  type ValoracionInversion,
  type TipoInversion,
  type TipoOperacion,
} from '../dominio/inversiones'

const TIPOS = Object.entries(ETIQUETA_TIPO_INVERSION).map(([valor, texto]) => ({ valor: valor as TipoInversion, texto }))

const TIPOS_OPERACION: { valor: TipoOperacion; texto: string }[] = [
  { valor: 'COMPRA', texto: 'Compra' },
  { valor: 'VENTA', texto: 'Venta' },
  { valor: 'DIVIDENDO', texto: 'Dividendo' },
  { valor: 'RENDIMIENTO', texto: 'Rendimiento (interés, alquiler)' },
  { valor: 'GASTO', texto: 'Gasto (comisión, IBI…)' },
  { valor: 'APORTACION', texto: 'Ampliación o mejora' },
]

/** Los tipos que se miden en unidades; el resto van por importe. */
const CON_UNIDADES: TipoInversion[] = ['FONDO', 'ACCIONES', 'CRIPTO']

function trazable() {
  return { creadoEn: new Date().toISOString(), creadoPor: 'admin', origen: 'MANUAL' as const }
}

function formatearUnidades(n: number, tipo: TipoInversion): string {
  const d = decimalesUnidades(tipo)
  return n.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: d })
}

export function Inversiones() {
  const datos = useStore((s) => s.datos)
  const guardarInversion = useStore((s) => s.guardarInversion)
  const anularInversion = useStore((s) => s.anularInversion)
  const guardarOperacion = useStore((s) => s.guardarOperacionInversion)
  const anularOperacion = useStore((s) => s.anularOperacionInversion)
  const guardarValoracion = useStore((s) => s.guardarValoracionInversion)

  const inversiones = useMemo(() => (datos.inversiones ?? []).filter((i) => !i.anuladoEn), [datos.inversiones])
  const [selId, setSelId] = useState<string | null>(null)
  const sel = inversiones.find((i) => i.id === selId) ?? inversiones[0] ?? null

  const [editInv, setEditInv] = useState<Inversion | null>(null)
  const [editOp, setEditOp] = useState<OperacionInversion | null>(null)
  const [editVal, setEditVal] = useState<ValoracionInversion | null>(null)

  const situaciones = useMemo(
    () => inversiones.map((i) => situacion(i, datos.operacionesInversion ?? [], datos.valoracionesInversion ?? [])),
    [inversiones, datos.operacionesInversion, datos.valoracionesInversion],
  )
  const resumen = useMemo(() => resumenCartera(situaciones), [situaciones])
  const sitSel = situaciones.find((s) => s.inversion.id === sel?.id)

  const opsSel = useMemo(
    () =>
      (datos.operacionesInversion ?? [])
        .filter((o) => o.inversionId === sel?.id && !o.anuladoEn)
        .sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [datos.operacionesInversion, sel],
  )
  const valsSel = useMemo(
    () =>
      (datos.valoracionesInversion ?? [])
        .filter((v) => v.inversionId === sel?.id && !v.anuladoEn)
        .sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [datos.valoracionesInversion, sel],
  )

  const nuevaInversion = () =>
    setEditInv({ id: nuevoId(), ...trazable(), tipo: 'ACCIONES', nombre: '', cuentaPGC: CUENTA_PGC_POR_TIPO.ACCIONES })

  if (inversiones.length === 0) {
    return (
      <>
        <div className="flex items-start justify-between gap-4 mb-6">
          <CabeceraPantalla titulo="Inversiones" descripcion="Fondos, acciones, criptomonedas, inmuebles y otras inversiones financieras." />
          <Boton onClick={nuevaInversion}>+ Nueva inversión</Boton>
        </div>
        <Tarjeta>
          <EstadoVacio
            icono="presupuesto"
            titulo="Aún no hay inversiones registradas"
            descripcion="Da de alta fondos, acciones, bitcoin o inmuebles. Verás el coste, el valor de mercado y la plusvalía latente por separado, y cada compra o venta genera su asiento en los libros."
            accion={<Boton onClick={nuevaInversion}>Añadir la primera</Boton>}
          />
        </Tarjeta>
        {editInv && <ModalInversion inversion={editInv} setInversion={setEditInv} onGuardar={(i) => { guardarInversion(i); setSelId(i.id); setEditInv(null) }} />}
      </>
    )
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4 mb-6">
        <CabeceraPantalla titulo="Inversiones" descripcion="Fondos, acciones, criptomonedas, inmuebles y otras inversiones financieras." />
        <Boton onClick={nuevaInversion}>+ Nueva inversión</Boton>
      </div>

      {/* ── Resumen de la cartera ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <Tarjeta className="!p-4">
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Coste contable</div>
          <div className="text-lg font-semibold"><ImporteEuro valor={resumen.coste} /></div>
        </Tarjeta>
        <Tarjeta className="!p-4">
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Valor de mercado</div>
          <div className="text-lg font-semibold"><ImporteEuro valor={resumen.valorMercado} /></div>
        </Tarjeta>
        <Tarjeta className="!p-4">
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Plusvalía latente</div>
          <div className="text-lg font-semibold"><ImporteEuro valor={resumen.plusvaliaLatente} color /></div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>no es beneficio</div>
        </Tarjeta>
        <Tarjeta className="!p-4">
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Resultado realizado</div>
          <div className="text-lg font-semibold"><ImporteEuro valor={resumen.resultadoRealizado} color /></div>
        </Tarjeta>
        <Tarjeta className="!p-4">
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Rendimientos</div>
          <div className="text-lg font-semibold"><ImporteEuro valor={resumen.rendimientos} /></div>
        </Tarjeta>
      </div>

      {resumen.sinValorar > 0 && (
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          {resumen.sinValorar} {resumen.sinValorar === 1 ? 'inversión no tiene' : 'inversiones no tienen'} valoración
          registrada: para esas se usa el coste, no se infla la cartera con un valor inventado.
        </p>
      )}

      {/* ── Listado ── */}
      <Tarjeta className="!p-0 overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--text-muted)' }} className="text-left">
                <th className="px-4 py-2.5 font-medium">Inversión</th>
                <th className="px-4 py-2.5 font-medium">Tipo</th>
                <th className="px-4 py-2.5 font-medium text-right">Unidades</th>
                <th className="px-4 py-2.5 font-medium text-right">Coste</th>
                <th className="px-4 py-2.5 font-medium text-right">Valor mercado</th>
                <th className="px-4 py-2.5 font-medium text-right">Latente</th>
                <th className="px-4 py-2.5 font-medium text-right">Realizado</th>
              </tr>
            </thead>
            <tbody>
              {situaciones.map((s) => {
                const activa = s.inversion.id === sel?.id
                return (
                  <tr
                    key={s.inversion.id}
                    className="border-t cursor-pointer"
                    style={{ borderColor: 'var(--border)', background: activa ? 'var(--surface-2)' : undefined }}
                    onClick={() => setSelId(s.inversion.id)}
                  >
                    <td className="px-4 py-2.5 font-medium">
                      {s.inversion.nombre}
                      {s.inversion.identificador && (
                        <span className="ml-2 text-xs tabular" style={{ color: 'var(--text-muted)' }}>{s.inversion.identificador}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">{ETIQUETA_TIPO_INVERSION[s.inversion.tipo]}</td>
                    <td className="px-4 py-2.5 text-right tabular">
                      {CON_UNIDADES.includes(s.inversion.tipo) ? formatearUnidades(s.posicion.unidades, s.inversion.tipo) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right"><ImporteEuro valor={s.posicion.coste} /></td>
                    <td className="px-4 py-2.5 text-right">
                      {s.valorMercado === undefined ? (
                        <span style={{ color: 'var(--text-muted)' }}>sin valorar</span>
                      ) : (
                        <ImporteEuro valor={s.valorMercado} />
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {s.plusvaliaLatente === undefined ? '—' : <ImporteEuro valor={s.plusvaliaLatente} color />}
                    </td>
                    <td className="px-4 py-2.5 text-right"><ImporteEuro valor={s.posicion.resultadoRealizado} color /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Tarjeta>

      {/* ── Detalle de la seleccionada ── */}
      {sel && sitSel && (
        <Tarjeta>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-base font-semibold">{sel.nombre}</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {ETIQUETA_TIPO_INVERSION[sel.tipo]} · cuenta {sel.cuentaPGC}
                {sitSel.posicion.costeUnitario > 0 && ` · coste medio ${formatearEuro(sitSel.posicion.costeUnitario)}/ud`}
                {sitSel.amortizacionAnual > 0 && ` · amortización ${formatearEuro(sitSel.amortizacionAnual)}/año`}
              </p>
            </div>
            <div className="flex gap-2">
              <Boton variante="secundario" onClick={() => setEditInv(sel)}>Editar</Boton>
              <Boton variante="secundario" onClick={() => setEditVal({ id: nuevoId(), ...trazable(), inversionId: sel.id, fecha: hoyISO(), valorTotal: sitSel.valorMercado ?? sitSel.posicion.coste })}>
                + Valoración
              </Boton>
              <Boton onClick={() => setEditOp({ id: nuevoId(), ...trazable(), inversionId: sel.id, fecha: hoyISO(), tipo: 'COMPRA' })}>
                + Operación
              </Boton>
            </div>
          </div>

          {avisosInversion(sitSel).length > 0 && (
            <ul className="rounded-xl p-3 mb-4 space-y-1 text-sm" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
              {avisosInversion(sitSel).map((a) => (
                <li key={a} style={{ color: /deterioro|más unidades|no coincide/.test(a) ? 'var(--neg)' : undefined }}>· {a}</li>
              ))}
            </ul>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold mb-2">Operaciones</h3>
              {opsSel.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sin operaciones todavía.</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {opsSel.map((o) => {
                      const importe = o.tipo === 'VENTA' ? netoVenta(o) : o.tipo === 'COMPRA' || o.tipo === 'APORTACION' ? costeCompra(o) : (o.importe ?? 0)
                      const signo = o.tipo === 'VENTA' || o.tipo === 'DIVIDENDO' || o.tipo === 'RENDIMIENTO' ? 1 : -1
                      return (
                        <tr key={o.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                          <td className="py-2 pr-2 tabular whitespace-nowrap">{formatearFecha(o.fecha)}</td>
                          <td className="py-2 pr-2">
                            {TIPOS_OPERACION.find((t) => t.valor === o.tipo)?.texto ?? o.tipo}
                            {o.unidades ? <span className="ml-1 text-xs" style={{ color: 'var(--text-muted)' }}>{formatearUnidades(o.unidades, sel.tipo)} ud</span> : null}
                          </td>
                          <td className="py-2 pr-2 text-right"><ImporteEuro valor={signo * importe} color /></td>
                          <td className="py-2 text-right">
                            <button
                              className="text-xs underline"
                              style={{ color: 'var(--neg)' }}
                              onClick={() => window.confirm('¿Anular esta operación? Queda el rastro, pero deja de contar.') && anularOperacion(o.id)}
                            >
                              Anular
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">Valoraciones</h3>
              <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                Valor de mercado en una fecha. Es informativo: no toca la contabilidad.
              </p>
              {valsSel.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sin valoraciones.</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {valsSel.map((v) => (
                      <tr key={v.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                        <td className="py-2 pr-2 tabular whitespace-nowrap">{formatearFecha(v.fecha)}</td>
                        <td className="py-2 pr-2 text-right"><ImporteEuro valor={v.valorTotal} /></td>
                        <td className="py-2 pr-2 text-xs" style={{ color: 'var(--text-muted)' }}>{v.fuente ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t flex justify-end" style={{ borderColor: 'var(--border)' }}>
            <button
              className="text-sm underline"
              style={{ color: 'var(--neg)' }}
              onClick={() =>
                window.confirm(`¿Dar de baja "${sel.nombre}" de la cartera?\n\nSus operaciones quedan registradas; solo deja de aparecer.`) &&
                anularInversion(sel.id)
              }
            >
              Dar de baja la inversión
            </button>
          </div>
        </Tarjeta>
      )}

      {editInv && <ModalInversion inversion={editInv} setInversion={setEditInv} onGuardar={(i) => { guardarInversion(i); setSelId(i.id); setEditInv(null) }} />}
      {editOp && sel && <ModalOperacion op={editOp} setOp={setEditOp} tipoInversion={sel.tipo} onGuardar={(o) => { guardarOperacion(o); setEditOp(null) }} />}
      {editVal && <ModalValoracion val={editVal} setVal={setEditVal} onGuardar={(v) => { guardarValoracion(v); setEditVal(null) }} />}
    </>
  )
}

function ModalInversion({
  inversion,
  setInversion,
  onGuardar,
}: {
  inversion: Inversion
  setInversion: (i: Inversion | null) => void
  onGuardar: (i: Inversion) => void
}) {
  const esInmueble = inversion.tipo === 'INMUEBLE'
  return (
    <Modal titulo={inversion.nombre ? 'Editar inversión' : 'Nueva inversión'} onCerrar={() => setInversion(null)}>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Select
            etiqueta="Tipo"
            valor={inversion.tipo}
            opciones={TIPOS}
            onChange={(v) => setInversion({ ...inversion, tipo: v, cuentaPGC: CUENTA_PGC_POR_TIPO[v] })}
          />
          <Campo etiqueta="Nombre" valor={inversion.nombre} onChange={(v) => setInversion({ ...inversion, nombre: v })} autoFocus />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Campo
            etiqueta="Identificador"
            valor={inversion.identificador ?? ''}
            onChange={(v) => setInversion({ ...inversion, identificador: v })}
            ayuda="ISIN, ticker o referencia catastral"
          />
          <Campo
            etiqueta="Cuenta PGC"
            valor={inversion.cuentaPGC}
            onChange={(v) => setInversion({ ...inversion, cuentaPGC: v })}
            ayuda={inversion.tipo === 'CRIPTO' ? 'La cripto no tiene cuenta oficial: confírmala con tu asesoría' : undefined}
          />
        </div>

        {esInmueble && (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              <CampoNumero etiqueta="Valor del terreno" sufijo="€" valor={inversion.valorTerreno ?? 0} onChange={(v) => setInversion({ ...inversion, valorTerreno: v })} ayuda="No se amortiza" />
              <CampoNumero etiqueta="Valor de la construcción" sufijo="€" valor={inversion.valorConstruccion ?? 0} onChange={(v) => setInversion({ ...inversion, valorConstruccion: v })} ayuda="Sí se amortiza" />
            </div>
            <CampoNumero etiqueta="Años de vida útil de la construcción" valor={inversion.aniosVidaUtil ?? 0} onChange={(v) => setInversion({ ...inversion, aniosVidaUtil: v })} />
          </>
        )}

        {(inversion.tipo === 'DEPOSITO' || inversion.tipo === 'PRESTAMO_CONCEDIDO') && (
          <CampoNumero etiqueta="Tipo de interés anual" sufijo="%" paso="0.01" valor={inversion.tipoInteres ?? 0} onChange={(v) => setInversion({ ...inversion, tipoInteres: v })} />
        )}

        <Campo etiqueta="Notas" valor={inversion.notas ?? ''} onChange={(v) => setInversion({ ...inversion, notas: v })} />

        <div className="flex justify-end gap-2 pt-1">
          <Boton variante="secundario" onClick={() => setInversion(null)}>Cancelar</Boton>
          <Boton onClick={() => inversion.nombre.trim() && onGuardar(inversion)}>Guardar</Boton>
        </div>
      </div>
    </Modal>
  )
}

function ModalOperacion({
  op,
  setOp,
  tipoInversion,
  onGuardar,
}: {
  op: OperacionInversion
  setOp: (o: OperacionInversion | null) => void
  tipoInversion: TipoInversion
  onGuardar: (o: OperacionInversion) => void
}) {
  const conUnidades = (op.tipo === 'COMPRA' || op.tipo === 'VENTA') && CON_UNIDADES.includes(tipoInversion)
  const porImporte = op.tipo === 'DIVIDENDO' || op.tipo === 'RENDIMIENTO' || op.tipo === 'GASTO' || op.tipo === 'APORTACION'
  const total = op.tipo === 'VENTA' ? netoVenta(op) : op.tipo === 'COMPRA' ? costeCompra(op) : (op.importe ?? 0)

  return (
    <Modal titulo="Operación de la inversión" onCerrar={() => setOp(null)}>
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Select etiqueta="Tipo de operación" valor={op.tipo} opciones={TIPOS_OPERACION} onChange={(v) => setOp({ ...op, tipo: v })} />
          <Campo etiqueta="Fecha" tipo="date" valor={op.fecha} onChange={(v) => setOp({ ...op, fecha: v })} />
        </div>

        {conUnidades && (
          <div className="grid sm:grid-cols-2 gap-4">
            <CampoNumero
              etiqueta="Unidades"
              valor={op.unidades ?? 0}
              onChange={(v) => setOp({ ...op, unidades: v })}
              paso={tipoInversion === 'CRIPTO' ? '0.00000001' : 'any'}
              ayuda={tipoInversion === 'CRIPTO' ? 'Hasta 8 decimales' : undefined}
            />
            <CampoNumero etiqueta="Precio por unidad" sufijo="€" paso="any" valor={op.precioUnitario ?? 0} onChange={(v) => setOp({ ...op, precioUnitario: v })} />
          </div>
        )}

        {!conUnidades && !porImporte && (
          <CampoNumero etiqueta="Importe" sufijo="€" valor={op.importe ?? 0} onChange={(v) => setOp({ ...op, importe: v })} />
        )}

        {porImporte && (
          <CampoNumero
            etiqueta="Importe"
            sufijo="€"
            valor={op.importe ?? 0}
            onChange={(v) => setOp({ ...op, importe: v })}
            ayuda={op.tipo === 'APORTACION' ? 'Mejora o ampliación: sube el coste sin más unidades' : undefined}
          />
        )}

        {(op.tipo === 'COMPRA' || op.tipo === 'VENTA') && (
          <CampoNumero
            etiqueta="Gastos de la operación"
            sufijo="€"
            valor={op.gastos ?? 0}
            onChange={(v) => setOp({ ...op, gastos: v })}
            ayuda="Comisiones e impuestos. En la compra suman al coste; en la venta restan del cobro."
          />
        )}

        {(op.tipo === 'COMPRA' || op.tipo === 'VENTA') && total > 0 && (
          <div className="rounded-xl p-3 text-sm flex justify-between" style={{ background: 'var(--surface-2)' }}>
            <span style={{ color: 'var(--text-muted)' }}>{op.tipo === 'COMPRA' ? 'Coste total (con gastos)' : 'Neto que se cobra'}</span>
            <span className="tabular font-medium">{formatearEuro(total)}</span>
          </div>
        )}

        <Campo etiqueta="Notas" valor={op.notas ?? ''} onChange={(v) => setOp({ ...op, notas: v })} />

        <div className="flex justify-end gap-2 pt-1">
          <Boton variante="secundario" onClick={() => setOp(null)}>Cancelar</Boton>
          <Boton onClick={() => onGuardar(op)}>Guardar</Boton>
        </div>
      </div>
    </Modal>
  )
}

function ModalValoracion({
  val,
  setVal,
  onGuardar,
}: {
  val: ValoracionInversion
  setVal: (v: ValoracionInversion | null) => void
  onGuardar: (v: ValoracionInversion) => void
}) {
  return (
    <Modal titulo="Valoración de mercado" onCerrar={() => setVal(null)}>
      <div className="space-y-4">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          El valor que tendría hoy la posición. Sirve para ver la plusvalía o minusvalía latente. Si el valor cae por
          debajo del coste, la app avisará de que hay que dotar deterioro.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <Campo etiqueta="Fecha" tipo="date" valor={val.fecha} onChange={(v) => setVal({ ...val, fecha: v })} />
          <CampoNumero etiqueta="Valor total" sufijo="€" valor={val.valorTotal} onChange={(v) => setVal({ ...val, valorTotal: v })} />
        </div>
        <Campo etiqueta="Fuente" valor={val.fuente ?? ''} onChange={(v) => setVal({ ...val, fuente: v })} ayuda="Extracto del banco, tasación, cotización…" />
        <div className="flex justify-end gap-2 pt-1">
          <Boton variante="secundario" onClick={() => setVal(null)}>Cancelar</Boton>
          <Boton onClick={() => onGuardar(val)}>Guardar</Boton>
        </div>
      </div>
    </Modal>
  )
}
