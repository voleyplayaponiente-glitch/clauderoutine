import { admiteMiembros, esTipoEspacio, TIPOS_ESPACIO } from '@norte/dominio'
import type { Configuracion } from '../configuracion.js'
import { crearInvitacion } from '../invitaciones.js'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { espaciosDe, exigirEspacio } from '../acceso.js'
import { conflicto, datosInvalidos, noEncontrado, sinPermiso } from '../errores.js'
import { crearEspacio } from '../espacios/crear.js'
import { usuarioDe } from '../servidor.js'

const esquemaEspacio = z.object({
  nombre: z.string().trim().min(1, 'El espacio necesita un nombre.').max(80),
  tipo: z.enum(TIPOS_ESPACIO as unknown as [string, ...string[]]),
})

const esquemaCategoria = z.object({
  nombre: z.string().trim().min(1, 'La categoría necesita un nombre.').max(80),
  padreId: z.string().nullish(),
  flujo: z.enum(['gasto', 'ingreso']).default('gasto'),
  tipo: z.enum(['fijo', 'variable', 'discrecional']).default('variable'),
  esencial: z.boolean().default(false),
  icono: z.string().max(40).nullish(),
})

const esquemaInvitacion = z.object({
  // Sin correo, la invitación vale para quien tenga el enlace (un solo uso).
  // Con correo, solo para esa persona.
  email: z.string().email('Ese correo no parece válido.').optional(),
  rol: z.enum(['editor', 'lector']).default('editor'),
})

const esquemaMiembro = z.object({
  email: z.string().email('Ese correo no parece válido.'),
  rol: z.enum(['editor', 'lector']).default('editor'),
})

