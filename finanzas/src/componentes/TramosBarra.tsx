/** Barra de distribución por tramos de vencimiento (aging). */
import { TRAMOS_ORDEN, ETIQUETA_TRAMO, type Tramo } from '../dominio/vencimientos'
import { formatearEuro } from '../dominio/dinero'

const COLOR: Record<Tramo, string> = {
  VENCIDO: 'var(--neg)',
  D0_30: 'var(--warn)',
  D31_60: '#c9a227',
  D61_90: '#5a9bd8',
  D90_MAS: '#0069d9',
  LARGO_PLAZO: 'var(--text-muted)',
}

export function TramosBarra({ tramos }: { tramos: Record<Tramo, number> }) {
  const total = TRAMOS_ORDEN.reduce((s, t) => s + Math.abs(tramos[t]), 0)
  return (
    <div>
      {total > 0 && (
        <div className="flex h-2.5 rounded-full overflow-hidden mb-3" style={{ background: 'var(--surface-2)' }}>
          {TRAMOS_ORDEN.map((t) => {
            const pct = total > 0 ? (Math.abs(tramos[t]) / total) * 100 : 0
            return pct > 0 ? <div key={t} style={{ width: `${pct}%`, background: COLOR[t] }} title={`${ETIQUETA_TRAMO[t]}: ${formatearEuro(tramos[t])}`} /> : null
          })}
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {TRAMOS_ORDEN.map((t) => (
          <div key={t} className="text-xs">
            <div className="flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: COLOR[t] }} />
              {ETIQUETA_TRAMO[t]}
            </div>
            <div className="tabular font-medium mt-0.5" style={{ color: t === 'VENCIDO' && tramos[t] !== 0 ? 'var(--neg)' : 'var(--text)' }}>{formatearEuro(tramos[t])}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
