import { useMemo, useState } from 'react'
import { useStore } from '../store/store'
import { CabeceraPantalla } from './Pantalla'
import { Tarjeta, Boton, EstadoVacio, Semaforo, ImporteEuro } from '../componentes/ui'
import { Campo, CampoNumero, Select, Modal } from '../componentes/formularios'
import { hoyISO, formatearFecha } from '../lib/fechas'
import { nuevoId } from '../dominio/id'
import { formatearEuro } from '../dominio/dinero'
import { saldoCuenta, DENOMINACIONES_EUR, evaluarArqueo, totalArqueo } from '../dominio/tesoreria'
import type { CuentaTesoreria, MovimientoTesoreria, ClaseMovimiento, Denominacion, ArqueoCaja } from '../dominio/tipos'

const CLASES: { valor: ClaseMovimiento; texto: string; entrada: boolean }[] = [
  { valor: 'VENTA_EFECTIVO', texto: 'Venta en efectivo', entrada: true },
  { valor: 'COBRO', texto: 'Cobro', entrada: true },
  { valor: 'PAGO_PROVEEDOR', texto: 'Pago a proveedor', entrada: false },
  { valor: 'GASTO_MENOR', texto: 'Gasto menor', entrada: false },
  { valor: 'INGRESO_BANCO', texto: 'Ingreso en banco', entrada: false },
  { valor: 'RETIRADA', texto: 'Retirada', entrada: false },
  { valor: 'OTRO', texto: 'Otro', entrada: true },
]

