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
import { crearZip, nombreFicheroSeguro, type EntradaZip } from '../../dominio/zip'
import { totalesCompra } from '../../dominio/compras'
import { exportarCSV, numeroCsv } from '../../lib/exportar'
import { leerAdjunto, descargarBytes } from '../../lib/adjuntos'
import { formatearFecha, nombreMes } from '../../lib/fechas'
import type { Compra, CategoriaGasto, Tercero, ID } from '../../dominio/tipos'

/** Primer y último día del mes de una fecha ISO. */
function rangoMes(aaaaMm: string): { desde: string; hasta: string } {
  const [a, m] = aaaaMm.split('-').map(Number)
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate()
  return { desde: `${aaaaMm}-01`, hasta: `${aaaaMm}-${String(ultimo).padStart(2, '0')}` }
}

export function ResumenMensual({
  compras,
  categorias,
  terceros = [],
  empresaId = '',
}: {
  compras: Compra[]
  categorias: CategoriaGasto[]
  terceros?: Tercero[]
  empresaId?: ID
}) {
  const hoy = new Date().toISOString().slice(0, 7)
  const [mes, setMes] = useState(hoy)
  const [abierto, setAbierto] = useState(false)
  const [preparando, setPreparando] = useState(false)
  const [avisoZip, setAvisoZip] = useState<string | null>(null)

  const { desde, hasta } = rangoMes(mes)
  const r = useMemo(() => resumirCompras(compras, categorias, desde, hasta), [compras, categorias, desde, hasta])

  const exportar = () => {
    const cabeceras = ['Naturaleza del gasto', 'Facturas', 'Base', 'IVA', 'IVA no deducible', 'Impuesto especial', 'Coste real']
    const filas = [
      ...r.lineas.map((l) => [
        l.categoria,
        String(l.numFacturas),
        numeroCsv(l.base),
        numeroCsv(l.cuotaIva),
        numeroCsv(l.ivaNoDeducible),
        numeroCsv(l.impuestoEspecial),
        numeroCsv(l.costeReal),
      ]),
      ['TOTAL', String(r.numFacturas), numeroCsv(r.base), numeroCsv(r.cuotaIva), numeroCsv(r.ivaNoDeducible), numeroCsv(r.impuestoEspecial), numeroCsv(r.costeReal)],
    ]
    exportarCSV(`compras-${mes}`, cabeceras, filas)
  }

  /** Compras del mes, para la carpeta de la gestoría. */
  const delMes = useMemo(
    () => compras.filter((c) => !c.anuladoEn && c.fechaFactura >= desde && c.fechaFactura <= hasta),
    [compras, desde, hasta],
  )

  /**
   * Carpeta del mes en un ZIP: el resumen y el listado en CSV, y dentro de
   * «facturas/» los PDF que se hayan archivado. Lo que no tenga documento se
   * dice en el aviso, no se calla: la gestoría necesita saber qué falta.
   */
  const carpetaGestoria = async () => {
    setPreparando(true)
    setAvisoZip(null)
    try {
      const nombreProv = (id: string) => terceros.find((t) => t.id === id)?.nombre ?? 'Proveedor'
      const csv = (cabeceras: string[], filas: string[][]) =>
        new TextEncoder().encode('\uFEFF' + [cabeceras, ...filas].map((f) => f.join(';')).join('\r\n'))

      const entradas: EntradaZip[] = [
        {
          nombre: `resumen-${mes}.csv`,
          datos: csv(
            ['Naturaleza del gasto', 'Facturas', 'Base', 'IVA', 'IVA no deducible', 'Impuesto especial', 'Coste real'],
            [
              ...r.lineas.map((l) => [l.categoria, String(l.numFacturas), numeroCsv(l.base), numeroCsv(l.cuotaIva), numeroCsv(l.ivaNoDeducible), numeroCsv(l.impuestoEspecial), numeroCsv(l.costeReal)]),
              ['TOTAL', String(r.numFacturas), numeroCsv(r.base), numeroCsv(r.cuotaIva), numeroCsv(r.ivaNoDeducible), numeroCsv(r.impuestoEspecial), numeroCsv(r.costeReal)],
            ],
          ),
        },
        {
          nombre: `listado-facturas-${mes}.csv`,
          datos: csv(
            ['Fecha', 'Proveedor', 'Nº factura', 'Base', 'IVA', 'Retención', 'Total', 'Naturaleza', 'Forma de pago', 'Documento'],
            delMes.map((c) => {
              const t = totalesCompra(c)
              return [
                formatearFecha(c.fechaFactura),
                nombreProv(c.terceroId),
                c.numFactura,
                numeroCsv(t.base),
                numeroCsv(t.cuota),
                numeroCsv(c.retencion ?? 0),
                numeroCsv(t.total),
                categorias.find((x) => x.id === c.categoriaGastoId)?.nombre ?? 'Sin clasificar',
                c.formaPago,
                c.adjuntoId ? nombreArchivo(c, nombreProv(c.terceroId)) : 'SIN DOCUMENTO',
              ]
            }),
          ),
        },
      ]

      let sinDoc = 0
      for (const c of delMes) {
        if (!c.adjuntoId) {
          sinDoc++
          continue
        }
        const a = await leerAdjunto(empresaId, c.adjuntoId)
        if (!a) {
          sinDoc++
          continue
        }
        entradas.push({ nombre: `facturas/${nombreArchivo(c, nombreProv(c.terceroId))}`, datos: new Uint8Array(a.datos) })
      }

      descargarBytes(`compras-${mes}.zip`, crearZip(entradas, new Date()), 'application/zip')
      setAvisoZip(
        sinDoc === 0
          ? `Carpeta lista: ${delMes.length} facturas con su PDF.`
          : `Carpeta lista, pero ${sinDoc} de ${delMes.length} facturas no tienen documento archivado. Salen marcadas como «SIN DOCUMENTO» en el listado.`,
      )
    } finally {
      setPreparando(false)
    }
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
        <div className="flex items-end gap-2">
          {r.numFacturas > 0 && <Boton variante="secundario" onClick={exportar}>Exportar CSV</Boton>}
          {delMes.length > 0 && (
            <Boton variante="secundario" onClick={() => { if (!preparando) void carpetaGestoria() }}>
              {preparando ? 'Preparando…' : 'Carpeta para la gestoría'}
            </Boton>
          )}
        </div>
      </div>

      {avisoZip && (
        <p className="text-xs mt-2" style={{ color: avisoZip.includes('no tienen') ? 'var(--warn)' : 'var(--text-muted)' }}>
          {avisoZip}
        </p>
      )}

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

/** Nombre del PDF dentro del zip: fecha, proveedor y nº de factura. */
function nombreArchivo(c: Compra, proveedor: string): string {
  return nombreFicheroSeguro(`${c.fechaFactura} ${proveedor} ${c.numFactura}`) + '.pdf'
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
