import { evaluarContrasena } from '@norte/dominio'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { espaciosDe } from '../acceso.js'
import { cifrarContrasena, comprobarContrasena } from '../auth/contrasena.js'
import { COOKIE_SESION, cerrarSesion, crearSesion } from '../auth/sesiones.js'
import type { Configuracion } from '../configuracion.js'
import { conflicto, credencialesInvalidas, datosInvalidos } from '../errores.js'
import { crearEspacio } from '../espacios/crear.js'
import { usuarioDe, type Limites } from '../servidor.js'

const esquemaRegistro = z.object({
  email: z.string().email('Ese correo no parece válido.').max(200),
  nombre: z.string().trim().min(1, 'Dinos cómo te llamas.').max(100),
  contrasena: z.string(),
})

const esquemaEntrada = z.object({
  email: z.string().max(200),
  contrasena: z.string().max(200),
})

/**
 * Hash de una contraseña cualquiera, para gastar el mismo tiempo cuando el
 * correo no existe que cuando sí. Sin esto, medir lo que tarda el login dice si
 * alguien tiene cuenta aquí, y eso es lo único que hace falta para empezar.
 */
const HASH_SENUELO =
  '$argon2id$v=19$m=19456,t=2,p=1$c2VudWVsb3BhcmFub3J0ZQ$0iF3PGx8Bd4X0TPPfEfDPzcS8CkVXH6HdcHqBWxvT2A'

export async function rutasAuth(
  app: FastifyInstance,
  opciones: { prisma: PrismaClient; configuracion: Configuracion; limites: Limites },
) {
  const { prisma, configuracion, limites } = opciones

  const opcionesCookie = {
    httpOnly: true,
    sameSite: 'lax' as const,
    // En el Umbrel la app se sirve por http en la red de casa; exigir `secure`
    // ahí impediría entrar. Se controla por configuración y se avisa al arrancar.
    secure: configuracion.cookieSegura,
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  }

  // Los intentos de entrar y de registrarse van mucho más apretados que el
  // resto: es la puerta, y es donde se prueban contraseñas a lo bruto.
  const limitePuerta = {
    config: { rateLimit: { max: limites.puerta, timeWindow: '1 minute' } },
  }

  app.post('/api/auth/registro', limitePuerta, async (peticion, respuesta) => {
    const datos = esquemaRegistro.parse(peticion.body)
    const email = datos.email.trim().toLowerCase()

    const politica = evaluarContrasena(datos.contrasena, [datos.nombre, email.split('@')[0] ?? ''])
    if (!politica.valida) throw datosInvalidos(politica.mensaje ?? 'Esa contraseña no vale.')

    const existente = await prisma.usuario.findUnique({ where: { email } })
    if (existente) {
      throw conflicto('Ya hay una cuenta con ese correo. Prueba a entrar en vez de registrarte.')
    }

    const usuario = await prisma.usuario.create({
      data: {
        email,
        nombre: datos.nombre.trim(),
        hashContrasena: await cifrarContrasena(datos.contrasena),
      },
    })

    // Todo el mundo empieza con su espacio personal. Sin él, la primera pantalla
    // sería un formulario de «crea un espacio», que no significa nada para quien
    // solo quiere apuntar lo que gasta.
    await crearEspacio(prisma, { usuarioId: usuario.id, nombre: 'Personal', tipo: 'personal' })

    const { token } = await crearSesion(prisma, configuracion.secretoSesion, usuario.id, {
      agente: peticion.headers['user-agent'],
      ip: peticion.ip,
    })
    respuesta.setCookie(COOKIE_SESION, token, opcionesCookie)

    return respuesta.code(201).send({
      usuario: publico(usuario),
      espacios: await espaciosDe(prisma, usuario.id),
    })
  })

  app.post('/api/auth/entrar', limitePuerta, async (peticion, respuesta) => {
    const datos = esquemaEntrada.parse(peticion.body)
    const email = datos.email.trim().toLowerCase()

    const usuario = await prisma.usuario.findFirst({ where: { email, borradoEn: null } })
    if (!usuario) {
      await comprobarContrasena(HASH_SENUELO, datos.contrasena)
      throw credencialesInvalidas()
    }
    if (!(await comprobarContrasena(usuario.hashContrasena, datos.contrasena))) {
      throw credencialesInvalidas()
    }

    const { token } = await crearSesion(prisma, configuracion.secretoSesion, usuario.id, {
      agente: peticion.headers['user-agent'],
      ip: peticion.ip,
    })
    respuesta.setCookie(COOKIE_SESION, token, opcionesCookie)

    return {
      usuario: publico(usuario),
      espacios: await espaciosDe(prisma, usuario.id),
    }
  })

  app.post('/api/auth/salir', async (peticion, respuesta) => {
    await cerrarSesion(prisma, configuracion.secretoSesion, peticion.cookies[COOKIE_SESION])
    respuesta.clearCookie(COOKIE_SESION, { path: '/' })
    return { ok: true }
  })

  app.get('/api/auth/yo', async (peticion) => {
    const usuario = usuarioDe(peticion)
    return {
      usuario: publico(usuario),
      espacios: await espaciosDe(prisma, usuario.id),
    }
  })
}

/** Lo que se puede enseñar de un usuario. El hash y el secreto TOTP, jamás. */
function publico(usuario: {
  id: string
  email: string
  nombre: string
  divisaBase: string
  zonaHoraria: string
  totpActivo: boolean
}) {
  return {
    id: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    divisaBase: usuario.divisaBase,
    zonaHoraria: usuario.zonaHoraria,
    totpActivo: usuario.totpActivo,
  }
}
