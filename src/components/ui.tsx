import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { IconWarning } from './icons'

export function Card({ children, className = '', style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`card p-5 ${className}`} style={style}>
      {children}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-muted mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Field({
  label,
  children,
  hint,
  error,
}: {
  label?: string
  children: ReactNode
  hint?: string
  error?: string
}) {
  return (
    <label className="flex flex-col gap-1.5">
      {label && <span>{label}</span>}
      {children}
      {hint && !error && <span className="text-xs text-muted font-normal">{hint}</span>}
      {error && <span className="text-xs font-normal" style={{ color: '#ff3b30' }}>{error}</span>}
    </label>
  )
}

export function Select({
  value,
  onChange,
  options,
  className = '',
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  className?: string
}) {
  return (
    <select className={`input ${className}`} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3"
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
    >
      <span
        style={{
          width: 46,
          height: 28,
          borderRadius: 999,
          background: checked ? 'var(--color-brand-500)' : 'var(--border)',
          position: 'relative',
          transition: 'background .2s',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: checked ? 21 : 3,
            width: 22,
            height: 22,
            borderRadius: 999,
            background: '#fff',
            transition: 'left .2s',
            boxShadow: '0 1px 3px rgba(0,0,0,.3)',
          }}
        />
      </span>
      {label && <span className="text-sm font-medium">{label}</span>}
    </button>
  )
}

export function EmptyState({ icon, title, message, action }: { icon?: ReactNode; title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="card p-10 text-center flex flex-col items-center gap-3">
      {icon && <div className="text-muted opacity-60">{icon}</div>}
      <h3 className="text-lg font-semibold">{title}</h3>
      {message && <p className="text-muted max-w-md">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  wide?: boolean
}) {
  if (!open) return null
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: '100%', maxWidth: wide ? 720 : 480, maxHeight: '90vh', overflow: 'auto', padding: 24 }}
      >
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        {children}
      </div>
    </div>
  )
}

// ---- Confirm dialog via context ----
interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}
const ConfirmCtx = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false)
export const useConfirm = () => useContext(ConfirmCtx)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null)
  const confirm = useCallback((o: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => setState({ ...o, resolve }))
  }, [])
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <Modal open onClose={() => { state.resolve(false); setState(null) }} title={state.title}>
          <div className="flex items-start gap-3 mb-5">
            {state.danger && <IconWarning size={28} className="text-muted" />}
            <p className="text-muted">{state.message}</p>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => { state.resolve(false); setState(null) }}>
              Cancelar
            </button>
            <button
              className={`btn ${state.danger ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => { state.resolve(true); setState(null) }}
            >
              {state.confirmLabel ?? 'Confirmar'}
            </button>
          </div>
        </Modal>
      )}
    </ConfirmCtx.Provider>
  )
}

// ---- Toast ----
const ToastCtx = createContext<(msg: string) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([])
  const show = useCallback((msg: string) => {
    const id = Math.floor(Math.random() * 1e9)
    setToasts((t) => [...t, { id, msg }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000)
  }, [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {toasts.map((t) => (
          <div key={t.id} className="card" style={{ padding: '10px 18px', fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,.2)' }}>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
