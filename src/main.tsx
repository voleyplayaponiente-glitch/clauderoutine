import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { useStore } from './store/store'
import { ConfirmProvider, ToastProvider } from './components/ui'

function Root() {
  const init = useStore((s) => s.init)
  const theme = useStore((s) => s.theme)
  const loaded = useStore((s) => s.loaded)

  useEffect(() => {
    void init()
  }, [init])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  if (!loaded) {
    return (
      <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
        <p className="text-muted">Cargando…</p>
      </div>
    )
  }

  return (
    <ToastProvider>
      <ConfirmProvider>
        <App />
      </ConfirmProvider>
    </ToastProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