export function Caja() {
  const config = useStore((s) => s.config)
  const datos = useStore((s) => s.datos)
  const guardarCuenta = useStore((s) => s.guardarCuentaTesoreria)
  const guardarMovimiento = useStore((s) => s.guardarMovimiento)
  const anularMovimiento = useStore((s) => s.anularMovimiento)
  const guardarArqueo = useStore((s) => s.guardarArqueo)

  const cajas = datos.cuentasTesoreria.filter((c) => c.tipo === 'CAJA' && !c.anuladoEn)
  const [selId, setSelId] = useState<string | null>(cajas[0]?.id ?? null)
  const sel = cajas.find((c) => c.id === selId) ?? cajas[0] ?? null
  const [nuevaCaja, setNuevaCaja] = useState<CuentaTesoreria | null>(null)
  const [mov, setMov] = useState<MovimientoTesoreria | null>(null)
  const [arqueo, setArqueo] = useState<{ den: Record<number, number>; explicacion: string; responsable: string } | null>(null)

  const movs = useMemo(
    () => datos.movimientos.filter((m) => sel && m.cuentaId === sel.id && !m.anuladoEn).sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [datos.movimientos, sel],
  )
  const saldo = sel ? saldoCuenta(sel, datos.movimientos) : 0

  const crearCaja = () => {
    setNuevaCaja({ id: nuevoId(), creadoEn: new Date().toISOString(), creadoPor: 'admin', origen: 'MANUAL', nombre: '', tipo: 'CAJA', saldoInicial: 0, cuentaPGC: '570' })
  }
  const abrirMov = () => {
    if (!sel) return
    setMov({ id: nuevoId(), creadoEn: new Date().toISOString(), creadoPor: 'admin', origen: 'MANUAL', cuentaId: sel.id, fecha: hoyISO(), concepto: '', importe: 0, clase: 'VENTA_EFECTIVO', conciliado: false })
  }

  const guardarMov = (magnitud: number) => {
    if (!mov) return
    const esEntrada = CLASES.find((c) => c.valor === mov.clase)?.entrada ?? true
    const importe = Math.abs(magnitud) * (esEntrada ? 1 : -1)
    guardarMovimiento({ ...mov, importe })
    setMov(null)
  }

  const abrirArqueo = () => setArqueo({ den: {}, explicacion: '', responsable: '' })
  const guardarElArqueo = () => {
    if (!sel || !arqueo) return
    const denominaciones: Denominacion[] = DENOMINACIONES_EUR.map((valor) => ({ valor, cantidad: arqueo.den[valor] ?? 0 })).filter((d) => d.cantidad > 0)
    const r = evaluarArqueo(denominaciones, saldo, config.umbrales.descuadreCajaTolerado)
    if (r.requiereExplicacion && arqueo.explicacion.trim() === '') return
    const a: ArqueoCaja = {
      id: nuevoId(), creadoEn: new Date().toISOString(), creadoPor: 'admin', origen: 'MANUAL',
      cuentaId: sel.id, fecha: hoyISO(), denominaciones, saldoTeorico: saldo, saldoContado: r.saldoContado,
      diferencia: r.diferencia, explicacion: arqueo.explicacion || undefined, responsable: arqueo.responsable || undefined,
    }
    guardarArqueo(a)
    // Ajuste de caja por la diferencia (deja la caja cuadrada con lo contado).
    if (r.diferencia !== 0) {
      guardarMovimiento({ id: nuevoId(), creadoEn: new Date().toISOString(), creadoPor: 'admin', origen: 'MANUAL', cuentaId: sel.id, fecha: hoyISO(), concepto: `Ajuste por arqueo (${r.diferencia > 0 ? 'sobrante' : 'faltante'})`, importe: r.diferencia, clase: 'OTRO', conciliado: false })
    }
    setArqueo(null)
  }

  if (cajas.length === 0) {
    return (
      <>
        <div className="flex items-start justify-between gap-4 mb-6">
          <CabeceraPantalla titulo="Caja y arqueos" descripcion="Una caja por punto de venta y caja central, con arqueo por denominación." />
          <Boton onClick={crearCaja}>+ Nueva caja</Boton>
        </div>
        <Tarjeta><EstadoVacio icono="caja" titulo="Aún no hay cajas" descripcion="Crea una caja por punto de venta y una caja central. Controlarás entradas y salidas de efectivo y harás arqueos con desglose por billetes y monedas." accion={<Boton onClick={crearCaja}>Crear la primera</Boton>} /></Tarjeta>
        {nuevaCaja && <ModalCaja caja={nuevaCaja} setCaja={setNuevaCaja} onGuardar={(c) => { guardarCuenta(c); setSelId(c.id); setNuevaCaja(null) }} puntos={config.centrosCoste.filter((x) => x.tipo === 'PUNTO_VENTA')} />}
      </>
    )
  }

  const arqueoEval = arqueo ? evaluarArqueo(DENOMINACIONES_EUR.map((v) => ({ valor: v, cantidad: arqueo.den[v] ?? 0 })), saldo, config.umbrales.descuadreCajaTolerado) : null

  return (
    <>
      <div className="flex items-start justify-between gap-4 mb-6">
        <CabeceraPantalla titulo="Caja y arqueos" descripcion="Movimientos de efectivo y arqueo por denominación con control de descuadres." />
        <Boton onClick={crearCaja}>+ Nueva caja</Boton>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {cajas.map((c) => (
          <button key={c.id} onClick={() => setSelId(c.id)} className="rounded-xl px-3 py-2 text-sm" style={{ background: c.id === sel?.id ? 'var(--color-brand-500)' : 'var(--surface)', color: c.id === sel?.id ? '#fff' : 'var(--text)', border: '1px solid var(--border)' }}>
            {c.nombre}
          </button>
        ))}
      </div>

      {sel && (
        <>
          <div className="grid sm:grid-cols-3 gap-3 mb-4">
            <Tarjeta className="!p-4"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Saldo actual</div><div className="text-xl font-semibold"><ImporteEuro valor={saldo} color /></div></Tarjeta>
            <Tarjeta className="!p-4 flex items-center"><Boton onClick={abrirMov}>+ Movimiento</Boton></Tarjeta>
            <Tarjeta className="!p-4 flex items-center"><Boton variante="secundario" onClick={abrirArqueo}>Hacer arqueo</Boton></Tarjeta>
          </div>

          <Tarjeta className="!p-0 overflow-hidden">
            {movs.length === 0 ? (
              <div className="p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Sin movimientos en esta caja.</div>
            ) : (
              <table className="w-full text-sm">
                <thead><tr style={{ color: 'var(--text-muted)' }} className="text-left"><th className="px-4 py-2.5 font-medium">Fecha</th><th className="px-4 py-2.5 font-medium">Concepto</th><th className="px-4 py-2.5 font-medium text-right">Importe</th><th className="px-4 py-2.5"></th></tr></thead>
                <tbody>
                  {movs.map((m) => (
                    <tr key={m.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                      <td className="px-4 py-2.5 tabular">{formatearFecha(m.fecha)}</td>
                      <td className="px-4 py-2.5">{m.concepto || CLASES.find((c) => c.valor === m.clase)?.texto}</td>
                      <td className="px-4 py-2.5 text-right"><ImporteEuro valor={m.importe} color /></td>
                      <td className="px-4 py-2.5 text-right"><button className="underline text-xs" style={{ color: 'var(--neg)' }} onClick={() => anularMovimiento(m.id)}>Anular</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Tarjeta>
        </>
      )}

      {nuevaCaja && <ModalCaja caja={nuevaCaja} setCaja={setNuevaCaja} onGuardar={(c) => { guardarCuenta(c); setSelId(c.id); setNuevaCaja(null) }} puntos={config.centrosCoste.filter((x) => x.tipo === 'PUNTO_VENTA')} />}

      {mov && <ModalMovimiento mov={mov} setMov={setMov} onGuardar={guardarMov} />}

      {arqueo && arqueoEval && (
        <Modal titulo="Arqueo de caja" onCerrar={() => setArqueo(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {DENOMINACIONES_EUR.map((v) => (
                <label key={v} className="flex items-center gap-2">
                  <span className="w-16 text-sm tabular text-right" style={{ color: 'var(--text-muted)' }}>{formatearEuro(v)}</span>
                  <input type="number" min="0" value={arqueo.den[v] || ''} placeholder="0" className="w-full rounded-lg px-2 py-1 text-sm tabular" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }} onChange={(e) => setArqueo({ ...arqueo, den: { ...arqueo.den, [v]: Number(e.target.value) } })} />
                </label>
              ))}
            </div>
            <div className="rounded-xl p-3 text-sm space-y-1" style={{ background: 'var(--surface-2)' }}>
              <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Contado</span><span className="tabular font-medium">{formatearEuro(totalArqueo(DENOMINACIONES_EUR.map((v) => ({ valor: v, cantidad: arqueo.den[v] ?? 0 }))))}</span></div>
              <div className="flex justify-between"><span style={{ color: 'var(--text-muted)' }}>Teórico</span><span className="tabular">{formatearEuro(saldo)}</span></div>
              <div className="flex justify-between items-center pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Diferencia</span>
                {arqueoEval.diferencia === 0 ? <Semaforo estado="positivo" texto="Cuadra" /> : <Semaforo estado={arqueoEval.superaUmbral ? 'negativo' : 'atencion'} texto={`${arqueoEval.diferencia > 0 ? 'Sobra' : 'Falta'} ${formatearEuro(Math.abs(arqueoEval.diferencia))}`} />}
              </div>
            </div>
            {arqueoEval.requiereExplicacion && (
              <Campo etiqueta="Explicación del descuadre (obligatoria)" valor={arqueo.explicacion} onChange={(v) => setArqueo({ ...arqueo, explicacion: v })} placeholder="Motivo del descuadre" />
            )}
            <Campo etiqueta="Responsable" valor={arqueo.responsable} onChange={(v) => setArqueo({ ...arqueo, responsable: v })} />
            <div className="flex justify-end gap-2 pt-1">
              <Boton variante="secundario" onClick={() => setArqueo(null)}>Cancelar</Boton>
              <Boton onClick={guardarElArqueo}>Guardar arqueo</Boton>
            </div>
            {arqueoEval.requiereExplicacion && arqueo.explicacion.trim() === '' && <p className="text-xs text-right" style={{ color: 'var(--warn)' }}>El descuadre supera el umbral: explica el motivo.</p>}
          </div>
        </Modal>
      )}
    </>
  )
}

function ModalCaja({ caja, setCaja, onGuardar, puntos }: { caja: CuentaTesoreria; setCaja: (c: CuentaTesoreria) => void; onGuardar: (c: CuentaTesoreria) => void; puntos: { id: string; nombre: string }[] }) {
  return (
    <Modal titulo="Nueva caja" onCerrar={() => setCaja(null as any)}>
      <div className="space-y-4">
        <Campo etiqueta="Nombre" valor={caja.nombre} onChange={(v) => setCaja({ ...caja, nombre: v })} placeholder="Caja Tienda Centro" autoFocus />
        <Select etiqueta="Punto de venta (opcional)" valor={caja.centroCosteId ?? ''} onChange={(v) => setCaja({ ...caja, centroCosteId: v || undefined })} opciones={[{ valor: '', texto: 'Caja central' }, ...puntos.map((p) => ({ valor: p.id, texto: p.nombre }))]} />
        <CampoNumero etiqueta="Saldo inicial" valor={caja.saldoInicial} onChange={(v) => setCaja({ ...caja, saldoInicial: v })} sufijo="€" />
        <div className="flex justify-end gap-2 pt-1"><Boton variante="secundario" onClick={() => setCaja(null as any)}>Cancelar</Boton><Boton onClick={() => caja.nombre.trim() && onGuardar(caja)}>Crear caja</Boton></div>
      </div>
    </Modal>
  )
}

function ModalMovimiento({ mov, setMov, onGuardar }: { mov: MovimientoTesoreria; setMov: (m: MovimientoTesoreria) => void; onGuardar: (magnitud: number) => void }) {
  const [magnitud, setMagnitud] = useState(0)
  const esEntrada = CLASES.find((c) => c.valor === mov.clase)?.entrada ?? true
  return (
    <Modal titulo="Movimiento de caja" onCerrar={() => setMov(null as any)}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Select etiqueta="Tipo" valor={mov.clase} onChange={(v) => setMov({ ...mov, clase: v })} opciones={CLASES.map((c) => ({ valor: c.valor, texto: c.texto }))} />
          <Campo etiqueta="Fecha" valor={mov.fecha} onChange={(v) => setMov({ ...mov, fecha: v })} tipo="date" />
        </div>
        <Campo etiqueta="Concepto" valor={mov.concepto} onChange={(v) => setMov({ ...mov, concepto: v })} placeholder="Descripción" />
        <CampoNumero etiqueta={`Importe (${esEntrada ? 'entrada +' : 'salida −'})`} valor={magnitud} onChange={setMagnitud} sufijo="€" />
        <div className="flex justify-end gap-2 pt-1"><Boton variante="secundario" onClick={() => setMov(null as any)}>Cancelar</Boton><Boton onClick={() => onGuardar(magnitud)}>Guardar</Boton></div>
      </div>
    </Modal>
  )
}
