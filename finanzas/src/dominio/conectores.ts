/**
 * Arquitectura de conectores enchufables (parte pura y testeable): catálogo de
 * conectores y generación de datos de demostración deterministas. El transporte
 * real (token en el dispositivo o vía servidor Umbrel) vive en la capa lib.
 *
 * Cada registro externo trae un `externalId` estable para garantizar
 * idempotencia: sincronizar dos veces no duplica nada.
 */
import { aEuros, aCentimos } from './dinero'
import type { TipoConector } from './tipos'

export interface DefinicionConector {
  tipo: TipoConector
  nombre: string
  descripcion: string
  requiereToken: boolean // en modo DISPOSITIVO
  soloLectura: boolean
}

export const CONECTORES: DefinicionConector[] = [
  { tipo: 'SQUARE', nombre: 'Square', descripcion: 'Ventas, pagos, propinas, devoluciones y liquidaciones del TPV.', requiereToken: true, soloLectura: false },
  { tipo: 'BANCO_PSD2', nombre: 'Banco (PSD2 / Open Banking)', descripcion: 'Saldos y movimientos bancarios en solo lectura vía agregador.', requiereToken: true, soloLectura: true },
  { tipo: 'STRIPE', nombre: 'Stripe', descripcion: 'Cobros, comisiones y liquidaciones de la pasarela.', requiereToken: true, soloLectura: true },
  { tipo: 'SHOPIFY', nombre: 'Shopify', descripcion: 'Pedidos, cobros y stock de la tienda online.', requiereToken: true, soloLectura: false },
  { tipo: 'WOOCOMMERCE', nombre: 'WooCommerce', descripcion: 'Pedidos, cobros y stock de la tienda online.', requiereToken: true, soloLectura: false },
  { tipo: 'DEMO', nombre: 'Demostración', descripcion: 'Datos simulados para probar el flujo de sincronización sin credenciales.', requiereToken: false, soloLectura: true },
]

export function definicionConector(tipo: TipoConector): DefinicionConector {
  return CONECTORES.find((c) => c.tipo === tipo) ?? CONECTORES[CONECTORES.length - 1]
}

/**
 * El secreto del servidor viaja en la cabecera Authorization, así que solo se
 * admite HTTPS o HTTP contra la propia red local (localhost, .local o rango
 * privado). Así el secreto nunca sale en claro hacia Internet.
 */
export function urlServidorSegura(url: string | undefined): { ok: boolean; motivo?: string } {
  if (!url) return { ok: false, motivo: 'Falta la URL del servidor' }
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return { ok: false, motivo: 'La URL del servidor no es válida' }
  }
  if (u.protocol === 'https:') return { ok: true }
  if (u.protocol !== 'http:') return { ok: false, motivo: 'La URL del servidor debe empezar por https://' }
  const h = u.hostname
  const esLocal =
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '[::1]' ||
    h === '::1' ||
    h.endsWith('.local') ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  return esLocal ? { ok: true } : { ok: false, motivo: 'Sin HTTPS solo se admite un servidor de tu red local' }
}

/** Movimiento normalizado que devuelve cualquier conector de tesorería/pasarela. */
export interface MovimientoExterno {
  externalId: string
  fecha: string
  concepto: string
  importe: number // + entrada / − salida
}

export interface ResultadoSync {
  movimientos: MovimientoExterno[]
}

function restarDias(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

/**
 * Genera liquidaciones de demostración deterministas para los últimos `n` días.
 * Cada día: una liquidación de ventas (entrada) y su comisión (salida). Los
 * `externalId` son estables, así que reimportar no duplica.
 */
export function generarDemoSquare(hastaISO: string, n = 5): ResultadoSync {
  const movimientos: MovimientoExterno[] = []
  for (let i = 0; i < n; i++) {
    const fecha = restarDias(hastaISO, i)
    const bruto = aEuros(aCentimos(120 + i * 37.5)) // determinista
    const comision = aEuros(Math.round(aCentimos(bruto) * 0.0175)) // 1,75 %
    movimientos.push({ externalId: `SQ-LIQ-${fecha}`, fecha, concepto: 'Liquidación Square', importe: bruto })
    movimientos.push({ externalId: `SQ-COM-${fecha}`, fecha, concepto: 'Comisión Square', importe: aEuros(-aCentimos(comision)) })
  }
  return { movimientos }
}
