import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { datosInvalidos, sinPermiso } from '../errores.js'
import { leerClave } from '../licencia/clave.js'
import { estadoDeLicencia, olvidarLicencia } from '../licencia/estado.js'
import { usuarioDe } from '../servidor.js'

/**
 * La licencia de la instalación.
 *
 * **Todo el mundo puede leer el estado**: si tu cuenta está en solo lectura
 * tienes derecho a saber por qué, y a quién decírselo. Cambiarla es cosa del
 * dueño de la instalación —el usuario más antiguo, el único que pudo crearse
 * sin invitación—, igual que las copias de seguridad.
 */
export async function rutasLicencia(app: FastifyInstance, opciones: { prisma: PrismaClient }) {
  const { prisma } = opciones

  async function esElDueno(usuarioId: string): Promise<boolean> {
    const primero = await prisma.usuario.findFirst({
      where: { borradoEn: null },
      orderBy: { creadoEn: 'asc' },
      select: { id: true },
    })
    return primero?.id === usuarioId
  }

  app.get('/api/licencia', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const estado = await estadoDeLicencia(prisma)
    return {
      ...estado,
      // No se devuelve la clave: no hace falta para nada en la interfaz y en
      // los registros del navegador es una cadena que abre puertas.
      soyElDueno: await esElDueno(usuario.id),
      puedoEscribir: !estado.soloLectura.includes(usuario.id),
    }
  })

  app.post('/api/licencia', async (peticion) => {
    const usuario = usuarioDe(peticion)
    if (!(await esElDueno(usuario.id))) {
      throw sinPermiso('Solo quien instaló Norte puede cambiar la licencia.')
    }

    const { clave } = z.object({ clave: z.string().trim().min(1).max(4000) }).parse(peticion.body)
    const carga = leerClave(clave)
    if (!carga) {
      throw datosInvalidos(
        'Esa clave no es válida. Cópiala entera, incluido el «NORTE-1» del principio.',
      )
    }

    // Una instalación tiene UNA licencia. Guardar varias obligaría a inventar
    // cuál manda, y la respuesta «la más nueva» se rompe en cuanto alguien
    // reinstala una perpetua vieja después de probar una de prueba.
    await prisma.$transaction([
      prisma.licencia.deleteMany({}),
      prisma.licencia.create({
        data: {
          clave,
          plan: carga.plan,
          titular: carga.titular,
          email: carga.email ?? null,
          emitidaEn: new Date(`${carga.emitidaEn}T00:00:00.000Z`),
          caducaEn: carga.caducaEn ? new Date(`${carga.caducaEn}T00:00:00.000Z`) : null,
          maxUsuarios: carga.maxUsuarios,
        },
      }),
    ])

    olvidarLicencia()
    return { estado: await estadoDeLicencia(prisma) }
  })
}
