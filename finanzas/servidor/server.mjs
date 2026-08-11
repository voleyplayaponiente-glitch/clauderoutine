/**
 * Servicio de conectores para la app de Gestión Financiera.
 * Pensado para correr en tu servidor (p. ej. Umbrel): guarda las credenciales
 * de terceros (Square, banco…) en variables de entorno cifradas y hace las
 * llamadas reales. La app (navegador) solo habla con este servicio.
 *
 * Sin dependencias: usa el http y el fetch nativos de Node ≥ 18.
 *
 * Guarda además las **copias de seguridad** de la app fuera del navegador, que
 * es lo único que protege de que el navegador limpie sus datos.
 *
 * Contrato (el que espera la app):
 *   GET  /api/estado                      -> { ok: true, copias: true }
 *   GET  /api/sync/<tipo>                 -> { movimientos: [...] }
 *   PUT  /api/copias/<empresaId>          -> guarda la copia del día
 *   GET  /api/copias                      -> empresas con copias
 *   GET  /api/copias/<empresaId>          -> { copias: [{ fecha, bytes }] }
 *   GET  /api/copias/<empresaId>/<fecha>  -> el backup completo ('ultima' vale)
 *   con cabecera  Authorization: Bearer <SECRETO>
 */
import http from 'node:http'
import crypto from 'node:crypto'
import { AlmacenCopias, nombreSeguro } from './copias.mjs'

const PUERTO = Number(process.env.PUERTO || 3001)
const SECRETO = process.env.SECRETO || ''
const ORIGEN = process.env.ORIGEN_PERMITIDO || '*'
const SQUARE_TOKEN = process.env.SQUARE_TOKEN || ''
const SQUARE_ENV = (process.env.SQUARE_ENV || 'production').toLowerCase()
const SQUARE_VERSION = process.env.SQUARE_VERSION || '2024-10-17'
const SQUARE_LOCATION = process.env.SQUARE_LOCATION_ID || ''
const COPIAS_DIR = process.env.COPIAS_DIR || '/datos'
const COPIAS_RETENCION = Number(process.env.COPIAS_RETENCION || 30)
/** Tope del cuerpo de una copia. Sin esto, una petición podría llenar el disco. */
const COPIAS_MAX_BYTES = Number(process.env.COPIAS_MAX_BYTES || 50 * 1024 * 1024)

const almacen = new AlmacenCopias(COPIAS_DIR, COPIAS_RETENCION)

const SQUARE_BASE = SQUARE_ENV === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com'

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', ORIGEN)
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
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

/** Lee el cuerpo de la petición con un tope de tamaño. */
function leerCuerpo(req, maxBytes) {
  return new Promise((resolve, reject) => {
    let total = 0
    const trozos = []
    req.on('data', (t) => {
      total += t.length
      if (total > maxBytes) {
        reject(new Error(`La copia supera el máximo admitido (${Math.round(maxBytes / 1024 / 1024)} MB)`))
        req.destroy()
        return
      }
      trozos.push(t)
    })
    req.on('end', () => resolve(Buffer.concat(trozos).toString('utf8')))
    req.on('error', reject)
  })
}

const servidor = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); return res.end() }

  const ruta = (req.url || '').split('?')[0]

  if (ruta === '/api/estado') {
    if (!autorizado(req)) return json(res, 401, { ok: false, error: 'No autorizado' })
    return json(res, 200, { ok: true, servicio: 'conectores-finanzas', version: 2, copias: true })
  }

  // ── Copias de seguridad ──
  if (ruta === '/api/copias' || ruta.startsWith('/api/copias/')) {
    if (!autorizado(req)) return json(res, 401, { error: 'No autorizado' })
    const partes = ruta.split('/').filter(Boolean).slice(2) // tras /api/copias
    try {
      if (req.method === 'PUT' && partes.length === 1) {
        const empresaId = nombreSeguro(partes[0])
        if (!empresaId) return json(res, 400, { error: 'Identificador de empresa no admitido' })
        const cuerpo = await leerCuerpo(req, COPIAS_MAX_BYTES)
        const backup = JSON.parse(cuerpo)
        const guardada = await almacen.guardar(empresaId, backup)
        return json(res, 200, { ok: true, ...guardada })
      }
      if (req.method === 'GET' && partes.length === 0) {
        return json(res, 200, { empresas: await almacen.empresas() })
      }
      if (req.method === 'GET' && partes.length === 1) {
        return json(res, 200, { copias: await almacen.listar(partes[0]) })
      }
      if (req.method === 'GET' && partes.length === 2) {
        const fecha = partes[1] === 'ultima' ? undefined : partes[1]
        const backup = await almacen.leer(partes[0], fecha)
        if (!backup) return json(res, 404, { error: 'No hay copia guardada' })
        return json(res, 200, backup)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error en el almacén de copias'
      return json(res, msg.includes('no admitid') || msg.includes('JSON') ? 400 : 500, { error: msg })
    }
    return json(res, 405, { error: 'Método no admitido' })
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
  console.log(`Copias de seguridad en ${COPIAS_DIR} (retención: ${COPIAS_RETENCION})`)
  if (!SECRETO) console.warn('AVISO: sin SECRETO -> solo se aceptan peticiones locales. Configura SECRETO para uso remoto.')
  if (ORIGEN === '*') console.warn('AVISO: ORIGEN_PERMITIDO="*". Fija la URL exacta de tu app en producción.')
})
