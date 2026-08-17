/**
 * Los tests de fuga.
 *
 * Esto es lo que sustituye a las políticas RLS de Supabase del encargo
 * original, y es lo que hay que poder enseñar cuando alguien pregunte «¿y mi
 * pareja no ve mis cuentas?». Si un día cambia el guardián de `acceso.ts`, aquí
 * se enteran.
 */

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { crearApp, crearEspacioDe, limpiarBd, prisma, registrar } from './ayuda.js'

let app: FastifyInstance

beforeAll(async () => {
  app = await crearApp()
})

beforeEach(async () => {
  await limpiarBd()
})

afterAll(async () => {
  await app.close()
  await prisma.$disconnect()
})

describe('un extraño no llega al espacio de otro', () => {
  it('no puede ni verlo, y se le dice «no existe», no «no puedes»', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const berta = await registrar(app, 'berta@ejemplo.es')

    const respuesta = await app.inject({
      method: 'GET',
      url: `/api/espacios/${ana.espacioPersonalId}`,
      headers: { cookie: berta.cookie },
    })

    // 404 y no 403: un 403 le confirmaría a Berta que ese espacio existe.
    expect(respuesta.statusCode).toBe(404)
    expect(respuesta.json().error.codigo).toBe('no_encontrado')
  })

  it('no puede listar sus categorías', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const berta = await registrar(app, 'berta@ejemplo.es')

    const respuesta = await app.inject({
      method: 'GET',
      url: `/api/espacios/${ana.espacioPersonalId}/categorias`,
      headers: { cookie: berta.cookie },
    })
    expect(respuesta.statusCode).toBe(404)
  })

  it('no puede escribir en él', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const berta = await registrar(app, 'berta@ejemplo.es')

    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/espacios/${ana.espacioPersonalId}/categorias`,
      headers: { cookie: berta.cookie },
      payload: { nombre: 'Colada ajena' },
    })
    expect(respuesta.statusCode).toBe(404)
    expect(await prisma.categoria.count({ where: { nombre: 'Colada ajena' } })).toBe(0)
  })

  it('no puede invitarse a sí mismo', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const berta = await registrar(app, 'berta@ejemplo.es')
    const casa = await crearEspacioDe(app, ana)

    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/espacios/${casa}/miembros`,
      headers: { cookie: berta.cookie },
      payload: { email: berta.email, rol: 'editor' },
    })
    expect(respuesta.statusCode).toBe(404)
  })

  it('en la lista de espacios solo salen los suyos', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    await crearEspacioDe(app, ana)
    const berta = await registrar(app, 'berta@ejemplo.es')

    const respuesta = await app.inject({
      method: 'GET',
      url: '/api/espacios',
      headers: { cookie: berta.cookie },
    })
    const espacios = respuesta.json().espacios as { id: string }[]
    expect(espacios).toHaveLength(1)
    expect(espacios[0]!.id).toBe(berta.espacioPersonalId)
  })
})

