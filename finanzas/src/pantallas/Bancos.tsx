import { useMemo, useRef, useState } from 'react'
import { useStore } from '../store/store'
import { CabeceraPantalla } from './Pantalla'
import { Tarjeta, Boton, EstadoVacio, Semaforo, ImporteEuro } from '../componentes/ui'
import { Campo, CampoNumero, Select, Toggle, Modal } from '../componentes/formularios'
import { hoyISO, formatearFecha } from '../lib/fechas'
import { nuevoId } from '../dominio/id'
import { formatearEuro } from '../dominio/dinero'
import { saldoCuenta } from '../dominio/tesoreria'
import { parsearN43 } from '../dominio/n43'
import { sugerencias, type Emparejable } from '../dominio/conciliacion'
import type { CuentaTesoreria, MovimientoTesoreria, TipoCuentaTesoreria } from '../dominio/tipos'

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
  const conciliar = useStore((s) => s.conciliarMovimiento)

  const cuentas = datos.cuentasTesoreria.filter((c) => c.tipo !== 'CAJA' && !c.anuladoEn)
  const [selId, setSelId] = useState<string | null>(cuentas[0]?.id ?? null)
  const sel = cuentas.find((c) => c.id === selId) ?? cuentas[0] ?? null
  const [nueva, setNueva] = useState<CuentaTesoreria | null>(null)
  const [mov, setMov] = useState<MovimientoTesoreria | null>(null)
  const [soloNoConc, setSoloNoConc] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const movs = useMemo(() => {
    let l = datos.movimientos.filter((m) => sel && m.cuentaId === sel.id && !m.anuladoEn)
    if (soloNoConc) l = l.filter((m) => !m.conciliado)
    return l.sort((a, b) => b.fecha.localeCompare(a.fecha))
  }, [datos.movimientos, sel, soloNoConc])

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

  const onImportarN43 = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f || !sel) return
    const texto = await f.text()
    const r = parsearN43(texto)
    const nuevos: MovimientoTesoreria[] = []
    for (const cta of r.cuentas) {
      for (const m of cta.movimientos) {
        nuevos.push({ id: nuevoId(), creadoEn: new Date().toISOString(), creadoPor: 'sistema', origen: 'API', cuentaId: sel.id, fecha: m.fechaOperacion, concepto: m.concepto || 'Movimiento N43', importe: m.importe, clase: 'OTRO', conciliado: false, referencia: m.referencia })
      }
    }
    const insertados = importarMovimientos(nuevos)
    setAviso(`Importadas ${insertados} líneas nuevas de ${nuevos.length} leídas${r.errores.length ? ` · ${r.errores.length} con avisos` : ''}.`)
    if (fileRef.current) fileRef.current.value = ''
  }

  if (cuentas.length === 0) {
    return (
      <>
        <div className="flex items-start justify-between gap-4 mb-6">
          <CabeceraPantalla titulo="Bancos" descripcion="Cuentas, movimientos y conciliación con importación N43." />
          <Boton onClick={crear}>+ Nueva cuenta</Boton>
        </div>
        <Tarjeta><EstadoVacio icono="banco" titulo="Aún no hay cuentas bancarias" descripcion="Da de alta tus cuentas corrientes, TPV liquidadores y pasarelas. Podrás importar el extracto (Norma 43) y conciliarlo con un clic." accion={<Boton onClick={crear}>Crear la primera</Boton>} /></Tarjeta>
        {nueva && <ModalCuenta cuenta={nueva} setCuenta={setNueva} onGuardar={(c) => { guardarCuenta(c); setSelId(c.id); setNueva(null) }} />}
      </>
    )
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4 mb-6">
        <CabeceraPantalla titulo="Bancos" descripcion="Movimientos, importación Norma 43 y conciliación semiautomática." />
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
              <Boton variante="secundario" onClick={() => fileRef.current?.click()}>Importar N43</Boton>
              <input ref={fileRef} type="file" accept=".n43,.txt,.q43,text/plain" className="hidden" onChange={onImportarN43} />
            </Tarjeta>
            <Tarjeta className="!p-4"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>No conciliados</div><div className="text-xl font-semibold tabular">{noConciliados}</div></Tarjeta>
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

          <div className="flex items-center justify-between mb-2">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{movs.length} movimientos</span>
            <div className="w-48"><Toggle etiqueta="Solo no conciliados" valor={soloNoConc} onChange={setSoloNoConc} /></div>
          </div>

          <Tarjeta className="!p-0 overflow-hidden">
            {movs.length === 0 ? (
              <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Sin movimientos. Importa el extracto N43 o añádelos a mano.</div>
            ) : (
              <table className="w-full text-sm">
                <thead><tr style={{ color: 'var(--text-muted)' }} className="text-left"><th className="px-4 py-2.5 font-medium">Fecha</th><th className="px-4 py-2.5 font-medium">Concepto</th><th className="px-4 py-2.5 font-medium text-right">Importe</th><th className="px-4 py-2.5 font-medium text-center">Conciliado</th></tr></thead>
                <tbody>
                  {movs.map((m) => (
                    <tr key={m.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                      <td className="px-4 py-2.5 tabular">{formatearFecha(m.fecha)}</td>
                      <td className="px-4 py-2.5">{m.concepto}{m.referencia && <span className="ml-2 text-xs tabular" style={{ color: 'var(--text-muted)' }}>{m.referencia}</span>}</td>
                      <td className="px-4 py-2.5 text-right"><ImporteEuro valor={m.importe} color /></td>
                      <td className="px-4 py-2.5 text-center">
                        <button onClick={() => conciliar(m.id, !m.conciliado)} aria-label="Conciliar">
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
