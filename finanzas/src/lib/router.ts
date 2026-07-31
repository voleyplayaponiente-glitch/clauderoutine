/**
 * Router por hash, mínimo y sin dependencias. Encaja con el despliegue estático
 * en GitHub Pages (no requiere configuración de servidor).
 */
import { useSyncExternalStore } from 'react'

function rutaActual(): string {
  const h = window.location.hash.replace(/^#/, '')
  return h === '' ? '/' : h
}

function suscribir(cb: () => void): () => void {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export function useRuta(): string {
  return useSyncExternalStore(suscribir, rutaActual, () => '/')
}

export function navegar(ruta: string): void {
  window.location.hash = ruta
}
