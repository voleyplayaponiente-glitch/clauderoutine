import { useMemo, useRef, useState } from 'react'
import { useStore } from '../store/store'
import { CabeceraPantalla } from './Pantalla'
import { Tarjeta, Boton, EstadoVacio, Semaforo, ImporteEuro } from '../componentes/ui'
import { Campo, CampoNumero, Select, Toggle, Modal } from '../componentes/formularios'
import { hoyISO, formatearFecha } from '../lib/fechas'
import { nuevoId } from '../dominio/id'
import { formatearEuro } from '../dominio/dinero'
import { saldoCuenta } from '../dominio/tesoreria'
import { esFechaIsoValida } from '../dominio/validacion'
import { leerExtracto, type LecturaExtracto } from '../lib/extracto'
import { ModalImportarExtracto } from './bancos/ModalImportarExtracto'
import { sugerencias, type Emparejable } from '../dominio/conciliacion'
import type { CuentaTesoreria, MovimientoTesoreria, TipoCuentaTesoreria } from '../dominio/tipos'

/** Procedencia que se guarda en el movimiento según el formato del fichero leído. */
const ORIGEN_POR_FORMATO: Record<string, MovimientoTesoreria['origen']> = {
  N43: 'API',
  EXCEL: 'EXCEL',
  CSV: 'CSV',
  PDF: 'PDF',
  DESCONOCIDO: 'MANUAL',
}

const TIPOS: { valor: TipoCuentaTesoreria; texto: string }[] = [
  { valor: 'BANCO', texto: 'Cuenta corriente' },
  { valor: 'TPV_LIQUIDADOR', texto: 'TPV liquidador' },
  { valor: 'PASARELA', texto: 'Pasarela de pago' },
]

