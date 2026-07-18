import React, { createContext, useCallback, useContext, useState } from 'react'

// ---------------------------------------------------------------- Campo
export function Campo(props: {
  label: string
  value: string | number
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  error?: string
  required?: boolean
  list?: Array<{ value: string; label: string }>
  step?: string
}): React.JSX.Element {
  const { label, value, onChange, type = 'text', placeholder, error, required, list, step } = props
  return (
    <label className="field">
      <span>
        {label}
        {required && <span style={{ color: 'var(--err)' }}> *</span>}
      </span>
      {list ? (
        <select value={String(value)} onChange={(e) => onChange(e.target.value)}>
          {list.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          className={error ? 'err' : ''}
          type={type}
          step={step}
          value={value ?? ''}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {error && <span className="err-text">{error}</span>}
    </label>
  )
}

// ---------------------------------------------------------------- Modal
export function Modal(props: {
  title: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
  actions?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="modal-bg" onMouseDown={props.onClose}>
      <div
        className={'modal' + (props.wide ? ' wide' : '')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-title">{props.title}</div>
        {props.children}
        {props.actions && <div className="modal-actions">{props.actions}</div>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Toast + Confirm (context)
interface UI {
  toast: (msg: string) => void
  confirmar: (msg: string) => Promise<boolean>
}
const UICtx = createContext<UI>({ toast: () => {}, confirmar: async () => false })
export const useUI = (): UI => useContext(UICtx)

export function UIProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [msg, setMsg] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ msg: string; resolve: (v: boolean) => void } | null>(null)

  const toast = useCallback((m: string) => {
    setMsg(m)
    setTimeout(() => setMsg(null), 2600)
  }, [])

  const confirmar = useCallback(
    (m: string) => new Promise<boolean>((resolve) => setConfirm({ msg: m, resolve })),
    []
  )

  const cerrar = (v: boolean): void => {
    confirm?.resolve(v)
    setConfirm(null)
  }

  return (
    <UICtx.Provider value={{ toast, confirmar }}>
      {children}
      {msg && <div className="toast">{msg}</div>}
      {confirm && (
        <Modal
          title="Confirmar"
          onClose={() => cerrar(false)}
          actions={
            <>
              <button className="btn" onClick={() => cerrar(false)}>
                Cancelar
              </button>
              <button className="btn danger" onClick={() => cerrar(true)}>
                Sí, continuar
              </button>
            </>
          }
        >
          <p style={{ margin: 0 }}>{confirm.msg}</p>
        </Modal>
      )}
    </UICtx.Provider>
  )
}

// ---------------------------------------------------------------- Estado vacío
export function Vacio({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="empty">{children}</div>
}
