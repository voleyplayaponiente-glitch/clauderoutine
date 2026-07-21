// Servidor web de Gestor Laboral (versión para navegador / Umbrel).
// Reutiliza el mismo motor, base de datos SQLite y generadores que la app de
// escritorio. Protege el acceso con una contraseña. Todo local, sin nube.
import express from 'express'
import { randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'crypto'
import { writeFileSync, readFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { getDb, rutaBaseDatos, carpetaDatos, cerrarDb, reabrirDb } from '../main/db/database'
import { cargarSesiones, crearSesion, sesionValida, borrarSesion } from './sesiones'
import { iniciarBackupAutomatico } from './backup-auto'
import { handlers, validarArgs } from '../main/rpc'
import {
  bufferCuadranteExcel,
  bufferResumenCentrosExcel,
  bufferRetribucionExcel,
  bufferCuadranteCentrosExcel
} from '../main/services/generate-excel'
import { htmlCuadrante, htmlResumenCentros, htmlCuadranteCentros } from '../main/services/html-docs'
import { bufferFichaAltaExcel, parseFichaAlta } from '../main/services/ficha-alta'

const PORT = Number(process.env.PORT || 3000)
const WEB_DIR = process.env.GESTOR_WEB_DIR || join(process.cwd(), 'dist-web')

// Sin contraseña no se arranca: la app guarda datos personales (DNI, NSS, IBAN)
// y no debe quedar accesible por descuido con una contraseña conocida por defecto.
if (!process.env.GESTOR_PASSWORD) {
  console.error(
    '\n❌ Falta GESTOR_PASSWORD. Define una contraseña en tu configuración\n' +
      '   (docker-compose.yml o variable de entorno) y vuelve a arrancar.\n'
  )
  process.exit(1)
}
const PASSWORD = process.env.GESTOR_PASSWORD

getDb() // inicializa/migra la base de datos al arrancar
cargarSesiones() // recupera las sesiones guardadas (sobreviven a reinicios)

function leerCookie(cookie: string | undefined, nombre: string): string | null {
  if (!cookie) return null
  for (const par of cookie.split(';')) {
    const [k, v] = par.trim().split('=')
    if (k === nombre) return v
  }
  return null
}

const app = express()

// Cabeceras de seguridad. La CSP restringe todo al propio origen (nada externo);
// se permiten estilos/scripts inline porque la UI usa atributos style de React y
// los documentos imprimibles llevan <style> y el botón de imprimir inline.
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; " +
      "frame-ancestors 'none'"
  )
  next()
})

app.use(express.json({ limit: '15mb' }))

// ---- Autenticación ----
app.get('/api/session', (req, res) => {
  const tok = leerCookie(req.headers.cookie, 'sesion')
  res.json({ authed: sesionValida(tok) })
})

// Freno anti fuerza bruta: tras 5 fallos seguidos se bloquea el login 60 s.
const MAX_INTENTOS = 5
const BLOQUEO_MS = 60_000
let intentosFallidos = 0
let bloqueadoHasta = 0

app.post('/api/login', (req, res) => {
  if (Date.now() < bloqueadoHasta) {
    const seg = Math.ceil((bloqueadoHasta - Date.now()) / 1000)
    return res
      .status(429)
      .json({ ok: false, error: `Demasiados intentos. Espera ${seg} segundos.` })
  }
  if (req.body?.password === PASSWORD) {
    intentosFallidos = 0
    const tok = randomBytes(24).toString('hex')
    crearSesion(tok)
    res.setHeader('Set-Cookie', `sesion=${tok}; HttpOnly; Path=/; SameSite=Lax; Max-Age=2592000`)
    res.json({ ok: true })
  } else {
    intentosFallidos++
    if (intentosFallidos >= MAX_INTENTOS) {
      bloqueadoHasta = Date.now() + BLOQUEO_MS
      intentosFallidos = 0
      console.warn(`⚠️  Login bloqueado ${BLOQUEO_MS / 1000}s tras ${MAX_INTENTOS} intentos fallidos.`)
    }
    res.status(401).json({ ok: false })
  }
})