export function Bancos() {
  const datos = useStore((s) => s.datos)
  const guardarCuenta = useStore((s) => s.guardarCuentaTesoreria)
  const guardarMovimiento = useStore((s) => s.guardarMovimiento)
  const importarMovimientos = useStore((s) => s.importarMovimientos)
  const anularMovimientos = useStore((s) => s.anularMovimientos)
  const conciliar = useStore((s) => s.conciliarMovimiento)
  const conciliarVarios = useStore((s) => s.conciliarMovimientos)

  const cuentas = datos.cuentasTesoreria.filter((c) => c.tipo !== 'CAJA' && !c.anuladoEn)
  const [selId, setSelId] = useState<string | null>(cuentas[0]?.id ?? null)
  const sel = cuentas.find((c) => c.id === selId) ?? cuentas[0] ?? null
  const [nueva, setNueva] = useState<CuentaTesoreria | null>(null)
  const [mov, setMov] = useState<MovimientoTesoreria | null>(null)
  const [soloNoConc, setSoloNoConc] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [pendiente, setPendiente] = useState<{ lectura: LecturaExtracto; nombre: string } | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const fileRef = useRef<HTMLInputElement>(null)

  const movs = useMemo(() => {
    let l = datos.movimientos.filter((m) => sel && m.cuentaId === sel.id && !m.anuladoEn)
    if (soloNoConc) l = l.filter((m) => !m.conciliado)
    return l.sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [datos.movimientos, sel, soloNoConc])

  /** Movimientos guardados con una fecha imposible (los dejó el parser N43 antiguo). */
  const conFechaMala = useMemo(() => movs.filter((m) => !esFechaIsoValida(m.fecha)), [movs])

  const alternarSeleccion = (id: string) => {
    setSeleccion((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const anularSeleccionados = () => {
    const ids = [...seleccion]
    if (ids.length === 0) return
    const ok = window.confirm(
      `Se van a anular ${ids.length} movimiento${ids.length > 1 ? 's' : ''}.\n\n` +
        'Dejan de contar en el saldo y desaparecen de la lista, pero quedan marcados como anulados (no se borra el rastro).\n\n¿Continuar?',
    )
    if (!ok) return
    const n = anularMovimientos(ids)
    setSeleccion(new Set())
    setAviso(`Anulados ${n} movimientos.`)
  }

  const saldo = sel ? saldoCuenta(sel, datos.movimientos) : 0
  const noConciliados = sel ? datos.movimientos.filter((m) => m.cuentaId === sel.id && !m.anuladoEn && !m.conciliado).length : 0

  // Sugerencias caja → banco: entradas de banco vs. ingresos en banco desde cajas.
  const sugs = useMemo(() => {
    if (!sel) return []
    const extracto: Emparejable[] = datos.movimientos
      .filter((m) => m.cuentaId === sel.id && !m.anuladoEn && !m.conciliado && m.importe > 0)
      .map((m) => ({ id: m.id, fecha: m.fecha, concepto: m.concepto, importe: m.importe }))
    const candidatos: Emparejable[] = datos.movimientos
      .filter((m) => m.cuentaId !== sel.id && !m.anuladoEn && !m.conciliado && m.clase === 'INGRESO_BANCO')
      .map((m) => ({ id: m.id, fecha: m.fecha, concepto: m.concepto, importe: -m.importe }))
    return sugerencias(extracto, candidatos, 5)
  }, [datos.movimientos, sel])

  const crear = () => setNueva({ id: nuevoId(), creadoEn: new Date().toISOString(), creadoPor: 'admin', origen: 'MANUAL', nombre: '', tipo: 'BANCO', saldoInicial: 0, cuentaPGC: '572' })
  const abrirMov = () => sel && setMov({ id: nuevoId(), creadoEn: new Date().toISOString(), creadoPor: 'admin', origen: 'MANUAL', cuentaId: sel.id, fecha: hoyISO(), concepto: '', importe: 0, clase: 'OTRO', conciliado: false })

  /** Lee el fichero y abre la previsualización. No toca los datos todavía. */
  const onElegirFichero = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f || !sel) return
    setLeyendo(true)
    setAviso(null)
    try {
      const lectura = await leerExtracto(f)
      setPendiente({ lectura, nombre: f.name })
    } catch (err) {
      setAviso(`No se pudo leer el fichero: ${err instanceof Error ? err.message : 'error desconocido'}`)
    } finally {
      setLeyendo(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  /** Aplica lo previsualizado. La deduplicación la hace el store por fecha+concepto+importe. */
  const aplicarImportacion = () => {
    if (!pendiente || !sel) return
    const nuevos: MovimientoTesoreria[] = pendiente.lectura.movimientos.map((m) => ({
      id: nuevoId(),
      creadoEn: new Date().toISOString(),
      creadoPor: 'sistema',
      origen: ORIGEN_POR_FORMATO[pendiente.lectura.formato],
      cuentaId: sel.id,
      fecha: m.fecha,
      concepto: m.concepto,
      importe: m.importe,
      clase: 'OTRO',
      conciliado: false,
    }))
    const insertados = importarMovimientos(nuevos, pendiente.nombre)
    const omitidos = nuevos.length - insertados
    setAviso(
      `Importados ${insertados} movimientos${omitidos > 0 ? ` · ${omitidos} ya estaban` : ''}` +
        `${pendiente.lectura.descartadas.length > 0 ? ` · ${pendiente.lectura.descartadas.length} líneas descartadas` : ''}.`,
    )
    setPendiente(null)
  }

  if (cuentas.length === 0) {
    return (
      <>
        <div className="flex items-start justify-between gap-4 mb-6">
          <CabeceraPantalla titulo="Bancos" descripcion="Cuentas, movimientos y conciliación con importación N43." />
          <Boton onClick={crear}>+ Nueva cuenta</Boton>
        </div>
        <Tarjeta><EstadoVacio icono="banco" titulo="Aún no hay cuentas bancarias" descripcion="Da de alta tus cuentas corrientes, TPV liquidadores y pasarelas. Podrás importar el extracto en Norma 43, Excel, CSV o PDF y conciliarlo con un clic." accion={<Boton onClick={crear}>Crear la primera</Boton>} /></Tarjeta>
        {nueva && <ModalCuenta cuenta={nueva} setCuenta={setNueva} onGuardar={(c) => { guardarCuenta(c); setSelId(c.id); setNueva(null) }} />}
      </>
    )
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4 mb-6">
        <CabeceraPantalla titulo="Bancos" descripcion="Movimientos, importación de extractos (Norma 43, Excel, CSV y PDF) y conciliación semiautomática." />
        <Boton onClick={crear}>+ Nueva cuenta</Boton>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {cuentas.map((c) => (
          <button key={c.id} onClick={() => setSelId(c.id)} className="rounded-xl px-3 py-2 text-sm text-left" style={{ background: c.id === sel?.id ? 'var(--color-brand-500)' : 'var(--surface)', color: c.id === sel?.id ? '#fff' : 'var(--text)', border: '1px solid var(--border)' }}>
            {c.nombre}
          </button>
        ))}
      </div>

      {sel && (
        <>
          <div className="grid sm:grid-cols-4 gap-3 mb-4">
            <Tarjeta className="!p-4"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Saldo</div><div className="text-xl font-semibold"><ImporteEuro valor={saldo} color /></div>{sel.iban && <div className="text-xs mt-1 tabular" style={{ color: 'var(--text-muted)' }}>{sel.iban}</div>}</Tarjeta>
            <Tarjeta className="!p-4 flex items-center"><Boton onClick={abrirMov}>+ Movimiento</Boton></Tarjeta>
            <Tarjeta className="!p-4 flex items-center">
              <Boton variante="secundario" onClick={() => fileRef.current?.click()}>
                {leyendo ? 'Leyendo…' : 'Importar extracto'}
              </Boton>
              <input
                ref={fileRef}
                type="file"
                accept=".n43,.q43,.c43,.aeb,.txt,.csv,.tsv,.xlsx,.xls,.xlsm,.pdf"
                className="hidden"
                onChange={onElegirFichero}
              />
            </Tarjeta>
            <Tarjeta className="!p-4"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>No conciliados</div><div className="text-xl font-semibold tabular">{noConciliados}</div><div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>pendientes de comprobar</div></Tarjeta>
          </div>

          {aviso && <div className="mb-4"><Semaforo estado="positivo" texto={aviso} /></div>}

          {sugs.length > 0 && (
            <Tarjeta className="mb-4">
              <h3 className="font-semibold mb-1">Sugerencias de conciliación (caja → banco)</h3>
              <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Ingresos de caja que casan con entradas de este banco.</p>
              <div className="space-y-2">
                {sugs.map((s) => (
                  <div key={s.extracto.id} className="flex items-center justify-between gap-2 text-sm rounded-lg px-3 py-2" style={{ background: 'var(--surface-2)' }}>
                    <span>{formatearFecha(s.extracto.fecha)} · {s.extracto.concepto || 'Ingreso'} · <span className="tabular">{formatearEuro(s.extracto.importe)}</span></span>
                    <div className="flex items-center gap-2">
                      <Semaforo estado="atencion" texto={`${Math.round(s.score * 100)}%`} />
                      <Boton onClick={() => { conciliar(s.extracto.id, true); conciliar(s.candidato.id, true) }}>Conciliar</Boton>
                    </div>
                  </div>
                ))}
              </div>
            </Tarjeta>
          )}

          {conFechaMala.length > 0 && (
            <div className="rounded-xl p-3 mb-3 flex flex-wrap items-center justify-between gap-3" style={{ background: 'rgba(255,159,10,.12)', border: '1px solid var(--warn)' }}>
              <p className="text-sm">
                Hay <strong>{conFechaMala.length} movimientos con una fecha imposible</strong> (importados con la versión
                anterior, que leía mal el Norma 43). Conviene anularlos y volver a importar el extracto.
              </p>
              <Boton variante="secundario" onClick={() => setSeleccion(new Set(conFechaMala.map((m) => m.id)))}>
                Seleccionarlos
              </Boton>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {movs.length} movimientos
              {seleccion.size > 0 && ` · ${seleccion.size} seleccionados`}
            </span>
            <div className="flex items-center gap-3">
              {seleccion.size > 0 && (
                <>
                  <button className="text-sm underline" style={{ color: 'var(--text-muted)' }} onClick={() => setSeleccion(new Set())}>
                    Quitar selección
                  </button>
                  <Boton
                    variante="secundario"
                    onClick={() => {
                      const n = conciliarVarios([...seleccion], true)
                      setSeleccion(new Set())
                      setAviso(`Conciliados ${n} movimientos.`)
                    }}
                  >
                    Conciliar {seleccion.size}
                  </Boton>
                  <Boton
                    variante="secundario"
                    onClick={() => {
                      const n = conciliarVarios([...seleccion], false)
                      setSeleccion(new Set())
                      setAviso(`Marcados ${n} como pendientes de conciliar.`)
                    }}
                  >
                    Desconciliar
                  </Boton>
                  <Boton variante="secundario" onClick={anularSeleccionados}>
                    Anular {seleccion.size}
                  </Boton>
                </>
              )}
              <div className="w-48"><Toggle etiqueta="Solo no conciliados" valor={soloNoConc} onChange={setSoloNoConc} /></div>
            </div>
          </div>

          <Tarjeta className="!p-0 overflow-hidden">
            {movs.length === 0 ? (
              <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Sin movimientos. Importa el extracto del banco (Norma 43, Excel, CSV o PDF) o añádelos a mano.</div>
            ) : (
              <table className="w-full text-sm">
                <thead><tr style={{ color: 'var(--text-muted)' }} className="text-left"><th className="pl-4 py-2.5 font-medium w-8"><input type="checkbox" aria-label="Seleccionar todos" checked={movs.length > 0 && seleccion.size === movs.length} onChange={(e) => setSeleccion(e.target.checked ? new Set(movs.map((m) => m.id)) : new Set())} /></th><th className="px-4 py-2.5 font-medium">Fecha</th><th className="px-4 py-2.5 font-medium">Concepto</th><th className="px-4 py-2.5 font-medium text-right">Importe</th><th className="px-4 py-2.5 font-medium text-center">Conciliado</th></tr></thead>
                <tbody>
                  {movs.map((m) => (
                    <tr key={m.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                      <td className="pl-4 py-2.5">
                        <input type="checkbox" aria-label={`Seleccionar ${m.concepto}`} checked={seleccion.has(m.id)} onChange={() => alternarSeleccion(m.id)} />
                      </td>
                      <td className="px-4 py-2.5 tabular" style={{ color: esFechaIsoValida(m.fecha) ? undefined : 'var(--neg)' }}>
                        {esFechaIsoValida(m.fecha) ? formatearFecha(m.fecha) : `${m.fecha} (no válida)`}
                      </td>
                      <td className="px-4 py-2.5">{m.concepto}{m.referencia && <span className="ml-2 text-xs tabular" style={{ color: 'var(--text-muted)' }}>{m.referencia}</span>}</td>
                      <td className="px-4 py-2.5 text-right"><ImporteEuro valor={m.importe} color /></td>
                      <td className="px-4 py-2.5 text-center">
                        <button
                          onClick={() => conciliar(m.id, !m.conciliado)}
                          className="cursor-pointer"
                          aria-pressed={m.conciliado}
                          title={m.conciliado ? 'Comprobado contra el extracto. Pulsa para volver a dejarlo pendiente.' : 'Pendiente de comprobar. Pulsa cuando lo hayas cotejado con el extracto.'}
                          aria-label={m.conciliado ? 'Conciliado, pulsa para desconciliar' : 'Sin conciliar, pulsa para conciliar'}
                        >
                          {m.conciliado ? <Semaforo estado="positivo" texto="Sí" /> : <Semaforo estado="neutro" texto="No" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Tarjeta>
        </>
      )}

      {nueva && <ModalCuenta cuenta={nueva} setCuenta={setNueva} onGuardar={(c) => { guardarCuenta(c); setSelId(c.id); setNueva(null) }} />}
      {mov && <ModalMovBanco mov={mov} setMov={setMov} onGuardar={(m) => { guardarMovimiento(m); setMov(null) }} />}
      {pendiente && sel && (
        <ModalImportarExtracto
          lectura={pendiente.lectura}
          nombreFichero={pendiente.nombre}
          nombreCuenta={sel.nombre}
          onCerrar={() => setPendiente(null)}
          onAplicar={aplicarImportacion}
        />
      )}
    </>
  )
}

function ModalCuenta({ cuenta, setCuenta, onGuardar }: { cuenta: CuentaTesoreria; setCuenta: (c: CuentaTesoreria) => void; onGuardar: (c: CuentaTesoreria) => void }) {
  return (
    <Modal titulo="Nueva cuenta bancaria" onCerrar={() => setCuenta(null as any)}>
      <div className="space-y-4">
        <Campo etiqueta="Nombre" valor={cuenta.nombre} onChange={(v) => setCuenta({ ...cuenta, nombre: v })} placeholder="Cuenta principal — Banco X" autoFocus />
        <div className="grid grid-cols-2 gap-4">
          <Select etiqueta="Tipo" valor={cuenta.tipo} onChange={(v) => setCuenta({ ...cuenta, tipo: v as TipoCuentaTesoreria })} opciones={TIPOS} />
          <Campo etiqueta="IBAN" valor={cuenta.iban ?? ''} onChange={(v) => setCuenta({ ...cuenta, iban: v })} placeholder="ES.." />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <CampoNumero etiqueta="Saldo inicial" valor={cuenta.saldoInicial} onChange={(v) => setCuenta({ ...cuenta, saldoInicial: v })} sufijo="€" />
          <CampoNumero etiqueta="Límite de descubierto" valor={cuenta.limiteDescubierto ?? 0} onChange={(v) => setCuenta({ ...cuenta, limiteDescubierto: v })} sufijo="€" />
        </div>
        <div className="flex justify-end gap-2 pt-1"><Boton variante="secundario" onClick={() => setCuenta(null as any)}>Cancelar</Boton><Boton onClick={() => cuenta.nombre.trim() && onGuardar(cuenta)}>Crear cuenta</Boton></div>
      </div>
    </Modal>
  )
}

function ModalMovBanco({ mov, setMov, onGuardar }: { mov: MovimientoTesoreria; setMov: (m: MovimientoTesoreria) => void; onGuardar: (m: MovimientoTesoreria) => void }) {
  const [entrada, setEntrada] = useState(true)
  const [magnitud, setMagnitud] = useState(0)
  return (
    <Modal titulo="Movimiento bancario" onCerrar={() => setMov(null as any)}>
      <div className="space-y-4">
        <Campo etiqueta="Fecha" valor={mov.fecha} onChange={(v) => setMov({ ...mov, fecha: v })} tipo="date" />
        <Campo etiqueta="Concepto" valor={mov.concepto} onChange={(v) => setMov({ ...mov, concepto: v })} placeholder="Descripción" />
        <div className="flex items-center gap-2">
          <button onClick={() => setEntrada(true)} className="flex-1 rounded-xl px-3 py-2 text-sm" style={{ background: entrada ? 'var(--color-brand-500)' : 'var(--surface-2)', color: entrada ? '#fff' : 'var(--text)', border: '1px solid var(--border)' }}>Entrada +</button>
          <button onClick={() => setEntrada(false)} className="flex-1 rounded-xl px-3 py-2 text-sm" style={{ background: !entrada ? 'var(--color-brand-500)' : 'var(--surface-2)', color: !entrada ? '#fff' : 'var(--text)', border: '1px solid var(--border)' }}>Salida −</button>
        </div>
        <CampoNumero etiqueta="Importe" valor={magnitud} onChange={setMagnitud} sufijo="€" />
        <div className="flex justify-end gap-2 pt-1"><Boton variante="secundario" onClick={() => setMov(null as any)}>Cancelar</Boton><Boton onClick={() => onGuardar({ ...mov, importe: Math.abs(magnitud) * (entrada ? 1 : -1) })}>Guardar</Boton></div>
      </div>
    </Modal>
  )
}
