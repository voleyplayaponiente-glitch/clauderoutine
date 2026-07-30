/** Controles de formulario reutilizables, con foco visible y etiquetas correctas. */
import type { ReactNode } from 'react'
import { useEffect } from 'react'

const inputBase =
  'w-full rounded-xl px-3 py-2 text-sm outline-none transition-shadow focus:ring-2'
const inputStyle = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
} as const

export function Campo({
  etiqueta,
  valor,
  onChange,
  tipo = 'text',
  placeholder,
  ayuda,
  aviso,
  autoFocus,
}: {
  etiqueta: string
  valor: string
  onChange: (v: string) => void
  tipo?: string
  placeholder?: string
  ayuda?: string
  aviso?: string
  autoFocus?: boolean
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1.5">{etiqueta}</span>
      <input
        className={inputBase}
        style={{ ...inputStyle, borderColor: aviso ? 'var(--warn)' : 'var(--border)' }}
        type={tipo}
        value={valor}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
      />
      {aviso ? (
        <span className="block text-xs mt-1" style={{ color: 'var(--warn)' }}>{aviso}</span>
      ) : ayuda ? (
        <span className="block text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{ayuda}</span>
      ) : null}
    </label>
  )
}

export function CampoNumero({
  etiqueta,
  valor,
  onChange,
  sufijo,
  ayuda,
  paso = 'any',
}: {
  etiqueta: string
  valor: number
  onChange: (v: number) => void
  sufijo?: string
  ayuda?: string
  paso?: string
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1.5">{etiqueta}</span>
      <div className="flex items-center gap-2">
        <input
          className={`${inputBase} tabular`}
          style={inputStyle}
          type="number"
          step={paso}
          value={Number.isFinite(valor) ? valor : ''}
          onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        />
        {sufijo && <span className="text-sm shrink-0" style={{ color: 'var(--text-muted)' }}>{sufijo}</span>}
      </div>
      {ayuda && <span className="block text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{ayuda}</span>}
    </label>
  )
}

export function Select<T extends string>({
  etiqueta,
  valor,
  onChange,
  opciones,
}: {
  etiqueta: string
  valor: T
  onChange: (v: T) => void
  opciones: { valor: T; texto: string }[]
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1.5">{etiqueta}</span>
      <select
        className={inputBase}
        style={inputStyle}
        value={valor}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </label>
  )
}

export function Toggle({
  etiqueta,
  valor,
  onChange,
}: {
  etiqueta: string
  valor: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!valor)}
      className="flex items-center justify-between w-full gap-4 py-1"
    >
      <span className="text-sm font-medium text-left">{etiqueta}</span>
      <span
        className="relative inline-flex h-6 w-10 shrink-0 rounded-full transition-colors"
        style={{ background: valor ? 'var(--color-brand-500)' : 'var(--border)' }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform"
          style={{ transform: valor ? 'translateX(18px)' : 'translateX(2px)' }}
        />
      </span>
    </button>
  )
}

export function Modal({
  titulo,
  children,
  onCerrar,
}: {
  titulo: string
  children: ReactNode
  onCerrar: () => void
}) {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [onCerrar])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onCerrar} />
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border p-6 shadow-xl"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <h3 className="text-lg font-semibold mb-4">{titulo}</h3>
        {children}
      </div>
    </div>
  )
}
