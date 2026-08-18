/**
 * La puerta.
 *
 * Hasta hoy cualquiera que llegase a la dirección del servidor podía crearse
 * una cuenta. Estos tests son los que sostienen que ya no: **la primera cuenta
 * es libre y a partir de ahí hace falta invitación**.
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

const registrarPor = (payload: Record<string, unknown>) =>
  app.inject({ method: 'POST', url: '/api/auth/registro', payload })

/** Crea un espacio compartido y devuelve el testigo de una invitación suya. */
async function invitar(
  cuenta: { cookie: string },
  espacioId: string,
  cuerpo: Record<string, unknown> = {},
) {
  const respuesta = await app.inject({
    method: 'POST',
    url: `/api/espacios/${espacioId}/invitaciones`,
    headers: { cookie: cuenta.cookie },
    payload: cuerpo,
  })
  if (respuesta.statusCode !== 201) {
    throw new Error(`No se pudo invitar: ${respuesta.statusCode} ${respuesta.body}`)
  }
  const { ruta, invitacion } = respuesta.json() as {
    ruta: string
    invitacion: { id: string }
  }
  return { token: ruta.replace('#/invitacion/', ''), id: invitacion.id, ruta }
}

describe('la primera cuenta', () => {
  it('entra sin invitación, y solo ella', async () => {
    const primera = await registrarPor({
      email: 'ana@ejemplo.es',
      nombre: 'Ana',
      contrasena: 'una frase larga y tranquila',
    })
    expect(primera.statusCode).toBe(201)

    const segunda = await registrarPor({
      email: 'colado@ejemplo.es',
      nombre: 'Colado',
      contrasena: 'otra frase larga aqui',
    })
    expect(segunda.statusCode).toBe(403)
    // El mensaje tiene que decir qué hacer, no solo que no.
    expect(segunda.json().error.mensaje).toContain('invitación')
    expect(await prisma.usuario.count()).toBe(1)
  })

  it('la pantalla de entrada sabe si la puerta está abierta', async () => {
    const vacia = await app.inject({ method: 'GET', url: '/api/auth/estado' })
    expect(vacia.json()).toMatchObject({ requiereInvitacion: false, primeraCuenta: true })

    await registrar(app, 'ana@ejemplo.es')

    const despues = await app.inject({ method: 'GET', url: '/api/auth/estado' })
    expect(despues.json()).toMatchObject({ requiereInvitacion: true, primeraCuenta: false })
  })
})

describe('invitaciones', () => {
  it('quien llega invitado entra y aparece ya dentro del espacio', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const casa = await crearEspacioDe(app, ana)
    const { token } = await invitar(ana, casa, { rol: 'editor' })

    const respuesta = await registrarPor({
      email: 'berta@ejemplo.es',
      nombre: 'Berta',
      contrasena: 'la casa azul del pueblo',
      invitacion: token,
    })
    expect(respuesta.statusCode).toBe(201)

    const espacios = (respuesta.json() as { espacios: { id: string; rol: string }[] }).espacios
    // Su espacio personal y el que le abrieron.
    expect(espacios).toHaveLength(2)
    expect(espacios.find((e) => e.id === casa)?.rol).toBe('editor')
  })

  it('el enlace vale una sola vez', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const casa = await crearEspacioDe(app, ana)
    const { token } = await invitar(ana, casa)

    await registrarPor({
      email: 'berta@ejemplo.es',
      nombre: 'Berta',
      contrasena: 'la casa azul del pueblo',
      invitacion: token,
    })
    const segunda = await registrarPor({
      email: 'carlos@ejemplo.es',
      nombre: 'Carlos',
      contrasena: 'otro sitio tranquilo',
      invitacion: token,
    })

    // Si valiera dos veces, un enlace reenviado a un grupo sería un registro
    // abierto con pasos extra.
    expect(segunda.statusCode).toBe(403)
    expect(segunda.json().error.mensaje).toContain('ya se usó')
  })

  it('se puede anular antes de que la usen', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const casa = await crearEspacioDe(app, ana)
    const { token, id } = await invitar(ana, casa)

    const anular = await app.inject({
      method: 'DELETE',
      url: `/api/espacios/${casa}/invitaciones/${id}`,
      headers: { cookie: ana.cookie },
    })
    expect(anular.statusCode).toBe(200)

    const intento = await registrarPor({
      email: 'berta@ejemplo.es',
      nombre: 'Berta',
      contrasena: 'la casa azul del pueblo',
      invitacion: token,
    })
    expect(intento.statusCode).toBe(403)
    expect(intento.json().error.mensaje).toContain('anuló')
  })

  it('caducada no vale', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const casa = await crearEspacioDe(app, ana)
    const { token, id } = await invitar(ana, casa)
    await prisma.invitacion.update({
      where: { id },
      data: { expiraEn: new Date(Date.now() - 1000) },
    })

    const intento = await registrarPor({
      email: 'berta@ejemplo.es',
      nombre: 'Berta',
      contrasena: 'la casa azul del pueblo',
      invitacion: token,
    })
    expect(intento.statusCode).toBe(403)
    expect(intento.json().error.mensaje).toContain('caducado')
  })

  it('si va dirigida a alguien, otro correo no la aprovecha', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const casa = await crearEspacioDe(app, ana)
    const { token } = await invitar(ana, casa, { email: 'berta@ejemplo.es' })

    const otro = await registrarPor({
      email: 'colado@ejemplo.es',
      nombre: 'Colado',
      contrasena: 'una frase cualquiera larga',
      invitacion: token,
    })
    expect(otro.statusCode).toBe(403)
    expect(otro.json().error.mensaje).toContain('berta@ejemplo.es')

    const berta = await registrarPor({
      email: 'BERTA@ejemplo.es',
      nombre: 'Berta',
      contrasena: 'la casa azul del pueblo',
      invitacion: token,
    })
    expect(berta.statusCode).toBe(201)
  })

  it('un testigo inventado no abre nada', async () => {
    await registrar(app, 'ana@ejemplo.es')
    const intento = await registrarPor({
      email: 'colado@ejemplo.es',
      nombre: 'Colado',
      contrasena: 'una frase cualquiera larga',
      invitacion: 'me-lo-acabo-de-inventar',
    })
    expect(intento.statusCode).toBe(403)
  })

  it('el testigo no se guarda en claro', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const casa = await crearEspacioDe(app, ana)
    const { token } = await invitar(ana, casa)

    const guardada = await prisma.invitacion.findFirstOrThrow()
    expect(guardada.hashToken).not.toBe(token)
    expect(guardada.hashToken).toHaveLength(64)
  })

  it('con invitación válida, un correo ya registrado sigue siendo conflicto', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const casa = await crearEspacioDe(app, ana)
    const { token } = await invitar(ana, casa)

    const repetido = await registrarPor({
      email: 'ANA@ejemplo.es',
      nombre: 'Otra Ana',
      contrasena: 'otra frase larga aqui',
      invitacion: token,
    })
    expect(repetido.statusCode).toBe(409)
    expect(repetido.json().error.mensaje).toContain('entrar')
  })
})

