import { generateKeyPairSync } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import type { CargaLicencia } from '@norte/dominio'
import { crearPrisma } from '../src/bd.js'
import { firmarClave } from '../src/licencia/clave.js'
import { olvidarLicencia } from '../src/licencia/estado.js'
import { cifrarContrasena } from '../src/auth/contrasena.js'
import { COOKIE_SESION } from '../src/auth/sesiones.js'
import { crearEspacio } from '../src/espacios/crear.js'
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

/**
 * Par de claves de licencia **solo para los tests**. Se genera aquí y se
 * anuncia por la variable de entorno, así que la clave privada de verdad —la
 * que emite licencias que valen dinero— no tiene que existir en este
 * repositorio para poder probar el licenciamiento.
 */
const { publicKey: publicaTest, privateKey: privadaTest } = generateKeyPairSync('ed25519')
{
  const spki = publicaTest.export({ type: 'spki', format: 'der' })
  process.env.NORTE_CLAVE_LICENCIAS = spki.subarray(spki.length - 32).toString('base64url')
}

export function claveDePrueba(extra: Partial<CargaLicencia> = {}): string {
  return firmarClave(
    {
      id: 'lic_test',
      plan: 'negocio',
      titular: 'Pruebas',
      emitidaEn: '2026-01-01',
      caducaEn: null,
      maxUsuarios: 50,
      ...extra,
    },
    privadaTest,
  )
}

/**
 * Deja la instalación licenciada de par en par.
 *
 * Se hace en `limpiarBd` porque **casi todos los tests dan de alta a varias
 * personas**, y una instalación con varias personas es, por definición, una
 * instalación licenciada. Sin esto los tests pasarían hoy y empezarían a
 * fallar el día que la fecha de anterioridad quedara atrás — que es la peor
 * clase de test: el que se cae solo un martes cualquiera. Los límites de la
 * licencia se prueban a propósito en `licencia.test.ts`.
 */
async function licenciarInstalacion(): Promise<void> {
  const clave = claveDePrueba()
  await prisma.licencia.create({
    data: {
      clave,
      plan: 'negocio',
      titular: 'Pruebas',
      emitidaEn: new Date('2026-01-01T00:00:00.000Z'),
      maxUsuarios: 50,
    },
  })
  olvidarLicencia()
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
  await licenciarInstalacion()
}

/** Deja la instalación SIN licencia, para probar qué pasa entonces. */
export async function quitarLicencia(): Promise<void> {
  await prisma.licencia.deleteMany({})
  olvidarLicencia()
}

export interface Cuenta {
  cookie: string
  usuarioId: string
  email: string
  espacioPersonalId: string
}

/**
 * Da de alta a alguien y devuelve su cookie lista para las siguientes
 * peticiones.
 *
 * Desde que el registro se cerró, **solo la primera cuenta puede crearse por la
 * API sin invitación**. Para las demás, este ayudante crea el usuario por
 * dentro (con las mismas funciones que usa el servidor) y entra por la puerta
 * normal para conseguir la cookie. Así los tests de aislamiento siguen
 * hablando de lo suyo en vez de montar una invitación cada vez; de la puerta se
 * ocupa `registro.test.ts`, que es su sitio.
 */
export async function registrar(
  app: FastifyInstance,
  email: string,
  contrasena = 'una frase larga y tranquila',
  nombre = 'Persona de prueba',
): Promise<Cuenta> {
  const esLaPrimera = (await prisma.usuario.count({ where: { borradoEn: null } })) === 0

  if (esLaPrimera) {
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

  const usuario = await prisma.usuario.create({
    data: { email, nombre, hashContrasena: await cifrarContrasena(contrasena) },
  })
  const personal = await crearEspacio(prisma, {
    usuarioId: usuario.id,
    nombre: 'Personal',
    tipo: 'personal',
  })
  return {
    ...(await entrar(app, email, contrasena)),
    usuarioId: usuario.id,
    email: usuario.email,
    espacioPersonalId: personal.id,
  }
}

/** Entra por la puerta normal y devuelve la cookie. */
export async function entrar(
  app: FastifyInstance,
  email: string,
  contrasena = 'una frase larga y tranquila',
): Promise<{ cookie: string }> {
  const respuesta = await app.inject({
    method: 'POST',
    url: '/api/auth/entrar',
    payload: { email, contrasena },
  })
  if (respuesta.statusCode !== 200) {
    throw new Error(`No se pudo entrar como ${email}: ${respuesta.statusCode} ${respuesta.body}`)
  }
  const galleta = respuesta.cookies.find((c) => c.name === COOKIE_SESION)
  if (!galleta) throw new Error('La entrada no devolvió cookie de sesión')
  return { cookie: `${COOKIE_SESION}=${galleta.value}` }
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
