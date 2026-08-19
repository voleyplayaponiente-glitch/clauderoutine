import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { crearApp, limpiarBd, prisma, registrar, type Cuenta } from './ayuda.js'

/**
 * Lo que la app sabe de las copias.
 *
 * Las copias las hace otro contenedor, así que aquí se prueba lo que sí es
 * responsabilidad del servidor: quién puede verlas y que no se invente que
 * todo va bien cuando el servicio está parado.
 */

const CARPETA = join(tmpdir(), 'norte-test-datos', 'copias')
const PETICION = join(tmpdir(), 'norte-test-datos', 'peticion', 'copia-ahora')

let app: FastifyInstance
let dueno: Cuenta

async function servicioEscribe(estado: string, conLatido = true) {
  await mkdir(CARPETA, { recursive: true })
  await writeFile(join(CARPETA, 'estado.json'), estado)
  if (conLatido) await writeFile(join(CARPETA, '.latido'), '')
}

beforeEach(async () => {
  await rm(join(tmpdir(), 'norte-test-datos'), { recursive: true, force: true })
  process.env.NORTE_COPIAS_DIR = CARPETA
  process.env.NORTE_COPIAS_PETICION = PETICION
  await limpiarBd()
  app = await crearApp()
  dueno = await registrar(app, 'dueno@ejemplo.es')
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('ver el estado de las copias', () => {
  it('cuenta lo que el servicio ha dejado escrito', async () => {
    await servicioEscribe(
      '{"ultima":"2026-08-19T04:30:00Z","fichero":"norte-2026-08-19-0430.dump","bytes":1000,"copias":3,"ok":true,"mensaje":null}',
    )
    await writeFile(join(CARPETA, 'norte-2026-08-19-0430.dump'), 'x'.repeat(1000))
    await writeFile(join(CARPETA, 'norte-2026-08-19-0430-documentos.tar.gz'), 'y'.repeat(50))

    const respuesta = await app.inject({ method: 'GET', url: '/api/copias', headers: { cookie: dueno.cookie } })
    expect(respuesta.statusCode).toBe(200)
    const cuerpo = respuesta.json()
    expect(cuerpo.servicioVivo).toBe(true)
    expect(cuerpo.estado.copias).toBe(3)
    expect(cuerpo.copias).toHaveLength(1)
    expect(cuerpo.copias[0]).toMatchObject({ bytes: 1050, conDocumentos: true })
  })

  it('sin latido reciente dice que el servicio no da señales, aunque el estado diga que todo fue bien', async () => {
    // El caso que de verdad importa: el fichero de estado lo escribió el
    // servicio antes de morirse, y sigue diciendo «ok».
    await servicioEscribe('{"ultima":"2026-08-19T04:30:00Z","copias":3,"ok":true}', false)
    const respuesta = await app.inject({ method: 'GET', url: '/api/copias', headers: { cookie: dueno.cookie } })
    expect(respuesta.json().servicioVivo).toBe(false)
  })

  it('sin fichero de estado no revienta: devuelve que no hay noticias', async () => {
    const respuesta = await app.inject({ method: 'GET', url: '/api/copias', headers: { cookie: dueno.cookie } })
    expect(respuesta.statusCode).toBe(200)
    expect(respuesta.json()).toMatchObject({ estado: null, servicioVivo: false, copias: [] })
  })

  it('un estado corrupto se trata como falta de noticias, no como un error 500', async () => {
    await servicioEscribe('{esto no es json')
    const respuesta = await app.inject({ method: 'GET', url: '/api/copias', headers: { cookie: dueno.cookie } })
    expect(respuesta.statusCode).toBe(200)
    expect(respuesta.json().estado).toBeNull()
  })
})

describe('quién manda sobre las copias', () => {
  it('solo el dueño de la instalación', async () => {
    const otra = await registrar(app, 'otra@ejemplo.es')
    const respuesta = await app.inject({ method: 'GET', url: '/api/copias', headers: { cookie: otra.cookie } })
    expect(respuesta.statusCode).toBe(403)
    expect(respuesta.json().error.mensaje).toMatch(/quien instaló Norte/i)
  })

  it('sin sesión, ni eso', async () => {
    const respuesta = await app.inject({ method: 'GET', url: '/api/copias' })
    expect(respuesta.statusCode).toBe(401)
  })
})

describe('pedir una copia ahora', () => {
  it('deja la señal que recoge el servicio', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/copias/ahora',
      headers: { cookie: dueno.cookie },
    })
    expect(respuesta.statusCode).toBe(200)
    const { readFile } = await import('node:fs/promises')
    // El contenido da igual; lo que el servicio mira es que el fichero exista.
    expect(await readFile(PETICION, 'utf8')).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('no la puede pedir cualquiera', async () => {
    const otra = await registrar(app, 'otra@ejemplo.es')
    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/copias/ahora',
      headers: { cookie: otra.cookie },
    })
    expect(respuesta.statusCode).toBe(403)
  })
})
