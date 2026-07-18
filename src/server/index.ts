// Servidor web de Gestor Laboral (versión para navegador / Umbrel).
// Reutiliza el mismo motor, base de datos SQLite y generadores que la app de
// escritorio. Protege el acceso con una contraseña. Todo local, sin nube.
import express from 'express'
import { randomBytes } from 'crypto'
import { writeFileSync } from 'fs'
import { join } from 'path'
import { getDb, rutaBaseDatos, cerrarDb, reabrirDb } from '../main/db/database'
import { handlers } from '../main/rpc'
import { bufferCuadranteExcel, bufferResumenCentrosExcel } from '../main/services/generate-excel'
import { htmlCuadrante, htmlResumenCentros } from '../main/services/html-docs'

const PORT = Number(process.env.PORT || 3000)
const PASSWORD = process.env.GESTOR_PASSWORD || 'gestor'
const WEB_DIR = process.env.GESTOR_WEB_DIR || join(process.cwd(), 'dist-web')

if (!process.env.GESTOR_PASSWORD) {
  console.warn(
    '\n⚠️  No se ha definido GESTOR_PASSWORD. Se usa la contraseña por defecto «gestor».\n' +
      '   Define GESTOR_PASSWORD en tu configuración para proteger los datos.\n'
  )
}

getDb() // inicializa/migra la base de datos al arrancar

const sesiones = new Set<string>()

function leerCookie(cookie: string | undefined, nombre: string): string | null {
  if (!cookie) return null
  for (const par of cookie.split(';')) {
    const [k, v] = par.trim().split('=')
    if (k === nombre) return v
  }
  return null
}

const app = express()
app.use(express.json({ limit: '15mb' }))

// ---- Autenticación ----
app.get('/api/session', (req, res) => {
  const tok = leerCookie(req.headers.cookie, 'sesion')
  res.json({ authed: !!tok && sesiones.has(tok) })
})

app.post('/api/login', (req, res) => {
  if (req.body?.password === PASSWORD) {
    const tok = randomBytes(24).toString('hex')
    sesiones.add(tok)
    res.setHeader('Set-Cookie', `sesion=${tok}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`)
    res.json({ ok: true })
  } else {
    res.status(401).json({ ok: false })
  }
})

app.post('/api/logout', (req, res) => {
  const tok = leerCookie(req.headers.cookie, 'sesion')
  if (tok) sesiones.delete(tok)
  res.setHeader('Set-Cookie', 'sesion=; HttpOnly; Path=/; Max-Age=0')
  res.json({ ok: true })
})

// A partir de aquí, todo /api requiere sesión válida.
app.use('/api', (req, res, next) => {
  const tok = leerCookie(req.headers.cookie, 'sesion')
  if (tok && sesiones.has(tok)) return next()
  res.status(401).json({ error: 'No autenticado' })
})

// ---- RPC de datos (mismos canales que el IPC de escritorio) ----
app.post('/api/rpc', (req, res) => {
  const { channel, args } = req.body || {}
  const fn = handlers[channel]
  if (!fn) return res.status(400).json({ error: `Canal desconocido: ${channel}` })
  try {
    const result = fn(...(Array.isArray(args) ? args : []))
    res.json({ result })
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
})

// ---- Exportaciones ----
const nInt = (v: unknown): number => Number(v)

app.get('/api/export/cuadrante-excel', async (req, res) => {
  try {
    const buf = await bufferCuadranteExcel(nInt(req.query.trab), nInt(req.query.anio), nInt(req.query.mes))
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="cuadrante-${req.query.anio}-${req.query.mes}.xlsx"`)
    res.end(buf)
  } catch (e) {
    res.status(500).send((e as Error).message)
  }
})

app.get('/api/export/resumen-excel', async (req, res) => {
  try {
    const buf = await bufferResumenCentrosExcel(nInt(req.query.empresa), nInt(req.query.anio), nInt(req.query.mes))
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="resumen-centros-${req.query.anio}-${req.query.mes}.xlsx"`)
    res.end(buf)
  } catch (e) {
    res.status(500).send((e as Error).message)
  }
})

app.get('/api/export/cuadrante-pdf', (req, res) => {
  try {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(htmlCuadrante(nInt(req.query.trab), nInt(req.query.anio), nInt(req.query.mes), true))
  } catch (e) {
    res.status(500).send((e as Error).message)
  }
})

app.get('/api/export/resumen-pdf', (req, res) => {
  try {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.end(htmlResumenCentros(nInt(req.query.empresa), nInt(req.query.anio), nInt(req.query.mes), true))
  } catch (e) {
    res.status(500).send((e as Error).message)
  }
})

// ---- Copias de seguridad ----
app.get('/api/backup/download', (_req, res) => {
  const stamp = new Date().toISOString().slice(0, 10)
  res.download(rutaBaseDatos(), `copia-gestor-laboral-${stamp}.db`)
})

app.post('/api/backup/upload', express.raw({ type: '*/*', limit: '100mb' }), (req, res) => {
  try {
    if (!req.body || !(req.body as Buffer).length) return res.status(400).json({ error: 'Fichero vacío' })
    cerrarDb()
    writeFileSync(rutaBaseDatos(), req.body as Buffer)
    reabrirDb()
    res.json({ ok: true })
  } catch (e) {
    reabrirDb()
    res.status(500).json({ error: (e as Error).message })
  }
})

// ---- Estáticos (interfaz) + SPA fallback ----
app.use(express.static(WEB_DIR))
app.get('*', (_req, res) => {
  res.sendFile(join(WEB_DIR, 'web.html'))
})

app.listen(PORT, () => {
  console.log(`\n✅ Gestor Laboral (web) escuchando en http://localhost:${PORT}`)
  console.log(`   Datos en: ${rutaBaseDatos()}\n`)
})
