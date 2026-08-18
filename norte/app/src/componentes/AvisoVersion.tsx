import { useEffect, useState } from 'react'
import { Boton } from './ui.js'

/**
 * «Hay una versión nueva, recarga».
 *
 * Sin esto, actualizar Norte en el Umbrel puede no notarse: el navegador sigue
 * enseñando lo de antes y **parece que el despliegue no ha servido de nada**. En
 * la app de empresa eso costó una tanda entera de mensajes.
 *
 * Va por `version.json` y **no por el service worker** a propósito. Los
 * navegadores solo dan service worker en https o localhost, y Norte se sirve por
 * `http://<ip-del-umbrel>:3012`: allí `navigator.serviceWorker` ni existe, así
 * que un aviso basado en él no saltaría nunca justo donde hace falta.
 * Comprobado en Chromium contra la IP de red antes de escribir esto.
 *
 * Y avisa en vez de recargar sola: recargar la pantalla de alguien que está
 * escribiendo un gasto le borraría lo que estaba escribiendo.
 */

/** Cada cuánto se pregunta, estando la pestaña a la vista. */
const CADA = 15 * 60 * 1000

async function versionPublicada(): Promise<string | null> {
  try {
    // `no-store` y no `no-cache`: hay que preguntarle al servidor de verdad,
    // que es justo lo que no hace una caché contenta consigo misma.
    const respuesta = await fetch('./version.json', { cache: 'no-store' })
    if (!respuesta.ok) return null
    const datos = (await respuesta.json()) as { version?: string }
    return datos.version ?? null
  } catch {
    // Sin conexión no hay nada que avisar; se reintenta a la siguiente.
    return null
  }
}

export function AvisoVersion() {
  const [hayVersionNueva, setHayVersionNueva] = useState(false)

  useEffect(() => {
    let vivo = true

    async function comprobar() {
      if (!vivo || document.hidden) return
      const publicada = await versionPublicada()
      if (vivo && publicada && publicada !== __NORTE_VERSION__) setHayVersionNueva(true)
    }

    const reloj = setInterval(comprobar, CADA)
    // Al volver a la pestaña: es cuando alguien vuelve después de actualizar el
    // servidor, y es el momento en que más se agradece el aviso.
    document.addEventListener('visibilitychange', comprobar)
    window.addEventListener('focus', comprobar)

    return () => {
      vivo = false
      clearInterval(reloj)
      document.removeEventListener('visibilitychange', comprobar)
      window.removeEventListener('focus', comprobar)
    }
  }, [])

  if (!hayVersionNueva) return null

  return (
    <div
      role="status"
      className="material animar-entrada fixed inset-x-0 bottom-0 z-50 border-t border-linea bg-sup-1/90 px-5 py-3"
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
        <p className="text-sm text-texto-1">
          Hay una versión nueva de Norte.{' '}
          <span className="text-texto-3">Recargar no toca tus datos.</span>
        </p>
        <Boton tamano="pequeno" className="ml-auto" onClick={() => window.location.reload()}>
          Recargar
        </Boton>
      </div>
    </div>
  )
}
