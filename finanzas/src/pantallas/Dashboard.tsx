import { useMemo } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Tarjeta, Boton, EstadoVacio, Semaforo, ImporteEuro } from '../componentes/ui'
import { CabeceraPantalla } from './Pantalla'
import { navegar } from '../lib/router'
import { useStore } from '../store/store'
import { hoyISO, formatearFecha } from '../lib/fechas'
import { formatearEuro, formatearPorcentaje } from '../dominio/dinero'
import { calcularDashboard } from '../lib/dashboard'
import { generarAlertas } from '../dominio/alertas'

const COLORES_CANAL = ['#0a84ff', '#30d158', '#ff9f0a', '#bf5af2', '#5ac8fa', '#ff6482']
const NIVEL = { critico: 'negativo', aviso: 'atencion', info: 'neutro' } as const

export function Dashboard() {
  const config = useStore((s) => s.config)
  const datos = useStore((s) => s.datos)
  const hoy = hoyISO()
  const servidor = useStore((s) => s.servidorCopias)
  // Solo se avisa si HAY algo que perder: en una app recién instalada el aviso
  // sería ruido, y el ruido acaba enseñando a ignorar los avisos.
  const hayAlgoQuePerder = useMemo(
    () => Object.values(datos as unknown as Record<string, unknown>).some((v) => Array.isArray(v) && v.length > 0),
    [datos],
  )
  const copiasSinServidor = hayAlgoQuePerder && !(servidor?.activo && servidor.url)
  const d = useMemo(
    () => calcularDashboard(datos, config, hoy, { copiasSinServidor }),
    [datos, config, hoy, copiasSinServidor],
  )
  const alertas = generarAlertas(d.metricas, (n) => formatearEuro(n))

  const hayDatos = datos.ventas.length > 0 || datos.cuentasTesoreria.length > 0 || datos.compras.length > 0 || datos.deudas.length > 0

  if (!hayDatos) {
    const configurada = config.empresa.razonSocial.trim() !== ''
    return (
      <>
        <CabeceraPantalla titulo="Dashboard" descripcion="¿Cómo va la empresa hoy?" />
        <Tarjeta>
          <EstadoVacio icono={configurada ? 'panel' : 'ajustes'} titulo={configurada ? 'Aún no hay movimientos que mostrar' : 'Empieza configurando tu empresa'} descripcion={configurada ? 'Registra ventas, compras y saldos y aquí verás la evolución de tesorería, las ventas por canal y el centro de alertas.' : 'Introduce los datos de tu sociedad, tus puntos de venta y tus impuestos.'} accion={<Boton onClick={() => navegar(configurada ? '/ventas' : '/configuracion')}>{configurada ? 'Registrar una venta' : 'Ir a Configuración'}</Boton>} />
        </Tarjeta>
      </>
    )
  }

  const objetivoOk = d.objetivoMes === 0 || d.ventaMes >= d.objetivoMes

  return (
    <>
      <CabeceraPantalla titulo="Dashboard" descripcion={`¿Cómo va la empresa hoy? · ${formatearFecha(hoy)}`} />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
        <Kpi titulo="Tesorería" valor={<ImporteEuro valor={d.tesoreria} color />} ruta="/bancos" />
        <Kpi titulo="Venta del mes" valor={<ImporteEuro valor={d.ventaMes} />} extra={d.objetivoMes > 0 ? <Semaforo estado={objetivoOk ? 'positivo' : 'atencion'} texto={`Obj. ${formatearEuro(d.objetivoMes, { decimales: 0 })}`} /> : undefined} ruta="/ventas" />
        <Kpi titulo="Margen bruto" valor={<span className="tabular">{formatearPorcentaje(d.margenBrutoPct)}</span>} ruta="/presupuesto" />
        <Kpi titulo="Resultado del mes" valor={<ImporteEuro valor={d.resultadoMes} color />} ruta="/presupuesto" />
        <Kpi titulo="Deuda total" valor={<ImporteEuro valor={d.deudaTotal} />} ruta="/deudas" />
        <Kpi titulo="Stock valorado" valor={<ImporteEuro valor={d.stockValorado} />} ruta="/stock" />
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <Tarjeta className="mb-4">
          <h3 className="font-semibold mb-3">Centro de alertas</h3>
          <div className="space-y-2">
            {alertas.map((a) => (
              <button key={a.id} onClick={() => navegar(a.ruta)} className="flex items-center justify-between gap-3 w-full text-left rounded-xl px-3 py-2 transition-colors" style={{ background: 'var(--surface-2)' }}>
                <div className="flex items-center gap-2.5">
                  <Semaforo estado={NIVEL[a.nivel]} texto={a.nivel === 'critico' ? 'Crítico' : a.nivel === 'aviso' ? 'Aviso' : 'Info'} />
                  <div>
                    <div className="text-sm font-medium">{a.titulo}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.detalle}</div>
                  </div>
                </div>
                <span style={{ color: 'var(--text-muted)' }}>›</span>
              </button>
            ))}
          </div>
        </Tarjeta>
      )}

      {/* Evolución de tesorería */}
      <Tarjeta className="mb-4">
        <h3 className="font-semibold mb-3">Evolución de tesorería <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>· real y proyectada</span></h3>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <LineChart data={d.serieTesoreria} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={(f) => formatearFecha(f).slice(0, 5)} interval={Math.floor(d.serieTesoreria.length / 7)} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} width={70} tickFormatter={(v) => formatearEuro(v, { conSimbolo: false, decimales: 0 })} />
              <Tooltip formatter={(v: number) => formatearEuro(v)} labelFormatter={(f) => formatearFecha(String(f))} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }} />
              <ReferenceLine y={config.umbrales.saldoMinimoSeguridad} stroke="var(--neg)" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="real" name="Real" stroke="#0a84ff" strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="proyectado" name="Proyectado" stroke="#0a84ff" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Tarjeta>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        {/* Ventas por canal */}
        <Tarjeta>
          <h3 className="font-semibold mb-3">Ventas por canal</h3>
          {d.ventasPorCanal.canales.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sin ventas registradas.</p>
          ) : (
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={d.ventasPorCanal.rows} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={(m) => m.slice(5)} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} width={60} tickFormatter={(v) => formatearEuro(v, { conSimbolo: false, decimales: 0 })} />
                  <Tooltip formatter={(v: number) => formatearEuro(v)} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {d.ventasPorCanal.canales.map((c, i) => (
                    <Bar key={c.key} dataKey={c.key} name={c.nombre} stackId="v" fill={COLORES_CANAL[i % COLORES_CANAL.length]} radius={i === d.ventasPorCanal.canales.length - 1 ? [4, 4, 0, 0] : undefined} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Tarjeta>

        {/* Ranking por tienda */}
        <Tarjeta>
          <h3 className="font-semibold mb-3">Ranking por punto de venta <span className="text-xs font-normal" style={{ color: 'var(--text-muted)' }}>· mes actual</span></h3>
          {d.ranking.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sin puntos de venta.</p>
          ) : (
            <div className="space-y-2">
              {d.ranking.map((r) => {
                const pct = r.objetivo > 0 ? Math.min(100, (r.venta / r.objetivo) * 100) : 0
                return (
                  <div key={r.nombre}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>{r.nombre}</span>
                      <span className="tabular"><ImporteEuro valor={r.venta} />{r.objetivo > 0 && <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>/ {formatearEuro(r.objetivo, { decimales: 0 })}</span>}</span>
                    </div>
                    {r.objetivo > 0 && <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}><div style={{ width: `${pct}%`, height: '100%', background: pct >= 100 ? 'var(--pos)' : pct >= 70 ? 'var(--warn)' : 'var(--neg)' }} /></div>}
                  </div>
                )
              })}
            </div>
          )}
        </Tarjeta>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Waterfall */}
        <Tarjeta>
          <h3 className="font-semibold mb-3">Resultado del mes</h3>
          <Waterfall {...d.waterfall} />
        </Tarjeta>

        {/* Vencimientos 15 días */}
        <Tarjeta>
          <h3 className="font-semibold mb-3">Vencimientos · próximos 15 días</h3>
          {d.vencimientos.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sin vencimientos en los próximos 15 días.</p>
          ) : (
            <div className="space-y-1.5 text-sm">
              {d.vencimientos.map((v, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <span className="truncate"><span className="tabular" style={{ color: 'var(--text-muted)' }}>{formatearFecha(v.fecha)}</span> · {v.concepto}</span>
                  <ImporteEuro valor={v.importe} color className="shrink-0" />
                </div>
              ))}
            </div>
          )}
        </Tarjeta>
      </div>
    </>
  )
}

