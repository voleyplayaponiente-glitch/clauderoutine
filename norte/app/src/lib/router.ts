import { useEffect, useState } from 'react'

/**
 * Router por hash, minúsculo y a propósito.
 *
 * Con `#/` cualquier ruta es el mismo `index.html`, así que no hace falta
 * configurar nada en el servidor ni hay 404 al recargar en una ruta profunda.
 * Es la misma decisión que en las otras dos apps del repositorio, y no ha dado
 * un solo problema.
 */
export function useRuta(): string {
  const [ruta, setRuta] = useState(() => window.location.hash.slice(1) || '/')

  useEffect(() => {
    const alCambiar = () => setRuta(window.location.hash.slice(1) || '/')
    window.addEventListener('hashchange', alCambiar)
    return () => window.removeEventListener('hashchange', alCambiar)
  }, [])

  return ruta
}

export function ir(ruta: string): void {
  window.location.hash = ruta
}
