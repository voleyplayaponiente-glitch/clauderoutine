/**
 * ¿Hay una versión nueva de la app publicada?
 *
 * Tras actualizar en el Umbrel, el navegador seguía enseñando la versión vieja
 * hasta recargar, y parecía que nada se había arreglado. Aquí se compara el
 * script principal que está cargado con el que enlaza AHORA el `index.html` del
 * servidor (que se sirve sin caché). Si no coinciden, hay versión nueva.
 *
 * No depende del service worker: en `http://` de red local el navegador ni
 * siquiera lo activa.
 */

/** Nombre del script principal (`index-XXXX.js`) que enlaza un HTML. */
export function scriptPrincipal(html: string): string | undefined {
  return /<script[^>]+type="module"[^>]+src="[^"]*?(index-[\w-]+\.js)"/.exec(html)?.[1]
    ?? /<script[^>]+src="[^"]*?(index-[\w-]+\.js)"[^>]*type="module"/.exec(html)?.[1]
}

/** Script principal de la página cargada; undefined en desarrollo. */
export function scriptCargado(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const src = document.querySelector<HTMLScriptElement>('script[type="module"][src*="index-"]')?.getAttribute('src') ?? ''
  return /(index-[\w-]+\.js)/.exec(src)?.[1]
}

export async function hayVersionNueva(): Promise<boolean> {
  const actual = scriptCargado()
  if (!actual) return false
  try {
    const res = await fetch(`./index.html?comprobar=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return false
    const publicado = scriptPrincipal(await res.text())
    return publicado !== undefined && publicado !== actual
  } catch {
    return false // sin conexión: nada que decir
  }
}