describe('quién puede invitar', () => {
  it('el editor no abre la puerta a nadie', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const berta = await registrar(app, 'berta@ejemplo.es')
    const casa = await crearEspacioDe(app, ana)
    await app.inject({
      method: 'POST',
      url: `/api/espacios/${casa}/miembros`,
      headers: { cookie: ana.cookie },
      payload: { email: berta.email, rol: 'editor' },
    })

    const intento = await app.inject({
      method: 'POST',
      url: `/api/espacios/${casa}/invitaciones`,
      headers: { cookie: berta.cookie },
      payload: {},
    })
    expect(intento.statusCode).toBe(403)
    expect(intento.json().error.mensaje).toContain('propietario')
  })

  it('un extraño no puede ni verlas', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const berta = await registrar(app, 'berta@ejemplo.es')
    const casa = await crearEspacioDe(app, ana)
    await invitar(ana, casa)

    const listar = await app.inject({
      method: 'GET',
      url: `/api/espacios/${casa}/invitaciones`,
      headers: { cookie: berta.cookie },
    })
    expect(listar.statusCode).toBe(404)
  })

  it('el propietario de un espacio no anula invitaciones de otro', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const berta = await registrar(app, 'berta@ejemplo.es')
    const casaDeAna = await crearEspacioDe(app, ana, 'Casa de Ana')
    const casaDeBerta = await crearEspacioDe(app, berta, 'Casa de Berta')
    const { id } = await invitar(ana, casaDeAna)

    // Berta es propietaria de SU espacio, y usa esa autorización para intentar
    // tocar una invitación del de Ana.
    const intento = await app.inject({
      method: 'DELETE',
      url: `/api/espacios/${casaDeBerta}/invitaciones/${id}`,
      headers: { cookie: berta.cookie },
    })
    expect(intento.statusCode).toBe(404)

    const sigueViva = await prisma.invitacion.findUniqueOrThrow({ where: { id } })
    expect(sigueViva.revocadaEn).toBeNull()
  })

  it('un espacio personal no admite invitaciones', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const intento = await app.inject({
      method: 'POST',
      url: `/api/espacios/${ana.espacioPersonalId}/invitaciones`,
      headers: { cookie: ana.cookie },
      payload: {},
    })
    expect(intento.statusCode).toBe(403)
    expect(intento.json().error.mensaje).toContain('solo tuyo')
  })
})

describe('consultar la invitación antes de rellenar nada', () => {
  it('cuenta a qué espacio te invitan y quién', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es', 'una frase larga y tranquila', 'Ana')
    const casa = await crearEspacioDe(app, ana, 'Casa')
    const { token } = await invitar(ana, casa, { rol: 'lector' })

    const consulta = await app.inject({
      method: 'POST',
      url: '/api/invitaciones/consultar',
      payload: { token },
    })
    expect(consulta.json()).toMatchObject({
      valida: true,
      espacio: 'Casa',
      rol: 'lector',
      invitaPor: 'Ana',
    })
  })

  it('con un enlace roto lo dice claro, sin hacer que rellene el formulario', async () => {
    await registrar(app, 'ana@ejemplo.es')
    const consulta = await app.inject({
      method: 'POST',
      url: '/api/invitaciones/consultar',
      payload: { token: 'esto-no-existe' },
    })
    expect(consulta.json()).toMatchObject({ valida: false, motivo: 'invitacion_desconocida' })
  })
})
