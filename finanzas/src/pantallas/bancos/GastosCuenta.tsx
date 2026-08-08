/**
 * De dónde vienen los cargos de una cuenta bancaria.
 *
 * Responde a la pregunta práctica: «este mes el banco me ha quitado X, ¿por
 * qué?». Los conceptos del banco son los que **no llevan factura** (comisiones,
 * seguros, tributos); la naturaleza del gasto de las facturas vive en Compras.
 * Cada concepto dice qué hace en el presupuesto: gasto, inversión, pago de
 * impuestos o deuda, o nada porque ya está contado en Compras o en Deudas. Lo
 * que aún no está clasificado se enseña en rojo: sin clasificar no hay control.
 */
import { useMemo, useState } from 'react'
import { Tarjeta, Boton, ImporteEuro, formatearEuro } from '../../componentes/ui'
import { Select } from '../../componentes/formularios'
import { gastosCuentaPorCategoria, type EfectoPresupuesto } from '../../dominio/resumen-compras'
import { exportarCSV } from '../../lib/exportar'
import type { MovimientoTesoreria, CategoriaGasto } from '../../dominio/tipos'

/** Periodos que se pueden mirar: el año entero o un mes suelto. */
function rango(ejercicio: number, mes: string): { desde: string; hasta: string } {
  if (mes === 'todo') return { desde: `${ejercicio}-01-01`, hasta: `${ejercicio}-12-31` }
  const m = Number(mes)
  const ultimo = new Date(Date.UTC(ejercicio, m, 0)).getUTCDate()
  const mm = String(m).padStart(2, '0')
  return { desde: `${ejercicio}-${mm}-01`, hasta: `${ejercicio}-${mm}-${ultimo}` }
}

