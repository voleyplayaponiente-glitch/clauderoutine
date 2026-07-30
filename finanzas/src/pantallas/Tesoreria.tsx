import { useMemo, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { useStore } from '../store/store'
import { CabeceraPantalla } from './Pantalla'
import { Tarjeta, Boton, EstadoVacio, Semaforo, ImporteEuro } from '../componentes/ui'
import { hoyISO, formatearFecha } from '../lib/fechas'
import { formatearEuro } from '../dominio/dinero'
import { tesoreriaTotal } from '../dominio/tesoreria'
import { existenciaTotal } from '../dominio/valoracion'
import { proyectarSaldoDiario, detectarTension } from '../dominio/prevision'
import { fondoManiobra, ratioLiquidez, periodoMedioCobro, periodoMedioPago } from '../dominio/ratios'
import { totalesCompra } from '../dominio/compras'
import { brutoVenta } from '../dominio/ventas'
import { construirFlujosPrevistos } from '../lib/flujos'
import { navegar } from '../lib/router'

const HORIZONTES = [30, 60, 90, 365]

export function Tesoreria() {
  const config = useStore((s) => s.config)
  const datos = useStore((s) => s.datos)
  const [dias, setDias] = useState(90)
  const hoy = hoyISO()

  const saldoInicial = tesoreriaTotal(datos.cuentasTesoreria.filter((c) => !c.anuladoEn), datos.movimientos)
  const flujos = useMemo(() => construirFlujosPrevistos(datos, config, hoy, dias), [datos, config, hoy, dias])
  const serie = useMemo(() => proyectarSaldoDiario(saldoInicial, flujos, hoy, dias), [saldoInicial, flujos, hoy, dias])
  const saldoMin = config.umbrales.saldoMinimoSeguridad
  const tension = detectarTension(serie, saldoMin)

  const datosGrafico = serie.map((p) => ({ fecha: p.fecha, saldo: p.saldo, bajo: p.saldo < saldoMin ? p.saldo : null }))
  const proximos = [...flujos].sort((a, b) => a.fecha.localeCompare(b.fecha)).slice(0, 12)

  // Ratios (aproximados con los datos disponibles).
  const saldoClientes = datos.deudores.filter((d) => !d.anuladoEn && d.estado !== 'INCOBRABLE').reduce((s, d) => s + d.importe, 0)
  const saldoProveedores = datos.compras.filter((c) => !c.anuladoEn && c.estadoPago !== 'PAGADA').reduce((s, c) => s + totalesCompra(c).total, 0)
  const deudaFiscal = flujos.filter((f) => f.categoria === 'impuestos').reduce((s, f) => s - f.importe, 0)
  const almacenIds = datos.almacenes.filter((a) => !a.anuladoEn).map((a) => a.id)
  const inventarioValor = datos.articulos.filter((a) => !a.anuladoEn).reduce((s, a) => s + existenciaTotal(a.id, datos.movimientosStock, almacenIds).valor, 0)
  const hace365 = (() => { const d = new Date(hoy + 'T00:00:00'); d.setDate(d.getDate() - 365); return d.toISOString().slice(0, 10) })()
  const ventasPeriodo = datos.ventas.filter((v) => !v.anuladoEn && v.fecha >= hace365).reduce((s, v) => s + brutoVenta(v), 0)
  const comprasPeriodo = datos.compras.filter((c) => !c.anuladoEn && c.fechaFactura >= hace365).reduce((s, c) => s + totalesCompra(c).total, 0)

  const activoCorriente = saldoInicial + saldoClientes + inventarioValor
  const pasivoCorriente = saldoProveedores + deudaFiscal
  const fm = fondoManiobra(activoCorriente, pasivoCorriente)
  const liq = ratioLiquidez(activoCorriente, pasivoCorriente)
  const pmc = periodoMedioCobro(saldoClientes, ventasPeriodo, 365)
  const pmp = periodoMedioPago(saldoProveedores, comprasPeriodo, 365)

  const sinDatos = datos.cuentasTesoreria.length === 0 && flujos.length === 0

  return (
    <>
      <div className="flex items-start justify-between gap-4 mb-6">
        <CabeceraPantalla titulo="Previsión de tesorería" descripcion="Saldo diario proyectado, tensión de liquidez y ratios." />
        <div className="flex gap-1">
          {HORIZONTES.map((h) => (
            <button key={h} onClick={() => setDias(h)} className="rounded-lg px-3 py-1.5 text-sm" style={{ background: dias === h ? 'var(--color-brand-500)' : 'var(--surface)', color: dias === h ? '#fff' : 'var(--text)', border: '1px solid var(--border)' }}>{h === 365 ? '12 meses' : `${h} días`}</button>
          ))}
        </div>
      </div>

      {sinDatos ? (
        <Tarjeta><EstadoVacio icono="tesoreria" titulo="Aún no hay nada que proyectar" descripcion="En cuanto tengas cuentas con saldo, compras con vencimiento, cobros de clientes o cuotas de deuda, aquí verás el saldo diario proyectado y las alertas de tensión de liquidez." accion={<Boton onClick={() => navegar('/bancos')}>Ir a Bancos</Boton>} /></Tarjeta>
      ) : (
        <div className="space-y-4">
          {tension.hayTension && (
            <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: 'rgba(255,69,58,.12)', border: '1px solid var(--neg)' }}>
              <span style={{ color: 'var(--neg)' }} className="text-lg">⚠</span>
              <div className="text-sm">
                <div className="font-semibold" style={{ color: 'var(--neg)' }}>Tensión de liquidez prevista</div>
                <div style={{ color: 'var(--text)' }}>El saldo baja del mínimo de seguridad ({formatearEuro(saldoMin)}) el {formatearFecha(tension.primerDia!)}. Mínimo proyectado: {formatearEuro(tension.saldoMinimo)} el {formatearFecha(tension.fechaMinimo!)}. Considera aplazar un pago o adelantar un cobro.</div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Tarjeta className="!p-4"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Posición hoy</div><div className="text-lg font-semibold"><ImporteEuro valor={saldoInicial} color /></div></Tarjeta>
            <Tarjeta className="!p-4"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Saldo mínimo previsto</div><div className="text-lg font-semibold" style={{ color: tension.hayTension ? 'var(--neg)' : 'var(--text)' }}><ImporteEuro valor={tension.saldoMinimo} /></div></Tarjeta>
            <Tarjeta className="!p-4"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Cobros previstos</div><div className="text-lg font-semibold"><ImporteEuro valor={flujos.filter((f) => f.importe > 0).reduce((s, f) => s + f.importe, 0)} /></div></Tarjeta>
            <Tarjeta className="!p-4"><div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Pagos previstos</div><div className="text-lg font-semibold"><ImporteEuro valor={flujos.filter((f) => f.importe < 0).reduce((s, f) => s - f.importe, 0)} /></div></Tarjeta>
          </div>

          <Tarjeta>
            <h3 className="font-semibold mb-3">Saldo diario proyectado</h3>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <AreaChart data={datosGrafico} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gSaldo" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0a84ff" stopOpacity={0.35} /><stop offset="100%" stopColor="#0a84ff" stopOpacity={0.02} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={(f) => formatearFecha(f).slice(0, 5)} interval={Math.max(0, Math.floor(serie.length / 8))} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} width={70} tickFormatter={(v) => formatearEuro(v, { conSimbolo: false, decimales: 0 })} />
                  <Tooltip formatter={(v: number) => formatearEuro(v)} labelFormatter={(f) => formatearFecha(String(f))} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }} />
                  <ReferenceLine y={saldoMin} stroke="var(--neg)" strokeDasharray="4 4" label={{ value: 'Mínimo', fontSize: 10, fill: 'var(--neg)', position: 'insideTopRight' }} />
                  <ReferenceLine y={0} stroke="var(--text-muted)" />
                  <Area type="monotone" dataKey="saldo" stroke="#0a84ff" strokeWidth={2} fill="url(#gSaldo)" />
                  <Area type="monotone" dataKey="bajo" stroke="var(--neg)" strokeWidth={2} fill="rgba(255,69,58,.18)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Tarjeta>

          <div className="grid md:grid-cols-2 gap-4">
            <Tarjeta>
              <h3 className="font-semibold mb-3">Ratios</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Ratio etiqueta="Fondo de maniobra" valor={formatearEuro(fm)} bien={fm >= 0} />
                <Ratio etiqueta="Liquidez" valor={pasivoCorriente > 0 ? liq.toFixed(2).replace('.', ',') : '—'} bien={pasivoCorriente > 0 ? liq >= 1 : undefined} />
                <Ratio etiqueta="Periodo medio de cobro" valor={`${pmc} días`} />
                <Ratio etiqueta="Periodo medio de pago" valor={`${pmp} días`} />
              </div>
              <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>El PMP considera solo deuda comercial; la deuda fiscal ({formatearEuro(deudaFiscal)}) se muestra aparte para no distorsionar el ratio.</p>
            </Tarjeta>

            <Tarjeta>
              <h3 className="font-semibold mb-3">Próximos vencimientos</h3>
              {proximos.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sin vencimientos en el horizonte.</p>
              ) : (
                <div className="space-y-1.5 text-sm">
                  {proximos.map((f, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <span className="truncate"><span className="tabular" style={{ color: 'var(--text-muted)' }}>{formatearFecha(f.fecha)}</span> · {f.concepto}</span>
                      <ImporteEuro valor={f.importe} color className="shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </Tarjeta>
          </div>
        </div>
      )}
    </>
  )
}

function Ratio({ etiqueta, valor, bien }: { etiqueta: string; valor: string; bien?: boolean }) {
  return (
    <div>
      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{etiqueta}</div>
      <div className="font-semibold tabular flex items-center gap-2" style={{ color: bien === undefined ? 'var(--text)' : bien ? 'var(--pos)' : 'var(--neg)' }}>{valor}{bien !== undefined && <Semaforo estado={bien ? 'positivo' : 'negativo'} texto={bien ? 'OK' : 'Atención'} />}</div>
    </div>
  )
}