function Kpi({ titulo, valor, extra, ruta }: { titulo: string; valor: React.ReactNode; extra?: React.ReactNode; ruta: string }) {
  return (
    <button onClick={() => navegar(ruta)} className="text-left">
      <Tarjeta className="!p-4 h-full hover:shadow-sm transition-shadow">
        <div className="text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>{titulo}</div>
        <div className="text-lg font-semibold">{valor}</div>
        {extra && <div className="mt-1.5">{extra}</div>}
      </Tarjeta>
    </button>
  )
}

function Waterfall({ ventas, coste, gastos, resultado }: { ventas: number; coste: number; gastos: number; resultado: number }) {
  const max = Math.max(ventas, 1)
  const barra = (label: string, valor: number, color: string, ancho: number) => (
    <div className="flex items-center gap-3">
      <span className="w-28 text-sm shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <div className="flex-1 h-5 rounded" style={{ background: 'var(--surface-2)' }}>
        <div style={{ width: `${Math.max(2, (Math.abs(ancho) / max) * 100)}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
      <span className="w-24 text-right text-sm tabular shrink-0">{formatearEuro(valor, { decimales: 0 })}</span>
    </div>
  )
  return (
    <div className="space-y-2">
      {barra('Ventas', ventas, 'var(--pos)', ventas)}
      {barra('− Coste ventas', -coste, 'var(--neg)', coste)}
      {barra('− Gastos', -gastos, 'var(--neg)', gastos)}
      <div className="pt-1 border-t" style={{ borderColor: 'var(--border)' }}>
        {barra('= Resultado', resultado, resultado >= 0 ? 'var(--color-brand-500)' : 'var(--neg)', resultado)}
      </div>
    </div>
  )
}
