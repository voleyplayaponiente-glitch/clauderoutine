import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { webApi } from './web-api'
import './styles.css'

// La versión web usa la misma interfaz que la de escritorio, pero window.api
// habla con el servidor por HTTP.
window.api = webApi

function Acceso(): React.JSX.Element {
  const [estado, setEstado] = useState<'cargando' | 'login' | 'dentro'>('cargando')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const comprobar = async (): Promise<void> => {
    try {
      const r = await fetch('/api/session')
      const d = await r.json()
      setEstado(d.authed ? 'dentro' : 'login')
    } catch {
      setEstado('login')
    }
  }

  useEffect(() => {
    comprobar()
    const alSalir = (): void => setEstado('login')
    document.addEventListener('gestor-no-autenticado', alSalir)
    return () => document.removeEventListener('gestor-no-autenticado', alSalir)
  }, [])

  const entrar = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError('')
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password })
    })
    if (r.ok) {
      setPassword('')
      setEstado('dentro')
    } else {
      setError('Contraseña incorrecta.')
    }
  }

  if (estado === 'cargando') return <div className="empty">Cargando…</div>
  if (estado === 'dentro') return <App />

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <form className="card" style={{ width: 360 }} onSubmit={entrar}>
        <div className="brand" style={{ padding: '4px 0 14px' }}>⚖️ Gestor Laboral</div>
        <p className="muted" style={{ marginTop: 0 }}>Introduce la contraseña para acceder.</p>
        <label className="field">
          <span>Contraseña</span>
          <input type="password" value={password} autoFocus onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="err-text" style={{ marginTop: 8 }}>{error}</p>}
        <button className="btn primary" style={{ marginTop: 14, width: '100%' }} type="submit">
          Entrar
        </button>
      </form>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Acceso />
  </React.StrictMode>
)
