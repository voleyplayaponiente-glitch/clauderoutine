import { totalCategoriasDefecto } from '@norte/dominio'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { COOKIE_SESION } from '../src/auth/sesiones.js'
import { crearApp, limpiarBd, prisma, registrar } from './ayuda.js'

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

describe('registro', () => {
  it('deja la cuenta usable: usuario, espacio personal y categorías', async () => {
    const cuenta = await registrar(app, 'ana@ejemplo.es')

    const espacio = await prisma.espacio.findUniqueOrThrow({ where: { id: cuenta.espacioPersonalId } })
    expect(espacio.tipo).toBe('personal')

    const miembro = await prisma.miembroEspacio.findFirstOrThrow({
      where: { espacioId: espacio.id, usuarioId: cuenta.usuarioId },
    })
    expect(miembro.rol).toBe('propietario')

    // Sin categorías, la primera pantalla útil sería un formulario de
    // taxonomías. Se comprueba que llegan todas.
    const categorias = await prisma.categoria.count({ where: { espacioId: espacio.id } })
    expect(categorias).toBe(totalCategoriasDefecto())
  })

  it('guarda la contraseña cifrada, nunca en claro', async () => {
    await registrar(app, 'ana@ejemplo.es', 'una frase larga y tranquila')
    const usuario = await prisma.usuario.findUniqueOrThrow({ where: { email: 'ana@ejemplo.es' } })
    expect(usuario.hashContrasena).not.toContain('una frase')
    expect(usuario.hashContrasena.startsWith('$argon2id$')).toBe(true)
  })

  it('la cookie de sesión es httpOnly y no lleva el testigo a la base de datos', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/auth/registro',
      payload: { email: 'ana@ejemplo.es', nombre: 'Ana', contrasena: 'una frase larga y tranquila' },
    })
    const galleta = respuesta.cookies.find((c) => c.name === COOKIE_SESION)
    expect(galleta?.httpOnly).toBe(true)
    expect(galleta?.sameSite?.toLowerCase()).toBe('lax')

    const sesion = await prisma.sesion.findFirstOrThrow()
    expect(sesion.hashToken).not.toBe(galleta?.value)
    expect(sesion.hashToken).toHaveLength(64) // sha256 en hexadecimal
  })

  it('no admite dos cuentas con el mismo correo', async () => {
    await registrar(app, 'ana@ejemplo.es')
    const segunda = await app.inject({
      method: 'POST',
      url: '/api/auth/registro',
      payload: { email: 'ANA@ejemplo.es', nombre: 'Otra Ana', contrasena: 'otra frase larga aqui' },
    })
    expect(segunda.statusCode).toBe(409)
    expect(segunda.json().error.mensaje).toContain('entrar')
  })

  it('rechaza una contraseña corta explicando qué hacer', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/auth/registro',
      payload: { email: 'ana@ejemplo.es', nombre: 'Ana', contrasena: 'corta1' },
    })
    expect(respuesta.statusCode).toBe(400)
    expect(respuesta.json().error.mensaje).toContain('10 caracteres')
  })
})

describe('entrar y salir', () => {
  it('entra con la contraseña correcta', async () => {
    await registrar(app, 'ana@ejemplo.es', 'una frase larga y tranquila')
    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/auth/entrar',
      payload: { email: 'ana@ejemplo.es', contrasena: 'una frase larga y tranquila' },
    })
    expect(respuesta.statusCode).toBe(200)
    expect(respuesta.json().espacios).toHaveLength(1)
  })

  it('da el mismo mensaje si el correo no existe que si la contraseña falla', async () => {
    await registrar(app, 'ana@ejemplo.es', 'una frase larga y tranquila')

    const malaContrasena = await app.inject({
      method: 'POST',
      url: '/api/auth/entrar',
      payload: { email: 'ana@ejemplo.es', contrasena: 'no es esta para nada' },
    })
    const noExiste = await app.inject({
      method: 'POST',
      url: '/api/auth/entrar',
      payload: { email: 'nadie@ejemplo.es', contrasena: 'no es esta para nada' },
    })

    expect(malaContrasena.statusCode).toBe(401)
    expect(noExiste.statusCode).toBe(401)
    // Si los mensajes fueran distintos, probar correos uno a uno diría quién
    // tiene cuenta en esta instalación.
    expect(noExiste.json().error.mensaje).toBe(malaContrasena.json().error.mensaje)
  })

  it('sin cookie no se sabe quién eres', async () => {
    const respuesta = await app.inject({ method: 'GET', url: '/api/auth/yo' })
    expect(respuesta.statusCode).toBe(401)
  })

  it('salir invalida la sesión de verdad, no solo en el navegador', async () => {
    const cuenta = await registrar(app, 'ana@ejemplo.es')

    await app.inject({ method: 'POST', url: '/api/auth/salir', headers: { cookie: cuenta.cookie } })

    const despues = await app.inject({
      method: 'GET',
      url: '/api/auth/yo',
      headers: { cookie: cuenta.cookie },
    })
    expect(despues.statusCode).toBe(401)
    expect(await prisma.sesion.count()).toBe(0)
  })

  it('una sesión caducada deja de valer', async () => {
    const cuenta = await registrar(app, 'ana@ejemplo.es')
    await prisma.sesion.updateMany({ data: { expiraEn: new Date(Date.now() - 1000) } })

    const respuesta = await app.inject({
      method: 'GET',
      url: '/api/auth/yo',
      headers: { cookie: cuenta.cookie },
    })
    expect(respuesta.statusCode).toBe(401)
  })
})

describe('límite de intentos', () => {
  it('corta la fuerza bruta contra la puerta', async () => {
    const app2 = await crearApp({ global: 10_000, puerta: 3 })
    try {
      await registrar(app2, 'ana@ejemplo.es', 'una frase larga y tranquila')

      const intentos = []
      for (let i = 0; i < 5; i++) {
        intentos.push(
          await app2.inject({
            method: 'POST',
            url: '/api/auth/entrar',
            payload: { email: 'ana@ejemplo.es', contrasena: `intento numero ${i}` },
          }),
        )
      }
      const bloqueados = intentos.filter((r) => r.statusCode === 429)
      expect(bloqueados.length).toBeGreaterThan(0)
      expect(bloqueados[0]!.json().error.mensaje).toContain('Espera un momento')
    } finally {
      await app2.close()
    }
  })
})

describe('salud', () => {
  it('responde sin necesitar sesión, que es para lo que sirve', async () => {
    const respuesta = await app.inject({ method: 'GET', url: '/api/salud' })
    expect(respuesta.statusCode).toBe(200)
    expect(respuesta.json().ok).toBe(true)
  })
})
