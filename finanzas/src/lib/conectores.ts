/**
 * Transporte de los conectores: obtiene datos según el modo de conexión.
 *  · DEMO        → datos simulados (sin red).
 *  · SERVIDOR    → llama a tu servidor (Umbrel), que guarda las credenciales
 *                  cifradas y hace la llamada real al tercero. El navegador solo
 *                  habla con tu servidor → las credenciales del tercero nunca
 *                  llegan al dispositivo.
 *  · DISPOSITIVO → llama directamente al tercero con el token guardado localmente
 *                  (válido para APIs que permitan CORS; muchas, como Square, no,
 *                  y en ese caso conviene el modo SERVIDOR).
 *
 * El fallo de un conector nunca bloquea la app: se captura y se registra.
 */
import { generarDemoSquare, type ResultadoSync, type MovimientoExterno } from '../dominio/conectores'
import type { Conector } from '../dominio/tipos'

function esResultado(x: unknown): x is ResultadoSync {
  return !!x && typeof x === 'object' && Array.isArray((x as ResultadoSync).movimientos)
}

/** Normaliza y valida los movimientos que llegan de un servidor externo. */
function normalizar(datos: unknown): MovimientoExterno[] {
  const arr = esResultado(datos) ? datos.movimientos : Array.isArray(datos) ? (datos as MovimientoExterno[]) : []
  return arr
    .filter((m) => m && typeof m.externalId === 'string' && typeof m.importe === 'number' && typeof m.fecha === 'string')
    .map((m) => ({ externalId: m.externalId, fecha: m.fecha.slice(0, 10), concepto: String(m.concepto ?? ''), importe: m.importe }))
}

export async function sincronizar(conector: Conector, hoyISO: string): Promise<ResultadoSync> {
  if (conector.modo === 'DEMO') {
    return generarDemoSquare(hoyISO, 5)
  }
  if (conector.modo === 'SERVIDOR') {
    if (!conector.urlServidor) throw new Error('Falta la URL del servidor')
    const url = `${conector.urlServidor.replace(/\/$/, '')}/api/sync/${conector.tipo.toLowerCase()}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${conector.secretoServidor ?? ''}` } })
    if (!res.ok) throw new Error(`El servidor respondió ${res.status}`)
    return { movimientos: normalizar(await res.json()) }
  }
  // DISPOSITIVO: llamada directa al tercero (sujeta a CORS del proveedor).
  if (!conector.token) throw new Error('Falta el token del conector')
  throw new Error('La llamada directa desde el navegador suele estar bloqueada por CORS del proveedor. Usa el modo Servidor (Umbrel) para este conector.')
}

export async function probarConexion(conector: Conector): Promise<{ ok: boolean; mensaje: string }> {
  try {
    if (conector.modo === 'DEMO') return { ok: true, mensaje: 'Conector de demostración listo.' }
    if (conector.modo === 'DISPOSITIVO') {
      return conector.token ? { ok: true, mensaje: 'Token guardado en el dispositivo.' } : { ok: false, mensaje: 'Falta el token.' }
    }
    if (!conector.urlServidor) return { ok: false, mensaje: 'Falta la URL del servidor.' }
    const url = `${conector.urlServidor.replace(/\/$/, '')}/api/estado`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${conector.secretoServidor ?? ''}` } })
    return res.ok ? { ok: true, mensaje: 'Servidor accesible.' } : { ok: false, mensaje: `El servidor respondió ${res.status}.` }
  } catch (e) {
    return { ok: false, mensaje: e instanceof Error ? e.message : 'No se pudo conectar.' }
  }
}
