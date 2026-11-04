import { useEffect, useState } from 'react'
import { hayVersionNueva } from '../lib/version'
import { guardarTodoYa } from '../store/store'

/**
 * Franja «Hay una versión nueva» con su botón. No recarga sola: podría pillar
 * un formulario a medio rellenar. Antes de recargar se guarda todo lo pendiente.
 */
export function AvisoVersion() {
  const [nueva, setNueva] = useState(false)
  const [recargando, setRecargando] = useState(false)

  useEffect(() => {
    let vivo = true
    const comprobar = () => {
      void hayVersionNueva().then((v) => {
        if (vivo && v) setNueva(true)
      })
    }
    comprobar()
    const intervalo = setInterval(comprobar, 10 * 60_000)
    const alVolver = () => {
      if (document.visibilityState === 'visible') comprobar()
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      vivo = false
      clearInterval(intervalo)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [])

  if (!nueva) return null

  const recargar = async () => {
    setRecargando(true)
    await guardarTodoYa()
    try {
      const reg = await navigator.serviceWorker?.getRegistration()
      await reg?.update()
    } catch {
      /* sin service worker (http en red local): basta con recargar */
    }
    location.reload()
  }

  return (
    <div
      role="status"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl px-4 py-3 shadow-lg text-sm max-w-[calc(100vw-2rem)]"
      style={{ background: 'var(--accent, #0a84ff)', color: '#fff' }}
    >
      <span>Hay una versión nueva de la app.</span>
      <button onClick={() => void recargar()} disabled={recargando} className="rounded-xl px-3 py-1 font-semibold" style={{ background: '#fff', color: '#0a84ff' }}>
        {recargando ? 'Guardando…' : 'Actualizar ahora'}
      </button>
    </div>
  )
}