app.post('/api/logout', (req, res) => {
  const tok = leerCookie(req.headers.cookie, 'sesion')
  if (tok) borrarSesion(tok)
  res.setHeader('Set-Cookie', 'sesion=; HttpOnly; Path=/; Max-Age=0')
  res.json({ ok: true })
})

// A partir de aquí, todo /api requiere sesión válida.
app.use('/api', (req, res, next) => {
  if (sesionValida(leerCookie(req.headers.cookie, 'sesion'))) return next()
  res.status(401).json({ error: 'No autenticado' })
})

// ---- RPC de datos (mismos canales que el IPC de escritorio) ----
app.post('/api/rpc', (req, res) => {
  const { channel, args } = req.body || {}
  const fn = handlers[channel]
  if (!fn) return res.status(400).json({ error: `Canal desconocido: ${channel}` })
  const lista = Array.isArray(args) ? args : []
  const errorArgs = validarArgs(channel, lista)
  if (errorArgs) return res.status(400).json({ error: errorArgs })
  try {
    const result = fn(...lista)
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

app.get('/api/export/retribucion-excel', async (req, res) => {
  try {
    const buf = await bufferRetribucionExcel(nInt(req.query.empresa))
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="retribuciones.xlsx"')
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

// Calendario mensual por centros (la vista por centro de la agenda)
app.get('/api/export/cuadrante-centros-pdf', (req, res) => {
  try {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    const centro = req.query.centro ? nInt(req.query.centro) : undefined
    res.end(
      htmlCuadranteCentros(nInt(req.query.empresa), nInt(req.query.anio), nInt(req.query.mes), true, centro)
    )
  } catch (e) {
    res.status(500).send((e as Error).message)
  }
})

app.get('/api/export/cuadrante-centros-excel', async (req, res) => {
  try {
    const buf = await bufferCuadranteCentrosExcel(
      nInt(req.query.empresa),
      nInt(req.query.anio),
      nInt(req.query.mes),
      req.query.centro ? nInt(req.query.centro) : undefined
    )
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="cuadrante-centros-${req.query.anio}-${req.query.mes}.xlsx"`
    )
    res.end(buf)
  } catch (e) {
    res.status(500).send((e as Error).message)
  }
})

// ---- Ficha de alta de trabajador (Excel rellenable) ----
app.get('/api/ficha-alta/plantilla', async (_req, res) => {
  try {
    const buf = await bufferFichaAltaExcel()
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="ficha-alta-trabajador.xlsx"')
    res.end(buf)
  } catch (e) {
    res.status(500).send((e as Error).message)
  }
})

app.post('/api/ficha-alta/parse', express.raw({ type: '*/*', limit: '20mb' }), async (req, res) => {
  try {
    if (!req.body || !(req.body as Buffer).length) return res.status(400).json({ error: 'Fichero vacío' })
    const ficha = await parseFichaAlta(req.body as Buffer)
    res.json({ ok: true, trabajador: ficha.trabajador, centro: ficha.centro })
  } catch (e) {
    res.status(400).json({ error: (e as Error).message })
  }
})

// ---- Copias de seguridad ----
app.get('/api/backup/download', (_req, res) => {
  // Vuelca el WAL al fichero principal para que la copia incluya lo último escrito.
  getDb().pragma('wal_checkpoint(TRUNCATE)')
  const stamp = new Date().toISOString().slice(0, 10)
  res.download(rutaBaseDatos(), `copia-gestor-laboral-${stamp}.db`)
})

// Copia cifrada con la contraseña de acceso (AES-256-GCM, clave derivada con
// scrypt). Formato: [16 magia][16 sal][12 iv][16 etiqueta GCM][datos cifrados].
const MAGIA_CIFRADO = Buffer.from('GESTOR-CIFRADO-1')

app.get('/api/backup/download-cifrado', async (_req, res) => {
  try {
    // Copia consistente en caliente a un temporal, que es lo que se cifra.
    const tmp = join(carpetaDatos(), '.copia-cifrar-tmp.db')
    await getDb().backup(tmp)
    const datos = readFileSync(tmp)
    unlinkSync(tmp)
    const sal = randomBytes(16)
    const iv = randomBytes(12)
    const clave = scryptSync(PASSWORD, sal, 32)
    const cifrador = createCipheriv('aes-256-gcm', clave, iv)
    const cifrado = Buffer.concat([cifrador.update(datos), cifrador.final()])
    const fichero = Buffer.concat([MAGIA_CIFRADO, sal, iv, cifrador.getAuthTag(), cifrado])
    const stamp = new Date().toISOString().slice(0, 10)
    res.setHeader('Content-Type', 'application/octet-stream')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="copia-gestor-laboral-${stamp}.db.cifrada"`
    )
    res.end(fichero)
  } catch (e) {
    res.status(500).send((e as Error).message)
  }
})

// Firma con la que empieza todo fichero SQLite; evita machacar la base de
// datos si por error se sube cualquier otro fichero.
const FIRMA_SQLITE = Buffer.from('SQLite format 3\0')

app.post('/api/backup/upload', express.raw({ type: '*/*', limit: '100mb' }), (req, res) => {
  try {
    if (!req.body || !(req.body as Buffer).length) return res.status(400).json({ error: 'Fichero vacío' })
    let cuerpo = req.body as Buffer
    // Si es una copia cifrada nuestra, se descifra con la contraseña de acceso actual.
    if (cuerpo.length > 60 && cuerpo.subarray(0, 16).equals(MAGIA_CIFRADO)) {
      try {
        const sal = cuerpo.subarray(16, 32)
        const iv = cuerpo.subarray(32, 44)
        const etiqueta = cuerpo.subarray(44, 60)
        const clave = scryptSync(PASSWORD, sal, 32)
        const descifrador = createDecipheriv('aes-256-gcm', clave, iv)
        descifrador.setAuthTag(etiqueta)
        cuerpo = Buffer.concat([descifrador.update(cuerpo.subarray(60)), descifrador.final()])
      } catch {
        return res.status(400).json({
          error:
            'No se puede descifrar la copia. ¿Se creó con otra contraseña de acceso? ' +
            'Las copias cifradas solo se pueden restaurar con la misma contraseña con la que se crearon.'
        })
      }
    }
    if (cuerpo.length < 16 || !cuerpo.subarray(0, 16).equals(FIRMA_SQLITE)) {
      return res
        .status(400)
        .json({ error: 'El fichero no es una copia de seguridad válida (no es una base de datos SQLite).' })
    }
    cerrarDb()
    writeFileSync(rutaBaseDatos(), cuerpo)
    reabrirDb()
    res.json({ ok: true })
  } catch (e) {
    reabrirDb()
    res.status(500).json({ error: (e as Error).message })
  }
})

// ---- Estáticos (interfaz) + SPA fallback ----
// Caché correcta: los ficheros de /assets llevan huella en el nombre (cambian
// de nombre en cada build) → caché larga e inmutable. El resto (web.html,
// manifest, iconos) debe revalidarse siempre, para que el navegador y la PWA
// vean cada actualización sin quedarse con la versión antigua.
app.use(
  express.static(WEB_DIR, {
    setHeaders: (res, ruta) => {
      if (ruta.includes('assets') && /-[A-Za-z0-9_-]{8,}\./.test(ruta)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      } else {
        res.setHeader('Cache-Control', 'no-cache')
      }
    }
  })
)
app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache')
  res.sendFile(join(WEB_DIR, 'web.html'))
})

iniciarBackupAutomatico() // copia diaria a <datos>/backups/ con rotación de 30

app.listen(PORT, () => {
  console.log(`\n✅ Gestor Laboral (web) escuchando en http://localhost:${PORT}`)
  console.log(`   Datos en: ${rutaBaseDatos()}\n`)
})
