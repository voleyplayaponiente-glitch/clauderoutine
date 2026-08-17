/** Componentes de UI reutilizables. Estilo Apple: tarjetas, mucho aire, sutil. */
import type { ReactNode } from 'react'
import { formatearEuro } from '../dominio/dinero'
import { Icono } from './Icono'

export function Tarjeta({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${className}`}
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {children}
    </div>
  )
}

/** Importe en € con formato español, tabular y color semántico opcional. */
export function ImporteEuro({
  valor,
  color = false,
  className = '',
}: {
  valor: number
  color?: boolean
  className?: string
}) {
  const c = !color ? undefined : valor > 0 ? 'var(--pos)' : valor < 0 ? 'var(--neg)' : undefined
  return (
    <span className={`tabular ${className}`} style={{ color: c }}>
      {formatearEuro(valor)}
    </span>
  )
}

export type Estado = 'positivo' | 'negativo' | 'atencion' | 'neutro'

/** Semáforo: nunca solo color, siempre con texto (accesibilidad). */
export function Semaforo({ estado, texto }: { estado: Estado; texto: string }) {
  const mapa: Record<Estado, { bg: string; fg: string; punto: string }> = {
    positivo: { bg: 'rgba(48,209,88,.14)', fg: 'var(--pos)', punto: 'var(--pos)' },
    negativo: { bg: 'rgba(255,69,58,.14)', fg: 'var(--neg)', punto: 'var(--neg)' },
    atencion: { bg: 'rgba(255,159,10,.16)', fg: 'var(--warn)', punto: 'var(--warn)' },
    neutro: { bg: 'var(--surface-2)', fg: 'var(--text-muted)', punto: 'var(--text-muted)' },
  }
  const c = mapa[estado]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ background: c.bg, color: c.fg }}
    >
      <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: c.punto }} />
      {texto}
    </span>
  )
}

/** Estado vacío cuidado: explica qué es el módulo y ofrece empezar. */
export function EstadoVacio({
  icono,
  titulo,
  descripcion,
  accion,
}: {
  icono: string
  titulo: string
  descripcion: string
  accion?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div
        className="flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
        style={{ background: 'var(--surface-2)', color: 'var(--color-brand-500)' }}
      >
        <Icono nombre={icono} className="w-8 h-8" />
      </div>
      <h2 className="text-lg font-semibold mb-2">{titulo}</h2>
      <p className="max-w-md text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        {descripcion}
      </p>
      {accion && <div className="mt-6">{accion}</div>}
    </div>
  )
}

export function Boton({
  children,
  onClick,
  variante = 'primario',
  tipo = 'button',
  disabled = false,
}: {
  children: ReactNode
  onClick?: () => void
  variante?: 'primario' | 'secundario'
  tipo?: 'button' | 'submit'
  /** Deshabilitado: se atenúa y deja de responder, sin desaparecer. */
  disabled?: boolean
}) {
  const base = 'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors'
  const estilo =
    variante === 'primario'
      ? { background: 'var(--color-brand-500)', color: '#fff' }
      : { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }
  return (
    <button
      type={tipo}
      onClick={onClick}
      disabled={disabled}
      className={base}
      style={{ ...estilo, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      {children}
    </button>
  )
}

/** Esqueleto de carga (no ruedas girando). */
export function Esqueleto({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`esqueleto rounded-md ${className}`} />
}

export { formatearEuro }
