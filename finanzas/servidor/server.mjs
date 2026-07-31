/**
 * Servicio de conectores para la app de Gestión Financiera.
 * Pensado para correr en tu servidor (p. ej. Umbrel): guarda las credenciales
 * de terceros (Square, banco…) en variables de entorno cifradas y hace las
 * llamadas reales. La app (navegador) solo habla con este servicio.
 *
 * Sin dependencias: usa el http y el fetch nativos de Node ≥ 18.
 *
 * Contrato (el que espera la app):
 *   GET /api/estado          -> { ok: true }
 *   GET /api/sync/<tipo>     -> { movimientos: [{ externalId, fecha, concepto, importe }] }
 *   con cabecera  Authorization: Bearer <SECRETO>
 */
import http from 'node:http'
import crypto from 'node:crypto'

const PUERTO = Number(process.env.PUERTO || 3001)
const SECRETO = process.env.SECRETO || ''
const ORIGEN = process.env.ORIGEN_PERMITIDO || '*'
const SQUARE_TOKEN = process.env.SQUARE_TOKEN || ''
const SQUARE_ENV = (process.env.SQUARE_ENV || 'production').toLowerCase()
const SQUARE_VERSION = process.env.SQUARE_VERSION || '2024-10-17'
const SQUARE_LOCATION = process.env.SQUARE_LOCATION_ID || ''

const SQUARE_BASE = SQUARE_ENV === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com'

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', ORIGEN)
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
}
function json(res, code, obj) {
  cors(res)
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(obj))
}
/** ¿La petición viene de la propia máquina (loopback)? */
function esLocal(req) {
  const a = req.socket.remoteAddress || ''
  return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1'
}

/** Comparación en tiempo constante para evitar ataques de temporización. */
function secretoValido(dado) {
  const esperado = `Bearer ${SECRETO}`
  const a = Buffer.from(dado || '')
  const b = Buffer.from(esperado)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

function autorizado(req) {
  // Sin SECRETO configurado, solo se permite acceso desde la propia máquina
  // (nunca queda abierto a la red). Configura SECRETO para uso remoto.
  if (!SECRETO) return esLocal(req)
  return secretoValido(req.headers['authorization'])
}

/** Adaptador Square: liquidaciones (payouts) → movimientos normalizados. */
async function syncSquare() {
  if (!SQUARE_TOKEN) throw new Error('Configura SQUARE_TOKEN en el entorno del servidor')
  const url = new URL(`${SQUARE_BASE}/v2/payouts`)
  if (SQUARE_LOCATION) url.searchParams.set('location_id', SQUARE_LOCATION)
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${SQUARE_TOKEN}`, 'Square-Version': SQUARE_VERSION, 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`Square respondió ${res.status}: ${await res.text()}`)
  const datos = await res.json()
  const payouts = Array.isArray(datos.payouts) ? datos.payouts : []
  return payouts.map((p) => ({
    externalId: `SQ-${p.id}`,
    fecha: String(p.created_at || '').slice(0, 10),
    concepto: `Liquidación Square (${p.status || 'PAID'})`,
    importe: (Number(p.amount_money?.amount || 0)) / 100, // Square da céntimos
  }))
}

/** Demo: útil para comprobar la conexión de extremo a extremo. */
function syncDemo() {
  const hoy = new Date().toISOString().slice(0, 10)
  return [
    { externalId: `DEMO-${hoy}-1`, fecha: hoy, concepto: 'Liquidación demo', importe: 150.5 },
    { externalId: `DEMO-${hoy}-2`, fecha: hoy, concepto: 'Comisión demo', importe: -2.63 },
  ]
}

const ADAPTADORES = {
  square: syncSquare,
  demo: async () => syncDemo(),
  // Añade aquí banco_psd2, stripe, shopify… siguiendo el mismo formato de salida.
}

const servidor = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); return res.end() }

  const ruta = (req.url || '').split('?')[0]

  if (ruta === '/api/estado') {
    if (!autorizado(req)) return json(res, 401, { ok: false, error: 'No autorizado' })
    return json(res, 200, { ok: true, servicio: 'conectores-finanzas', version: 1 })
  }

  const m = /^\/api\/sync\/([a-z_]+)$/.exec(ruta)
  if (m) {
    if (!autorizado(req)) return json(res, 401, { error: 'No autorizado' })
    const tipo = m[1]
    const adaptador = ADAPTADORES[tipo]
    if (!adaptador) return json(res, 501, { error: `Conector "${tipo}" no implementado todavía en el servidor` })
    try {
      const movimientos = await adaptador()
      return json(res, 200, { movimientos })
    } catch (e) {
      return json(res, 502, { error: e instanceof Error ? e.message : 'Error del conector' })
    }
  }

  json(res, 404, { error: 'No encontrado' })
})

servidor.listen(PUERTO, () => {
  console.log(`Servicio de conectores escuchando en el puerto ${PUERTO}`)
  console.log(`Origen permitido (CORS): ${ORIGEN}`)
  console.log(`Square: ${SQUARE_TOKEN ? SQUARE_ENV : 'sin token (solo demo)'}`)
  if (!SECRETO) console.warn('AVISO: sin SECRETO -> solo se aceptan peticiones locales. Configura SECRETO para uso remoto.')
  if (ORIGEN === '*') console.warn('AVISO: ORIGEN_PERMITIDO="*". Fija la URL exacta de tu app en producción.')
})