describe('dentro de un espacio compartido, el rol manda', () => {
  it('el lector lee pero no escribe, y se le explica por qué', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const berta = await registrar(app, 'berta@ejemplo.es')
    const casa = await crearEspacioDe(app, ana)

    await app.inject({
      method: 'POST',
      url: `/api/espacios/${casa}/miembros`,
      headers: { cookie: ana.cookie },
      payload: { email: berta.email, rol: 'lector' },
    })

    const leer = await app.inject({
      method: 'GET',
      url: `/api/espacios/${casa}/categorias`,
      headers: { cookie: berta.cookie },
    })
    expect(leer.statusCode).toBe(200)

    const escribir = await app.inject({
      method: 'POST',
      url: `/api/espacios/${casa}/categorias`,
      headers: { cookie: berta.cookie },
      payload: { nombre: 'Cena de los viernes' },
    })
    // Aquí sí 403: Berta es miembro, sabe que el espacio existe, y necesita
    // entender por qué no puede escribir.
    expect(escribir.statusCode).toBe(403)
    expect(escribir.json().error.mensaje).toContain('solo lectura')
  })

  it('el editor escribe pero no administra', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const berta = await registrar(app, 'berta@ejemplo.es')
    const carlos = await registrar(app, 'carlos@ejemplo.es')
    const casa = await crearEspacioDe(app, ana)

    await app.inject({
      method: 'POST',
      url: `/api/espacios/${casa}/miembros`,
      headers: { cookie: ana.cookie },
      payload: { email: berta.email, rol: 'editor' },
    })

    const escribir = await app.inject({
      method: 'POST',
      url: `/api/espacios/${casa}/categorias`,
      headers: { cookie: berta.cookie },
      payload: { nombre: 'Cena de los viernes' },
    })
    expect(escribir.statusCode).toBe(201)

    const invitar = await app.inject({
      method: 'POST',
      url: `/api/espacios/${casa}/miembros`,
      headers: { cookie: berta.cookie },
      payload: { email: carlos.email, rol: 'editor' },
    })
    expect(invitar.statusCode).toBe(403)
    expect(invitar.json().error.mensaje).toContain('propietario')
  })

  it('al darle de baja pierde el acceso en el acto', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const berta = await registrar(app, 'berta@ejemplo.es')
    const casa = await crearEspacioDe(app, ana)

    await app.inject({
      method: 'POST',
      url: `/api/espacios/${casa}/miembros`,
      headers: { cookie: ana.cookie },
      payload: { email: berta.email, rol: 'editor' },
    })
    const antes = await app.inject({
      method: 'GET',
      url: `/api/espacios/${casa}`,
      headers: { cookie: berta.cookie },
    })
    expect(antes.statusCode).toBe(200)

    await app.inject({
      method: 'DELETE',
      url: `/api/espacios/${casa}/miembros/${berta.usuarioId}`,
      headers: { cookie: ana.cookie },
    })

    // Sin cerrar sesión ni esperar a que caduque nada: la siguiente petición ya
    // no pasa. La sesión sigue viva, lo que se ha ido es la membresía.
    const despues = await app.inject({
      method: 'GET',
      url: `/api/espacios/${casa}`,
      headers: { cookie: berta.cookie },
    })
    expect(despues.statusCode).toBe(404)
  })

  it('un espacio no se queda nunca sin propietario', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const casa = await crearEspacioDe(app, ana)

    const respuesta = await app.inject({
      method: 'DELETE',
      url: `/api/espacios/${casa}/miembros/${ana.usuarioId}`,
      headers: { cookie: ana.cookie },
    })
    expect(respuesta.statusCode).toBe(409)
  })

  it('el espacio personal no admite invitados', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const berta = await registrar(app, 'berta@ejemplo.es')

    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/espacios/${ana.espacioPersonalId}/miembros`,
      headers: { cookie: ana.cookie },
      payload: { email: berta.email, rol: 'editor' },
    })
    expect(respuesta.statusCode).toBe(403)
    expect(respuesta.json().error.mensaje).toContain('solo tuyo')
  })
})

describe('los datos de un espacio no se cuelan por una relación', () => {
  it('no se puede colgar una categoría de una madre de otro espacio', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const berta = await registrar(app, 'berta@ejemplo.es')

    const suyas = await prisma.categoria.findFirstOrThrow({
      where: { espacioId: ana.espacioPersonalId, padreId: null },
    })

    // Berta escribe en SU espacio —donde sí puede— pero apuntando a una madre
    // de Ana. Si esto colara, tendría una rama de su árbol dentro del de Ana.
    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/espacios/${berta.espacioPersonalId}/categorias`,
      headers: { cookie: berta.cookie },
      payload: { nombre: 'Cuña', padreId: suyas.id },
    })
    expect(respuesta.statusCode).toBe(404)
    expect(await prisma.categoria.count({ where: { nombre: 'Cuña' } })).toBe(0)
  })

  it('las categorías que devuelve un espacio son solo suyas', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    await registrar(app, 'berta@ejemplo.es')

    const respuesta = await app.inject({
      method: 'GET',
      url: `/api/espacios/${ana.espacioPersonalId}/categorias`,
      headers: { cookie: ana.cookie },
    })
    const categorias = respuesta.json().categorias as { espacioId: string }[]
    expect(categorias.length).toBeGreaterThan(0)
    expect(categorias.every((c) => c.espacioId === ana.espacioPersonalId)).toBe(true)
  })
})