/** Qué hace cada concepto cuando se lleva al presupuesto. */
const ETIQUETA_EFECTO: Record<EfectoPresupuesto, string> = {
  GASTO: 'Gasto',
  INVERSION: 'Inversión (no es gasto)',
  FINANCIACION: 'Pago de impuestos o deuda',
  NINGUNO: 'Ya contado en Compras o Deudas',
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export function GastosCuenta({
  movimientos,
  categorias,
  nombreCuenta,
}: {
  movimientos: MovimientoTesoreria[]
  categorias: CategoriaGasto[]
  nombreCuenta: string
}) {
  const hoy = new Date()
  const [ejercicio, setEjercicio] = useState(hoy.getFullYear())
  const [mes, setMes] = useState('todo')
  const [abierto, setAbierto] = useState(false)

  const anios = useMemo(() => {
    const s = new Set<number>([hoy.getFullYear()])
    for (const m of movimientos) if (m.fecha.length >= 4) s.add(Number(m.fecha.slice(0, 4)))
    return [...s].filter((a) => a > 1990 && a < 2200).sort((a, b) => b - a)
  }, [movimientos, hoy])

  const { desde, hasta } = rango(ejercicio, mes)
  const d = useMemo(
    () => gastosCuentaPorCategoria(movimientos, categorias, desde, hasta),
    [movimientos, categorias, desde, hasta],
  )

  const exportar = () => {
    exportarCSV(
      `gastos-${nombreCuenta}-${ejercicio}${mes === 'todo' ? '' : `-${mes}`}`,
      ['Concepto', 'En el presupuesto', 'Movimientos', 'Importe'],
      [
        ...d.lineas.map((l) => [l.categoria, ETIQUETA_EFECTO[l.efecto], String(l.numMovimientos), l.total.toFixed(2)]),
        ['TOTAL', '', '', d.total.toFixed(2)],
      ],
    )
  }

  return (
    <Tarjeta className="mb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-semibold">Cargos de la cuenta: de dónde vienen</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Aquí van los conceptos que <strong>no llevan factura</strong>: comisiones, seguros, tributos, inversiones. La
            naturaleza del gasto de las facturas está en Compras. Lo que va al presupuesto entra con «Traer deuda y gastos del
            banco».
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="w-28">
            <Select etiqueta="" valor={String(ejercicio)} onChange={(v) => setEjercicio(Number(v))} opciones={anios.map((a) => ({ valor: String(a), texto: String(a) }))} />
          </div>
          <div className="w-36">
            <Select
              etiqueta=""
              valor={mes}
              onChange={setMes}
              opciones={[{ valor: 'todo', texto: 'Todo el año' }, ...MESES.map((m, i) => ({ valor: String(i + 1), texto: m }))]}
            />
          </div>
          {d.lineas.length > 0 && <Boton variante="secundario" onClick={exportar}>Exportar CSV</Boton>}
        </div>
      </div>

      {d.lineas.length === 0 ? (
        <p className="text-sm mt-3" style={{ color: 'var(--text-muted)' }}>No hay salidas registradas en este periodo.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
            <Metrica etiqueta="Total salidas" valor={d.total} destacado />
            <Metrica etiqueta="Gasto" valor={d.totalGasto} />
            <Metrica etiqueta="Inversión" valor={d.totalInversion} />
            <Metrica etiqueta="Impuestos y deuda" valor={d.totalFinanciacion} />
            <Metrica etiqueta="Ya contado" valor={d.totalYaContabilizado} />
            <Metrica etiqueta="Sin clasificar" valor={d.totalSinClasificar} alerta={d.totalSinClasificar > 0} />
          </div>

          {d.totalInversion > 0 && (
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              La inversión no resta del resultado: el dinero se cambia por un activo. Clasificar aquí el cargo <strong>no</strong>{' '}
              da de alta la inversión — regístrala en <em>Inversiones</em>, que es donde se lleva el coste, el valor y su asiento.
            </p>
          )}

          {d.numSinClasificar > 0 && (
            <p className="text-xs mt-2" style={{ color: 'var(--warn)' }}>
              {d.numSinClasificar} movimientos sin concepto asignado. Ponles uno en la columna «Concepto» de la tabla para que
              entren donde toca.
            </p>
          )}

          <button className="text-sm underline mt-3" style={{ color: 'var(--color-brand-500)' }} onClick={() => setAbierto((v) => !v)}>
            {abierto ? 'Ocultar desglose' : 'Ver desglose por concepto'}
          </button>

          {abierto && (
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: 'var(--text-muted)' }} className="text-left">
                    <th className="py-2 pr-3 font-medium">Concepto</th>
                    <th className="py-2 pr-3 font-medium">En el presupuesto</th>
                    <th className="py-2 pr-3 font-medium text-right">Movs.</th>
                    <th className="py-2 font-medium text-right">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {d.lineas.map((l) => (
                    <tr key={l.categoriaId} className="border-t" style={{ borderColor: 'var(--border)' }}>
                      <td className="py-2 pr-3" style={{ color: l.categoriaId === 'sin-clasificar' ? 'var(--warn)' : undefined }}>
                        {l.categoria}
                      </td>
                      <td className="py-2 pr-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {ETIQUETA_EFECTO[l.efecto]}
                      </td>
                      <td className="py-2 pr-3 text-right tabular">{l.numMovimientos}</td>
                      <td className="py-2 text-right"><ImporteEuro valor={l.total} /></td>
                    </tr>
                  ))}
                  <tr className="border-t font-semibold" style={{ borderColor: 'var(--border)' }}>
                    <td className="py-2 pr-3" colSpan={3}>Total</td>
                    <td className="py-2 text-right tabular">{formatearEuro(d.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Tarjeta>
  )
}

function Metrica({ etiqueta, valor, destacado, alerta }: { etiqueta: string; valor: number; destacado?: boolean; alerta?: boolean }) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
      <div className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>{etiqueta}</div>
      <div className={`mt-1 tabular font-semibold ${destacado ? 'text-lg' : ''}`} style={{ color: alerta ? 'var(--warn)' : undefined }}>
        {formatearEuro(valor)}
      </div>
    </div>
  )
}
