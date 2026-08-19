import cookie from '@fastify/cookie'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import type { PrismaClient, Usuario } from '@prisma/client'
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import { ZodError } from 'zod'
import { COOKIE_SESION, usuarioDeSesion } from './auth/sesiones.js'
import type { Configuracion } from './configuracion.js'
import { TAMANO_MAXIMO } from './documentos/almacen.js'
import { ErrorApi, noAutenticado } from './errores.js'
import { rutasAuth } from './rutas/auth.js'
import { rutasCopias } from './rutas/copias.js'
import { rutasCuentas } from './rutas/cuentas.js'
import { rutasDeudas } from './rutas/deudas.js'
import { rutasDocumentos } from './rutas/documentos.js'
import { rutasEspacios } from './rutas/espacios.js'
import { rutasPresupuestos } from './rutas/presupuestos.js'
import { rutasTarjetas } from './rutas/tarjetas.js'
import { rutasMovimientos } from './rutas/movimientos.js'
import { rutasRecurrentes } from './rutas/recurrentes.js'

declare module 'fastify' {
  interface FastifyRequest {
    /** Rellenado en cada petición por el hook de sesión. `null` si no hay sesión. */
    usuario: Usuario | null
  }
}

export interface Limites {
  /** Peticiones por minuto y por IP en toda la API. */
  global: number
  /** Peticiones por minuto en registro y entrada. Mucho más bajo: es la puerta. */
  puerta: number
}

export const LIMITES_POR_DEFECTO: Limites = { global: 300, puerta: 10 }

export interface Dependencias {
  prisma: PrismaClient
  configuracion: Configuracion
  registro?: boolean
  /** Los tests los suben para no chocar con el límite, y uno los baja a propósito. */
  limites?: Limites
}

/** Atajo para las rutas que exigen sesión. */
export function usuarioDe(peticion: FastifyRequest): Usuario {
  if (!peticion.usuario) throw noAutenticado()
  return peticion.usuario
}

export async function crearServidor({
  prisma,
  configuracion,
  registro = configuracion.entorno !== 'test',
  limites = LIMITES_POR_DEFECTO,
}: Dependencias): Promise<FastifyInstance> {
  const app = Fastify({
    logger: registro ? { level: 'info' } : false,
    // Detrás de nginx en el Umbrel: sin esto, la IP de todas las peticiones
    // sería la del contenedor y el límite de intentos protegería a todos por
    // igual, que es como no proteger a nadie.
    trustProxy: true,
    bodyLimit: 2 * 1024 * 1024,
  })

  await app.register(cookie)
  // La subida de documentos va por multipart. El tope de tamaño se pone también
  // en la ruta, pero aquí hace de red: el cuerpo JSON sigue limitado a 2 MB y
  // sin esto un fichero grande se leería entero en memoria antes de rechazarlo.
  await app.register(multipart, {
    limits: { fileSize: TAMANO_MAXIMO, files: 1, fields: 10 },
  })
  await app.register(rateLimit, {
    max: limites.global,
    timeWindow: '1 minute',
    // Devuelve un `ErrorApi` y no un objeto plano a propósito: el plugin pasa
    // lo que devuelva por el manejador de errores, y un objeto sin `statusCode`
    // acababa saliendo como un 500 —el limitador funcionaba y la respuesta
    // mentía—. Así el mensaje es el mismo que el del resto de la API.
    errorResponseBuilder: () =>
      new ErrorApi(
        'demasiadas_peticiones',
        'Demasiadas peticiones seguidas. Espera un momento y vuelve a intentarlo.',
      ),
  })

  /**
   * Los importes viajan como `BigInt` desde Prisma y `JSON.stringify` no sabe
   * serializarlos: sin esto, cualquier respuesta con dinero reventaría con
   * «Do not know how to serialize a BigInt». Se convierten a número, que es
   * exacto hasta 2^53 —y el dominio ya rechaza cualquier importe mayor.
   */
  app.setReplySerializer((carga) =>
    JSON.stringify(carga, (_clave, valor) => (typeof valor === 'bigint' ? Number(valor) : valor)),
  )

  app.decorateRequest('usuario', null)

  app.addHook('preHandler', async (peticion) => {
    const token = peticion.cookies[COOKIE_SESION]
    peticion.usuario = await usuarioDeSesion(prisma, configuracion.secretoSesion, token)
  })

  app.setErrorHandler((error, peticion, respuesta) => {
    if (error instanceof ErrorApi) {
      return respuesta
        .code(error.estado)
        .send({ error: { codigo: error.codigo, mensaje: error.message, detalle: error.detalle } })
    }
    if (error instanceof ZodError) {
      const primero = error.issues[0]
      return respuesta.code(400).send({
        error: {
          codigo: 'datos_invalidos',
          mensaje: primero?.message ?? 'Los datos enviados no son válidos.',
          detalle: error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
        },
      })
    }
    // Lo inesperado se registra entero por dentro y se cuenta por fuera sin
    // detalles: la traza de un error puede llevar nombres de tablas y rutas.
    peticion.log.error({ err: error }, 'error no controlado')
    return respuesta.code(500).send({
      error: {
        codigo: 'interno',
        mensaje: 'Algo ha fallado por nuestra parte. Vuelve a intentarlo; si sigue, mira el registro del servidor.',
      },
    })
  })

  app.setNotFoundHandler((_peticion, respuesta) =>
    respuesta.code(404).send({ error: { codigo: 'no_encontrado', mensaje: 'Esa ruta no existe.' } }),
  )

  app.get('/api/salud', async () => ({
    ok: true,
    servicio: 'norte-api',
    version: process.env.NORTE_VERSION ?? 'dev',
  }))

  await app.register(rutasAuth, { prisma, configuracion, limites })
  await app.register(rutasEspacios, { prisma, configuracion })
  await app.register(rutasCuentas, { prisma })
  await app.register(rutasMovimientos, { prisma })
  await app.register(rutasRecurrentes, { prisma })
  await app.register(rutasDocumentos, { prisma, configuracion })
  await app.register(rutasCopias, { prisma, configuracion })
  await app.register(rutasPresupuestos, { prisma })
  await app.register(rutasDeudas, { prisma })
  await app.register(rutasTarjetas, { prisma })

  return app
}
