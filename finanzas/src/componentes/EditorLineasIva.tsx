/** Editor de líneas de IVA reutilizable (ventas y compras). Calcula la cuota. */
import { desdeBase } from '../dominio/iva'
import { formatearEuro } from '../dominio/dinero'
import { baseTotal, cuotaTotal } from '../dominio/ventas'
import type { LineaIva, TipoIva } from '../dominio/tipos'

export function EditorLineasIva({
  lineas,
  tiposIva,
  onChange,
}: {
  lineas: LineaIva[]
  tiposIva: TipoIva[]
  onChange: (l: LineaIva[]) => void
}) {
  const recalc = (base: number, tipoIvaId: string): LineaIva => {
    const t = tiposIva.find((x) => x.id === tipoIvaId) ?? tiposIva[0]
    const d = desdeBase(base, t.tipo, t.regimen)
    return { base: d.base, tipoIvaId: t.id, tipo: t.tipo, regimen: t.regimen, cuota: d.cuota }
  }
  const añadir = () => onChange([...lineas, recalc(0, tiposIva[0]?.id ?? '')])
  const editar = (i: number, base: number, tipoIvaId: string) => {
    const copia = lineas.slice()
    copia[i] = recalc(base, tipoIvaId)
    onChange(copia)
  }
  const quitar = (i: number) => onChange(lineas.filter((_, j) => j !== i))

  const inputStyle = { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' } as const

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Base imponible por tipo de IVA</span>
        <button type="button" className="text-xs underline" style={{ color: 'var(--color-brand-500)' }} onClick={añadir}>+ Añadir línea</button>
      </div>
      <div className="space-y-2">
        {lineas.map((l, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="number" step="0.01" value={l.base || ''} placeholder="Base"
              className="w-32 rounded-lg px-2.5 py-1.5 text-sm tabular" style={inputStyle}
              onChange={(e) => editar(i, Number(e.target.value), l.tipoIvaId)}
            />
            <select
              value={l.tipoIvaId} className="flex-1 rounded-lg px-2.5 py-1.5 text-sm" style={inputStyle}
              onChange={(e) => editar(i, l.base, e.target.value)}
            >
              {tiposIva.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
            <span className="w-24 text-right text-sm tabular" style={{ color: 'var(--text-muted)' }}>{formatearEuro(l.cuota)}</span>
            <button type="button" className="text-xs px-1" style={{ color: 'var(--neg)' }} onClick={() => quitar(i)} aria-label="Quitar línea">✕</button>
          </div>
        ))}
        {lineas.length === 0 && (
          <button type="button" onClick={añadir} className="w-full py-2 rounded-lg text-sm" style={{ border: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
            + Añadir la primera línea
          </button>
        )}
      </div>
      {lineas.length > 0 && (
        <div className="flex justify-end gap-6 mt-2 text-sm">
          <span style={{ color: 'var(--text-muted)' }}>Base <span className="tabular font-medium" style={{ color: 'var(--text)' }}>{formatearEuro(baseTotal(lineas))}</span></span>
          <span style={{ color: 'var(--text-muted)' }}>IVA <span className="tabular font-medium" style={{ color: 'var(--text)' }}>{formatearEuro(cuotaTotal(lineas))}</span></span>
        </div>
      )}
    </div>
  )
}
