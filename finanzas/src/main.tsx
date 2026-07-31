import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { useStore } from './store/store'

function Root() {
  const init = useStore((s) => s.init)
  const tema = useStore((s) => s.tema)
  const densidad = useStore((s) => s.config.apariencia.densidad)

  useEffect(() => {
    void init()
  }, [init])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'oscuro')
  }, [tema])

  useEffect(() => {
    document.documentElement.classList.toggle('densidad-compacta', densidad === 'compacta')
  }, [densidad])

  return <App />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