export async function rutasEspacios(
  app: FastifyInstance,
  opciones: { prisma: PrismaClient; configuracion: Configuracion },
) {
  const { prisma, configuracion } = opciones

  app.get('/api/espacios', async (peticion) => {
    const usuario = usuarioDe(peticion)
    return { espacios: await espaciosDe(prisma, usuario.id) }
  })

  app.post('/api/espacios', async (peticion, respuesta) => {
    const usuario = usuarioDe(peticion)
    const datos = esquemaEspacio.parse(peticion.body)
    if (!esTipoEspacio(datos.tipo)) throw datosInvalidos('Ese tipo de espacio no existe.')

    const espacio = await crearEspacio(prisma, {
      usuarioId: usuario.id,
      nombre: datos.nombre,
      tipo: datos.tipo,
    })
    return respuesta.code(201).send({ espacio: { id: espacio.id, nombre: espacio.nombre, tipo: espacio.tipo } })
  })

  app.get('/api/espacios/:id', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'lector')

    const espacio = await prisma.espacio.findUnique({
      where: { id: contexto.espacioId },
      include: {
        miembros: {
          where: { bajaEn: null },
          include: { usuario: { select: { id: true, nombre: true, email: true } } },
        },
      },
    })
    if (!espacio) throw noEncontrado('Ese espacio no existe o no tienes acceso.')

    return {
      espacio: {
        id: espacio.id,
        nombre: espacio.nombre,
        tipo: espacio.tipo,
        divisaBase: espacio.divisaBase,
        rol: contexto.rol,
        miembros: espacio.miembros.map((m) => ({
          usuarioId: m.usuarioId,
          nombre: m.usuario.nombre,
          email: m.usuario.email,
          rol: m.rol,
          participacion: Number(m.participacion),
        })),
      },
    }
  })

  app.get('/api/espacios/:id/categorias', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'lector')

    const categorias = await prisma.categoria.findMany({
      // El `espacioId` del contexto, nunca el de la URL sin comprobar: es la
      // diferencia entre filtrar por lo que se ha autorizado y por lo que te
      // han pedido.
      where: { espacioId: contexto.espacioId, borradaEn: null },
      orderBy: [{ padreId: { sort: 'asc', nulls: 'first' } }, { orden: 'asc' }],
    })
    return { categorias }
  })

  app.post('/api/espacios/:id/categorias', async (peticion, respuesta) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')
    const datos = esquemaCategoria.parse(peticion.body)

    if (datos.padreId) {
      // Una categoría madre de OTRO espacio colaría datos ajenos por la puerta
      // de atrás. Se comprueba que el padre sea de este espacio.
      const padre = await prisma.categoria.findFirst({
        where: { id: datos.padreId, espacioId: contexto.espacioId, borradaEn: null },
      })
      if (!padre) throw noEncontrado('Esa categoría madre no existe en este espacio.')
      if (padre.padreId) throw datosInvalidos('Las categorías solo admiten un nivel de subcategorías.')
    }

    const repetida = await prisma.categoria.findFirst({
      where: {
        espacioId: contexto.espacioId,
        padreId: datos.padreId ?? null,
        nombre: datos.nombre,
        borradaEn: null,
      },
    })
    if (repetida) throw conflicto('Ya tienes una categoría con ese nombre ahí.')

    const categoria = await prisma.categoria.create({
      data: {
        espacioId: contexto.espacioId,
        padreId: datos.padreId ?? null,
        nombre: datos.nombre,
        flujo: datos.flujo,
        tipo: datos.tipo,
        esencial: datos.esencial,
        icono: datos.icono ?? null,
      },
    })
    return respuesta.code(201).send({ categoria })
  })

  app.post('/api/espacios/:id/miembros', async (peticion, respuesta) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'propietario')
    const datos = esquemaMiembro.parse(peticion.body)

    const espacio = await prisma.espacio.findUniqueOrThrow({ where: { id: contexto.espacioId } })
    if (!admiteMiembros(espacio.tipo)) {
      throw sinPermiso(
        'Un espacio personal es solo tuyo. Crea uno de pareja o de negocio para compartir.',
      )
    }

    const invitado = await prisma.usuario.findFirst({
      where: { email: datos.email.trim().toLowerCase(), borradoEn: null },
    })
    if (!invitado) throw noEncontrado('No hay ninguna cuenta con ese correo en esta instalación.')

    const yaEsta = await prisma.miembroEspacio.findUnique({
      where: { espacioId_usuarioId: { espacioId: contexto.espacioId, usuarioId: invitado.id } },
    })
    if (yaEsta && !yaEsta.bajaEn) throw conflicto('Esa persona ya está en el espacio.')

    const miembro = yaEsta
      ? await prisma.miembroEspacio.update({
          where: { id: yaEsta.id },
          data: { rol: datos.rol, bajaEn: null },
        })
      : await prisma.miembroEspacio.create({
          data: { espacioId: contexto.espacioId, usuarioId: invitado.id, rol: datos.rol },
        })

    await prisma.registroActividad.create({
      data: {
        espacioId: contexto.espacioId,
        usuarioId: usuario.id,
        accion: 'alta_miembro',
        entidad: 'miembro',
        entidadId: miembro.id,
        detalle: { email: invitado.email, rol: datos.rol },
      },
    })

    return respuesta.code(201).send({
      miembro: { usuarioId: invitado.id, nombre: invitado.nombre, email: invitado.email, rol: miembro.rol },
    })
  })

  // ───────────────────────────── Invitaciones
  //
  // Es la única puerta de entrada a esta instalación desde que el registro
  // dejó de estar abierto: la primera cuenta es libre y el resto entra por
  // aquí. Solo el propietario del espacio puede abrirla.

  app.post('/api/espacios/:id/invitaciones', async (peticion, respuesta) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'propietario')
    const datos = esquemaInvitacion.parse(peticion.body)

    const espacio = await prisma.espacio.findUniqueOrThrow({ where: { id: contexto.espacioId } })
    if (!admiteMiembros(espacio.tipo)) {
      throw sinPermiso(
        'Un espacio personal es solo tuyo. Crea uno de pareja o de negocio para compartir.',
      )
    }

    if (datos.email) {
      const yaEsta = await prisma.miembroEspacio.findFirst({
        where: {
          espacioId: contexto.espacioId,
          bajaEn: null,
          usuario: { email: datos.email.trim().toLowerCase() },
        },
      })
      if (yaEsta) throw conflicto('Esa persona ya está en el espacio.')
    }

    const { token, invitacion } = await crearInvitacion(prisma, configuracion.secretoSesion, {
      espacioId: contexto.espacioId,
      invitadaPorId: usuario.id,
      email: datos.email ?? null,
      rol: datos.rol,
    })

    await prisma.registroActividad.create({
      data: {
        espacioId: contexto.espacioId,
        usuarioId: usuario.id,
        accion: 'crear_invitacion',
        entidad: 'invitacion',
        entidadId: invitacion.id,
        detalle: { email: datos.email ?? null, rol: datos.rol },
      },
    })

    // El testigo se devuelve **una sola vez**, aquí. En la base de datos solo
    // queda su HMAC, así que ni listándolas después se puede recuperar: si se
    // pierde el enlace, se anula y se hace otro.
    return respuesta.code(201).send({
      invitacion: { id: invitacion.id, rol: invitacion.rol, expiraEn: invitacion.expiraEn },
      ruta: `#/invitacion/${token}`,
    })
  })

  app.get('/api/espacios/:id/invitaciones', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'propietario')

    const invitaciones = await prisma.invitacion.findMany({
      where: { espacioId: contexto.espacioId, aceptadaEn: null, revocadaEn: null },
      orderBy: { creadaEn: 'desc' },
      select: { id: true, email: true, rol: true, creadaEn: true, expiraEn: true },
    })
    return { invitaciones }
  })

  app.delete('/api/espacios/:id/invitaciones/:invitacionId', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id, invitacionId } = peticion.params as { id: string; invitacionId: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'propietario')

    // El `espacioId` del contexto en el `where`, no solo el id de la invitación:
    // si no, el propietario de un espacio podría anular invitaciones de otro.
    const { count } = await prisma.invitacion.updateMany({
      where: {
        id: invitacionId,
        espacioId: contexto.espacioId,
        aceptadaEn: null,
        revocadaEn: null,
      },
      data: { revocadaEn: new Date() },
    })
    if (count === 0) throw noEncontrado('Esa invitación no existe o ya no está pendiente.')
    return { ok: true }
  })

  app.delete('/api/espacios/:id/miembros/:usuarioId', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id, usuarioId } = peticion.params as { id: string; usuarioId: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'propietario')

    const miembro = await prisma.miembroEspacio.findUnique({
      where: { espacioId_usuarioId: { espacioId: contexto.espacioId, usuarioId } },
    })
    if (!miembro || miembro.bajaEn) throw noEncontrado('Esa persona no está en el espacio.')

    if (miembro.rol === 'propietario') {
      const propietarios = await prisma.miembroEspacio.count({
        where: { espacioId: contexto.espacioId, rol: 'propietario', bajaEn: null },
      })
      // Un espacio sin propietario no lo puede administrar nadie, ni siquiera
      // para recuperarlo. Se prohíbe quedarse sin ninguno.
      if (propietarios <= 1) throw conflicto('El espacio necesita al menos un propietario.')
    }

    // Baja lógica: quién estuvo y qué hizo sigue teniendo sentido en el registro
    // de actividad después de irse.
    await prisma.miembroEspacio.update({ where: { id: miembro.id }, data: { bajaEn: new Date() } })
    await prisma.registroActividad.create({
      data: {
        espacioId: contexto.espacioId,
        usuarioId: usuario.id,
        accion: 'baja_miembro',
        entidad: 'miembro',
        entidadId: miembro.id,
        detalle: { usuarioId },
      },
    })
    return { ok: true }
  })
}
