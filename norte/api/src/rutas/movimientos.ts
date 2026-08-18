import { esCuentaVisiblePara, resumir, validarMovimiento } from '@norte/dominio'
import type { Prisma, PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { exigirEspacio } from '../acceso.js'
import { datosInvalidos, noEncontrado } from '../errores.js'
import { usuarioDe } from '../servidor.js'

const esquemaMovimiento = z.object({
  cuentaId: z.string().min(1),
  categoriaId: z.string().nullish(),
  importe: z.number().int('El importe va en céntimos enteros.'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha va como aaaa-mm-dd.'),
  concepto: z.string().trim().min(1).max(200),
  comercio: z.string().max(120).nullish(),
  notas: z.string().max(2000).nullish(),
  etiquetas: z.array(z.string().max(40)).max(20).default([]),
  estado: z.enum(['previsto', 'confirmado']).default('confirmado'),
  esCompartido: z.boolean().default(false),
})

const esquemaFiltros = z.object({
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  cuentaId: z.string().optional(),
  categoriaId: z.string().optional(),
  estado: z.enum(['previsto', 'confirmado']).optional(),
  texto: z.string().max(120).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(200).default(50),
})

export async function rutasMovimientos(app: FastifyInstance, opciones: { prisma: PrismaClient }) {
  const { prisma } = opciones

  /** Las cuentas que este usuario puede ver, que son las únicas de las que
   *  puede ver o crear movimientos. */
  async function cuentasVisibles(espacioId: string, usuarioId: string) {
    const cuentas = await prisma.cuenta.findMany({
      where: { espacioId, borradaEn: null },
      select: { id: true, propietarioId: true, visibleEnEspacio: true },
    })
    return cuentas.filter((c) => esCuentaVisiblePara(c, usuarioId)).map((c) => c.id)
  }

  app.get('/api/espacios/:id/movimientos', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'lector')
    const filtros = esquemaFiltros.parse(peticion.query)

    const permitidas = await cuentasVisibles(contexto.espacioId, usuario.id)
    // Si pide una cuenta concreta, se cruza con las que puede ver: pedir el id
    // de una cuenta ajena no puede ser una forma de leerla.
    const cuentas = filtros.cuentaId
      ? permitidas.filter((c) => c === filtros.cuentaId)
      : permitidas

    const donde: Prisma.MovimientoWhereInput = {
      espacioId: contexto.espacioId,
      borradoEn: null,
      cuentaId: { in: cuentas },
      ...(filtros.categoriaId ? { categoriaId: filtros.categoriaId } : {}),
      ...(filtros.estado ? { estado: filtros.estado } : {}),
      ...(filtros.desde || filtros.hasta
        ? {
            fecha: {
              ...(filtros.desde ? { gte: new Date(filtros.desde) } : {}),
              ...(filtros.hasta ? { lte: new Date(filtros.hasta) } : {}),
            },
          }
        : {}),
      ...(filtros.texto
        ? {
            OR: [
              { concepto: { contains: filtros.texto, mode: 'insensitive' } },
              { comercio: { contains: filtros.texto, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const [movimientos, total, todos] = await Promise.all([
      prisma.movimiento.findMany({
        where: donde,
        orderBy: [{ fecha: 'desc' }, { creadoEn: 'desc' }],
        skip: (filtros.pagina - 1) * filtros.porPagina,
        take: filtros.porPagina,
        include: { categoria: { select: { id: true, nombre: true } } },
      }),
      prisma.movimiento.count({ where: donde }),
      // El resumen es del filtro entero, no de la página que se está viendo:
      // «has gastado 320 €» tiene que ser de agosto, no de las 50 primeras filas.
      prisma.movimiento.findMany({ where: donde, select: { importe: true, estado: true } }),
    ])

    return {
      movimientos: movimientos.map(formatear),
      total,
      pagina: filtros.pagina,
      resumen: resumir(todos.map((m) => ({ importe: Number(m.importe), estado: m.estado }))),
    }
  })

  app.post('/api/espacios/:id/movimientos', async (peticion, respuesta) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')
    const datos = esquemaMovimiento.parse(peticion.body)

    await comprobarCuentaYCategoria(contexto.espacioId, usuario.id, datos.cuentaId, datos.categoriaId)

    // Las reglas del movimiento las pone el dominio, no la ruta: así son las
    // mismas aquí, en la importación de extractos y en la entrada rápida.
    const validacion = validarMovimiento(
      { importe: datos.importe, fecha: datos.fecha, concepto: datos.concepto, cuentaId: datos.cuentaId },
      new Date(),
    )
    if (!validacion.valido) throw datosInvalidos(validacion.mensaje, { campo: validacion.campo })

    const movimiento = await prisma.movimiento.create({
      data: {
        espacioId: contexto.espacioId,
        cuentaId: datos.cuentaId,
        categoriaId: datos.categoriaId ?? null,
        importe: BigInt(datos.importe),
        importeBase: BigInt(datos.importe),
        fecha: new Date(datos.fecha),
        concepto: datos.concepto,
        comercio: datos.comercio ?? null,
        notas: datos.notas ?? null,
        etiquetas: datos.etiquetas,
        estado: datos.estado,
        esCompartido: datos.esCompartido,
      },
      include: { categoria: { select: { id: true, nombre: true } } },
    })
    return respuesta.code(201).send({ movimiento: formatear(movimiento) })
  })

  app.patch('/api/espacios/:id/movimientos/:movimientoId', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id, movimientoId } = peticion.params as { id: string; movimientoId: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')
    const datos = esquemaMovimiento.partial().parse(peticion.body)

    const actual = await prisma.movimiento.findFirst({
      where: { id: movimientoId, espacioId: contexto.espacioId, borradoEn: null },
    })
    if (!actual) throw noEncontrado('Ese movimiento no existe en este espacio.')

    const permitidas = await cuentasVisibles(contexto.espacioId, usuario.id)
    if (!permitidas.includes(actual.cuentaId)) {
      throw noEncontrado('Ese movimiento no existe en este espacio.')
    }

    await comprobarCuentaYCategoria(
      contexto.espacioId,
      usuario.id,
      datos.cuentaId ?? actual.cuentaId,
      datos.categoriaId,
    )

    const validacion = validarMovimiento(
      {
        importe: datos.importe ?? Number(actual.importe),
        fecha: datos.fecha ?? actual.fecha.toISOString().slice(0, 10),
        concepto: datos.concepto ?? actual.concepto,
        cuentaId: datos.cuentaId ?? actual.cuentaId,
      },
      new Date(),
    )
    if (!validacion.valido) throw datosInvalidos(validacion.mensaje, { campo: validacion.campo })

    const movimiento = await prisma.movimiento.update({
      where: { id: actual.id },
      data: {
        ...(datos.cuentaId !== undefined ? { cuentaId: datos.cuentaId } : {}),
        ...(datos.categoriaId !== undefined ? { categoriaId: datos.categoriaId ?? null } : {}),
        ...(datos.importe !== undefined
          ? { importe: BigInt(datos.importe), importeBase: BigInt(datos.importe) }
          : {}),
        ...(datos.fecha !== undefined ? { fecha: new Date(datos.fecha) } : {}),
        ...(datos.concepto !== undefined ? { concepto: datos.concepto } : {}),
        ...(datos.comercio !== undefined ? { comercio: datos.comercio ?? null } : {}),
        ...(datos.notas !== undefined ? { notas: datos.notas ?? null } : {}),
        ...(datos.etiquetas !== undefined ? { etiquetas: datos.etiquetas } : {}),
        ...(datos.estado !== undefined ? { estado: datos.estado } : {}),
        ...(datos.esCompartido !== undefined ? { esCompartido: datos.esCompartido } : {}),
      },
      include: { categoria: { select: { id: true, nombre: true } } },
    })
    return { movimiento: formatear(movimiento) }
  })

  /** A la papelera: 30 días para recuperarlo, como promete el encargo. */
  app.delete('/api/espacios/:id/movimientos/:movimientoId', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id, movimientoId } = peticion.params as { id: string; movimientoId: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')

    const permitidas = await cuentasVisibles(contexto.espacioId, usuario.id)
    const { count } = await prisma.movimiento.updateMany({
      where: {
        id: movimientoId,
        espacioId: contexto.espacioId,
        cuentaId: { in: permitidas },
        borradoEn: null,
      },
      data: { borradoEn: new Date() },
    })
    if (count === 0) throw noEncontrado('Ese movimiento no existe en este espacio.')
    return { ok: true }
  })

  /**
   * Que la cuenta y la categoría sean **de este espacio y visibles para quien
   * escribe**. Sin esto, mandar el id de una cuenta ajena metería un movimiento
   * en las cuentas de otro.
   */
  async function comprobarCuentaYCategoria(
    espacioId: string,
    usuarioId: string,
    cuentaId: string,
    categoriaId?: string | null,
  ) {
    const cuenta = await prisma.cuenta.findFirst({
      where: { id: cuentaId, espacioId, borradaEn: null },
    })
    if (!cuenta || !esCuentaVisiblePara(cuenta, usuarioId)) {
      throw noEncontrado('Esa cuenta no existe en este espacio.')
    }
    if (categoriaId) {
      const categoria = await prisma.categoria.findFirst({
        where: { id: categoriaId, espacioId, borradaEn: null },
      })
      if (!categoria) throw noEncontrado('Esa categoría no existe en este espacio.')
    }
  }
}

function formatear(m: {
  id: string
  cuentaId: string
  categoriaId: string | null
  importe: bigint
  fecha: Date
  concepto: string
  comercio: string | null
  notas: string | null
  etiquetas: string[]
  estado: string
  esCompartido: boolean
  categoria?: { id: string; nombre: string } | null
}) {
  return {
    id: m.id,
    cuentaId: m.cuentaId,
    categoriaId: m.categoriaId,
    categoria: m.categoria?.nombre ?? null,
    importe: Number(m.importe),
    // Fecha local en aaaa-mm-dd: en la base es `date`, sin hora ni huso.
    fecha: m.fecha.toISOString().slice(0, 10),
    concepto: m.concepto,
    comercio: m.comercio,
    notas: m.notas,
    etiquetas: m.etiquetas,
    estado: m.estado,
    esCompartido: m.esCompartido,
  }
}
