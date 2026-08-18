import { esCuentaVisiblePara, fechasDe, proximaFecha, type Periodicidad } from '@norte/dominio'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { exigirEspacio } from '../acceso.js'
import { datosInvalidos, noEncontrado } from '../errores.js'
import { usuarioDe } from '../servidor.js'

const PERIODICIDADES = [
  'semanal',
  'quincenal',
  'mensual',
  'bimestral',
  'trimestral',
  'semestral',
  'anual',
] as const

const esquemaRegla = z.object({
  cuentaId: z.string().min(1),
  categoriaId: z.string().nullish(),
  concepto: z.string().trim().min(1).max(200),
  importe: z.number().int().refine((v) => v !== 0, 'El importe no puede ser cero.'),
  periodicidad: z.enum(PERIODICIDADES).default('mensual'),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  diaDelMes: z.number().int().min(1).max(31).nullish(),
  ultimoDiaHabil: z.boolean().default(false),
  activa: z.boolean().default(true),
})

/** Hasta dónde se generan previstos si no se dice otra cosa. Dos meses cubren
 *  la proyección a 30 días con margen y no llenan la tabla de futuro inútil. */
const DIAS_POR_DEFECTO = 60

export async function rutasRecurrentes(app: FastifyInstance, opciones: { prisma: PrismaClient }) {
  const { prisma } = opciones

  async function exigirCuentaVisible(espacioId: string, usuarioId: string, cuentaId: string) {
    const cuenta = await prisma.cuenta.findFirst({
      where: { id: cuentaId, espacioId, borradaEn: null },
    })
    if (!cuenta || !esCuentaVisiblePara(cuenta, usuarioId)) {
      throw noEncontrado('Esa cuenta no existe en este espacio.')
    }
  }

  app.get('/api/espacios/:id/recurrentes', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'lector')

    const cuentas = await prisma.cuenta.findMany({
      where: { espacioId: contexto.espacioId, borradaEn: null },
      select: { id: true, propietarioId: true, visibleEnEspacio: true },
    })
    const visibles = cuentas.filter((c) => esCuentaVisiblePara(c, usuario.id)).map((c) => c.id)

    const reglas = await prisma.reglaRecurrente.findMany({
      where: { espacioId: contexto.espacioId, borradaEn: null, cuentaId: { in: visibles } },
      orderBy: { creadaEn: 'asc' },
      include: { categoria: { select: { nombre: true } } },
    })

    const hoy = new Date()
    return {
      recurrentes: reglas.map((r) => ({
        id: r.id,
        cuentaId: r.cuentaId,
        categoriaId: r.categoriaId,
        categoria: r.categoria?.nombre ?? null,
        concepto: r.concepto,
        importe: Number(r.importe),
        periodicidad: r.periodicidad,
        desde: r.desde.toISOString().slice(0, 10),
        hasta: r.hasta ? r.hasta.toISOString().slice(0, 10) : null,
        diaDelMes: r.diaDelMes,
        ultimoDiaHabil: r.ultimoDiaHabil,
        activa: r.activa,
        // Lo que de verdad se quiere saber de una recurrente: cuándo toca.
        proxima: r.activa ? proximaFecha(aRegla(r), hoy) : null,
      })),
    }
  })

  app.post('/api/espacios/:id/recurrentes', async (peticion, respuesta) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')
    const datos = esquemaRegla.parse(peticion.body)
    await exigirCuentaVisible(contexto.espacioId, usuario.id, datos.cuentaId)

    if (datos.categoriaId) {
      const categoria = await prisma.categoria.findFirst({
        where: { id: datos.categoriaId, espacioId: contexto.espacioId, borradaEn: null },
      })
      if (!categoria) throw noEncontrado('Esa categoría no existe en este espacio.')
    }
    if (datos.hasta && datos.hasta < datos.desde) {
      throw datosInvalidos('La fecha de fin no puede ser anterior a la de inicio.')
    }

    const regla = await prisma.reglaRecurrente.create({
      data: {
        espacioId: contexto.espacioId,
        cuentaId: datos.cuentaId,
        categoriaId: datos.categoriaId ?? null,
        concepto: datos.concepto,
        importe: BigInt(datos.importe),
        periodicidad: datos.periodicidad,
        desde: new Date(datos.desde),
        hasta: datos.hasta ? new Date(datos.hasta) : null,
        diaDelMes: datos.diaDelMes ?? null,
        ultimoDiaHabil: datos.ultimoDiaHabil,
        activa: datos.activa,
      },
    })
    return respuesta.code(201).send({ recurrente: { id: regla.id } })
  })

  app.patch('/api/espacios/:id/recurrentes/:reglaId', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id, reglaId } = peticion.params as { id: string; reglaId: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')
    const datos = esquemaRegla.partial().parse(peticion.body)

    const actual = await prisma.reglaRecurrente.findFirst({
      where: { id: reglaId, espacioId: contexto.espacioId, borradaEn: null },
    })
    if (!actual) throw noEncontrado('Esa recurrente no existe en este espacio.')
    await exigirCuentaVisible(contexto.espacioId, usuario.id, datos.cuentaId ?? actual.cuentaId)

    const regla = await prisma.reglaRecurrente.update({
      where: { id: actual.id },
      data: {
        ...(datos.cuentaId !== undefined ? { cuentaId: datos.cuentaId } : {}),
        ...(datos.categoriaId !== undefined ? { categoriaId: datos.categoriaId ?? null } : {}),
        ...(datos.concepto !== undefined ? { concepto: datos.concepto } : {}),
        ...(datos.importe !== undefined ? { importe: BigInt(datos.importe) } : {}),
        ...(datos.periodicidad !== undefined ? { periodicidad: datos.periodicidad } : {}),
        ...(datos.desde !== undefined ? { desde: new Date(datos.desde) } : {}),
        ...(datos.hasta !== undefined ? { hasta: datos.hasta ? new Date(datos.hasta) : null } : {}),
        ...(datos.diaDelMes !== undefined ? { diaDelMes: datos.diaDelMes ?? null } : {}),
        ...(datos.ultimoDiaHabil !== undefined ? { ultimoDiaHabil: datos.ultimoDiaHabil } : {}),
        ...(datos.activa !== undefined ? { activa: datos.activa } : {}),
      },
    })
    return { recurrente: { id: regla.id } }
  })

  app.delete('/api/espacios/:id/recurrentes/:reglaId', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id, reglaId } = peticion.params as { id: string; reglaId: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')

    const { count } = await prisma.reglaRecurrente.updateMany({
      where: { id: reglaId, espacioId: contexto.espacioId, borradaEn: null },
      data: { borradaEn: new Date(), activa: false },
    })
    if (count === 0) throw noEncontrado('Esa recurrente no existe en este espacio.')

    // Los previstos que generó y que aún no han pasado se van con ella; los ya
    // confirmados se quedan, porque eso ya ocurrió de verdad.
    await prisma.movimiento.updateMany({
      where: { reglaId, estado: 'previsto', borradoEn: null },
      data: { borradoEn: new Date() },
    })
    return { ok: true }
  })

  /**
   * Materializa los movimientos **previstos** de las reglas activas.
   *
   * Es idempotente por construcción: cada previsto lleva un `idExterno` con la
   * regla y su fecha, y la base de datos tiene un índice único por cuenta e
   * `idExterno`. Llamarlo dos veces —o diez— no duplica nada, que es justo lo
   * que hace falta si un día esto lo dispara un temporizador.
   */
  app.post('/api/espacios/:id/recurrentes/generar', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')
    const { hasta } = z
      .object({ hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })
      .parse(peticion.body ?? {})

    const desde = new Date()
    const fin = hasta
      ? new Date(hasta)
      : new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + DIAS_POR_DEFECTO)

    const reglas = await prisma.reglaRecurrente.findMany({
      where: { espacioId: contexto.espacioId, borradaEn: null, activa: true },
    })

    const pendientes = reglas.flatMap((regla) =>
      fechasDe(aRegla(regla), desde, fin).map((fecha) => ({
        espacioId: contexto.espacioId,
        cuentaId: regla.cuentaId,
        categoriaId: regla.categoriaId,
        reglaId: regla.id,
        importe: regla.importe,
        importeBase: regla.importe,
        fecha: new Date(fecha),
        concepto: regla.concepto,
        estado: 'previsto' as const,
        idExterno: `recurrente:${regla.id}:${fecha}`,
      })),
    )

    // `skipDuplicates` es lo que convierte esto en idempotente de verdad: los
    // que ya existen se ignoran en vez de reventar la inserción entera.
    const { count } = await prisma.movimiento.createMany({ data: pendientes, skipDuplicates: true })
    return { creados: count, revisados: pendientes.length }
  })
}

function aRegla(r: {
  periodicidad: string
  desde: Date
  hasta: Date | null
  diaDelMes: number | null
  ultimoDiaHabil: boolean
}) {
  return {
    periodicidad: r.periodicidad as Periodicidad,
    desde: r.desde.toISOString().slice(0, 10),
    hasta: r.hasta ? r.hasta.toISOString().slice(0, 10) : null,
    diaDelMes: r.diaDelMes,
    ultimoDiaHabil: r.ultimoDiaHabil,
  }
}
