import type { FastifyInstance } from 'fastify'
import { crearPrisma } from '../src/bd.js'
import { COOKIE_SESION } from '../src/auth/sesiones.js'
import { leerConfiguracion } from '../src/configuracion.js'
import { crearServidor, type Limites } from '../src/servidor.js'

export const prisma = crearPrisma(process.env.DATABASE_URL_TEST)

/** Límites altos por defecto: si no, registrar seis usuarios en un test choca
 *  con el limitador de la puerta y el fallo no tiene nada que ver con lo que se
 *  estaba probando. Hay un test que sí los baja, a propósito. */
const LIMITES_TEST: Limites = { global: 10_000, puerta: 10_000 }

export async function crearApp(limites: Limites = LIMITES_TEST): Promise<FastifyInstance> {
  return crearServidor({ prisma, configuracion: leerConfiguracion(), registro: false, limites })
}

/** Vacía la base de datos de test. Se llama entre tests, nunca contra la de desarrollo. */
export async function limpiarBd(): Promise<void> {
  const tablas = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `
  if (tablas.length === 0) return
  const lista = tablas.map((t) => `"public"."${t.tablename}"`).join(', ')
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${lista} RESTART IDENTITY CASCADE`)
}

export interface Cuenta {
  cookie: string
  usuarioId: string
  email: string
  espacioPersonalId: string
}

/** Registra a alguien y devuelve su cookie ya lista para las siguientes peticiones. */
export async function registrar(
  app: FastifyInstance,
  email: string,
  contrasena = 'una frase larga y tranquila',
  nombre = 'Persona de prueba',
): Promise<Cuenta> {
  const respuesta = await app.inject({
    method: 'POST',
    url: '/api/auth/registro',
    payload: { email, nombre, contrasena },
  })
  if (respuesta.statusCode !== 201) {
    throw new Error(`No se pudo registrar a ${email}: ${respuesta.statusCode} ${respuesta.body}`)
  }
  const cuerpo = respuesta.json() as {
    usuario: { id: string; email: string }
    espacios: { id: string; tipo: string }[]
  }
  const galleta = respuesta.cookies.find((c) => c.name === COOKIE_SESION)
  if (!galleta) throw new Error('El registro no devolvió cookie de sesión')

  const personal = cuerpo.espacios.find((e) => e.tipo === 'personal')
  if (!personal) throw new Error('El registro no creó el espacio personal')

  return {
    cookie: `${COOKIE_SESION}=${galleta.value}`,
    usuarioId: cuerpo.usuario.id,
    email: cuerpo.usuario.email,
    espacioPersonalId: personal.id,
  }
}

/** Crea un espacio compartido del que `cuenta` es propietaria. */
export async function crearEspacioDe(
  app: FastifyInstance,
  cuenta: Cuenta,
  nombre = 'Casa',
  tipo: 'pareja' | 'negocio' = 'pareja',
): Promise<string> {
  const respuesta = await app.inject({
    method: 'POST',
    url: '/api/espacios',
    headers: { cookie: cuenta.cookie },
    payload: { nombre, tipo },
  })
  if (respuesta.statusCode !== 201) {
    throw new Error(`No se pudo crear el espacio: ${respuesta.statusCode} ${respuesta.body}`)
  }
  return (respuesta.json() as { espacio: { id: string } }).espacio.id
}
