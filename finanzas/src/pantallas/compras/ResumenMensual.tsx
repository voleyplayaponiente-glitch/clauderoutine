/**
 * Resumen de compras del periodo, agrupado por naturaleza del gasto.
 *
 * Muestra el **coste real**, que no es la base: incluye el IVA que no se puede
 * deducir y el impuesto especial de las compras internacionales. Es lo que de
 * verdad sale de la empresa.
 */
import { useMemo, useState } from 'react'
import { Tarjeta, Boton, ImporteEuro, formatearEuro } from '../../componentes/ui'
import { Campo } from '../../componentes/formularios'
import { resumirCompras } from '../../dominio/resumen-compras'
import { exportarCSV } from '../../lib/exportar'
import { nombreMes } from '../../lib/fechas'
import type { Compra, CategoriaGasto } from '../../dominio/tipos'

/** Primer y último día del mes de una fecha ISO. */
function rangoMes(aaaaMm: string): { desde: string; hasta: string } {
  const [a, m] = aaaaMm.split('-').map(Number)
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate()
  return { desde: `${aaaaMm}-01`, hasta: `${aaaaMm}-${String(ultimo).padStart(2, '0')}` }
}

export function ResumenMensual({ compras, categorias }: { compras: Compra[]; categorias: CategoriaGasto[] }) {
  const hoy = new Date().toISOString().slice(0, 7)
  const [mes, setMes] = useState(hoy)
  const [abierto, setAbierto] = useState(false)

  const { desde, hasta } = rangoMes(mes)
  const r = useMemo(() => resumirCompras(compras, categorias, desde, hasta), [compras, categorias, desde, hasta])

  const exportar = () => {
    const cabeceras = ['Naturaleza del gasto', 'Facturas', 'Base', 'IVA', 'IVA no deducible', 'Impuesto especial', 'Coste real']
    const filas = [
      ...r.lineas.map((l) => [
        l.categoria,
        String(l.numFacturas),
        l.base.toFixed(2),
        l.cuotaIva.toFixed(2),
        l.ivaNoDeducible.toFixed(2),
        l.impuestoEspecial.toFixed(2),
        l.costeReal.toFixed(2),
      ]),
      ['TOTAL', String(r.numFacturas), r.base.toFixed(2), r.cuotaIva.toFixed(2), r.ivaNoDeducible.toFixed(2), r.impuestoEspecial.toFixed(2), r.costeReal.toFixed(2)],
    ]
    exportarCSV(`compras-${mes}`, cabeceras, filas)
  }

  return (
    <Tarjeta className="mb-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-end gap-3">
          <div className="w-44">
            <Campo etiqueta="Resumen del mes" tipo="month" valor={mes} onChange={setMes} />
          </div>
          <button className="text-sm underline pb-2" style={{ color: 'var(--color-brand-500)' }} onClick={() => setAbierto((v) => !v)}>
            {abierto ? 'Ocultar detalle' : 'Ver detalle por naturaleza'}
          </button>
        </div>
        {r.numFacturas > 0 && <Boton variante="secundario" onClick={exportar}>Exportar CSV</Boton>}
      </div>

      {r.numFacturas === 0 ? (
        <p className="text-sm mt-3" style={{ color: 'var(--text-muted)' }}>
          No hay compras registradas en {nombreMes(mes)}.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
            <Metrica etiqueta="Coste real" valor={r.costeReal} destacado />
            <Metrica etiqueta="Stock" valor={r.costeStock} />
            <Metrica etiqueta="Estructura" valor={r.costeEstructura} />
            <Metrica etiqueta="IVA deducible" valor={r.ivaDeducible} />
            <Metrica etiqueta="Impuesto especial" valor={r.impuestoEspecial} />
          </div>

          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            {r.numFacturas} facturas · base {formatearEuro(r.base)}
            {r.ivaNoDeducible > 0 && ` · ${formatearEuro(r.ivaNoDeducible)} de IVA no deducible, que es más gasto`}
          </p>

          {abierto && (
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: 'var(--text-muted)' }} className="text-left">
                    <th className="py-2 pr-3 font-medium">Naturaleza del gasto</th>
                    <th className="py-2 pr-3 font-medium text-right">Fras.</th>
                    <th className="py-2 pr-3 font-medium text-right">Base</th>
                    <th className="py-2 pr-3 font-medium text-right">IVA</th>
                    <th className="py-2 pr-3 font-medium text-right">IVA no ded.</th>
                    <th className="py-2 pr-3 font-medium text-right">Imp. especial</th>
                    <th className="py-2 font-medium text-right">Coste real</th>
                  </tr>
                </thead>
                <tbody>
                  {r.lineas.map((l) => (
                    <tr key={l.categoriaId} className="border-t" style={{ borderColor: 'var(--border)' }}>
                      <td className="py-2 pr-3">
                        {l.categoria}
                        {l.categoriaId === 'sin-categoria' && (
                          <span className="ml-2 text-xs" style={{ color: 'var(--warn)' }}>clasifícalas</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right tabular">{l.numFacturas}</td>
                      <td className="py-2 pr-3 text-right"><ImporteEuro valor={l.base} /></td>
                      <td className="py-2 pr-3 text-right"><ImporteEuro valor={l.cuotaIva} /></td>
                      <td className="py-2 pr-3 text-right">
                        {l.ivaNoDeducible > 0 ? <span style={{ color: 'var(--warn)' }}><ImporteEuro valor={l.ivaNoDeducible} /></span> : '—'}
                      </td>
                      <td className="py-2 pr-3 text-right">{l.impuestoEspecial > 0 ? <ImporteEuro valor={l.impuestoEspecial} /> : '—'}</td>
                      <td className="py-2 text-right font-medium"><ImporteEuro valor={l.costeReal} /></td>
                    </tr>
                  ))}
                  <tr className="border-t font-semibold" style={{ borderColor: 'var(--border)' }}>
                    <td className="py-2 pr-3">Total</td>
                    <td className="py-2 pr-3 text-right tabular">{r.numFacturas}</td>
                    <td className="py-2 pr-3 text-right tabular">{formatearEuro(r.base)}</td>
                    <td className="py-2 pr-3 text-right tabular">{formatearEuro(r.cuotaIva)}</td>
                    <td className="py-2 pr-3 text-right tabular">{formatearEuro(r.ivaNoDeducible)}</td>
                    <td className="py-2 pr-3 text-right tabular">{formatearEuro(r.impuestoEspecial)}</td>
                    <td className="py-2 text-right tabular">{formatearEuro(r.costeReal)}</td>
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

function Metrica({ etiqueta, valor, destacado }: { etiqueta: string; valor: number; destacado?: boolean }) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--surface-2)' }}>
      <div className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-muted)' }}>
        {etiqueta}
      </div>
      <div className={`mt-1 tabular font-semibold ${destacado ? 'text-lg' : ''}`}>{formatearEuro(valor)}</div>
    </div>
  )
}
