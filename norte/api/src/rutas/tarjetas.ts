import { cicloDe, ErrorTarjeta, simularAplazado, utilizacion } from '@norte/dominio'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { exigirEspacio } from '../acceso.js'
import { conflicto, datosInvalidos, noEncontrado } from '../errores.js'
import { usuarioDe } from '../servidor.js'

/**
 * Tarjetas de crédito.
 *
 * Cada tarjeta cuelga de una cuenta de tipo `tarjeta_credito`: los movimientos
 * ya viven ahí, así que el consumo del ciclo **se calcula**, no se teclea.
 */

const esquemaTarjeta = z.object({
  cuentaId: z.string().min(1),
  nombre: z.string().trim().min(1, 'La tarjeta necesita un nombre.').max(80),
  ultimos4: z.string().regex(/^\d{4}$/, 'Solo los cuatro últimos dígitos.').nullish(),
  limite: z.number().int().positive('El límite va en céntimos.'),
  diaCorte: z.number().int().min(1).max(31),
  diaPago: z.number().int().min(1).max(31),
  modalidad: z.enum(['pago_total', 'aplazado']).default('pago_total'),
  tin: z.number().min(0).max(100).nullish(),
  minimoPorcentaje: z.number().min(0).max(100).default(0),
  minimoSuelo: z.number().int().min(0).default(0),
})

const esquemaSimular = z.object({
  saldo: z.number().int().min(0, 'El saldo aplazado va en céntimos.'),
  tin: z.number().min(0).max(100).optional(),
  cuotaFija: z.number().int().positive().optional(),
  minimoPorcentaje: z.number().min(0).max(100).optional(),
  minimoSuelo: z.number().int().min(0).optional(),
})

export async function rutasTarjetas(app: FastifyInstance, opciones: { prisma: PrismaClient }) {
  const { prisma } = opciones

  async function buscarTarjeta(espacioId: string, tarjetaId: string) {
    const tarjeta = await prisma.tarjeta.findFirst({
      where: { id: tarjetaId, espacioId, borradaEn: null },
    })
    if (!tarjeta) throw noEncontrado('Esa tarjeta no existe en este espacio.')
    return tarjeta
  }

  /** Lo consumido en un tramo de fechas y el saldo dispuesto de la cuenta. */
  async function consumoDe(cuentaId: string, desde: string, hasta: string) {
    const [ciclo, total] = await Promise.all([
      prisma.movimiento.aggregate({
        where: {
          cuentaId,
          borradoEn: null,
          estado: 'confirmado',
          fecha: { gte: new Date(desde), lte: new Date(hasta) },
        },
        _sum: { importe: true },
      }),
      prisma.movimiento.aggregate({
        where: { cuentaId, borradoEn: null, estado: 'confirmado' },
        _sum: { importe: true },
      }),
    ])
    // En una cuenta de tarjeta el gasto es negativo; lo dispuesto es el saldo
    // en positivo. Si sale a favor, no hay nada dispuesto.
    return {
      consumidoCiclo: -Number(ciclo._sum.importe ?? 0),
      dispuesto: Math.max(0, -Number(total._sum.importe ?? 0)),
    }
  }

  async function estadoDe(tarjeta: {
    id: string
    cuentaId: string
    nombre: string
    ultimos4: string | null
    limite: bigint
    diaCorte: number
    diaPago: number
    modalidad: string
    tin: unknown
    minimoPorcentaje: unknown
    minimoSuelo: bigint
  }) {
    const ciclos = cicloDe({ diaCorte: tarjeta.diaCorte, diaPago: tarjeta.diaPago }, new Date())
    const { consumidoCiclo, dispuesto } = await consumoDe(
      tarjeta.cuentaId,
      ciclos.actual.desde,
      ciclos.actual.hasta,
    )
    const limite = Number(tarjeta.limite)

    return {
      id: tarjeta.id,
      cuentaId: tarjeta.cuentaId,
      nombre: tarjeta.nombre,
      ultimos4: tarjeta.ultimos4,
      limite,
      diaCorte: tarjeta.diaCorte,
      diaPago: tarjeta.diaPago,
      modalidad: tarjeta.modalidad,
      tin: tarjeta.tin === null ? null : Number(tarjeta.tin),
      minimoPorcentaje: Number(tarjeta.minimoPorcentaje),
      minimoSuelo: Number(tarjeta.minimoSuelo),
      ciclo: ciclos.actual,
      cicloAnterior: ciclos.anterior,
      diasHastaCorte: ciclos.diasHastaCorte,
      diasGratisSiComprasHoy: ciclos.diasGratisSiComprasHoy,
      consumidoCiclo,
      dispuesto,
      utilizacion: utilizacion(dispuesto, limite),
    }
  }

  app.get('/api/espacios/:id/tarjetas', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'lector')
    const tarjetas = await prisma.tarjeta.findMany({
      where: { espacioId: contexto.espacioId, borradaEn: null },
      orderBy: { creadaEn: 'asc' },
    })
    return { tarjetas: await Promise.all(tarjetas.map(estadoDe)) }
  })

  app.post('/api/espacios/:id/tarjetas', async (peticion, respuesta) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')
    const datos = esquemaTarjeta.parse(peticion.body)

    const cuenta = await prisma.cuenta.findFirst({
      where: { id: datos.cuentaId, espacioId: contexto.espacioId, borradaEn: null },
      select: { id: true, tipo: true, propietarioId: true },
    })
    if (!cuenta) throw noEncontrado('Esa cuenta no existe en este espacio.')
    if (cuenta.tipo !== 'tarjeta_credito') {
      throw datosInvalidos(
        'Una tarjeta se apoya en una cuenta de tipo «Tarjeta de crédito». Crea primero esa cuenta.',
      )
    }
    const yaHay = await prisma.tarjeta.findUnique({ where: { cuentaId: cuenta.id } })
    if (yaHay) throw conflicto('Esa cuenta ya tiene una tarjeta asociada.')

    try {
      cicloDe({ diaCorte: datos.diaCorte, diaPago: datos.diaPago }, new Date())
    } catch (error) {
      if (error instanceof ErrorTarjeta) throw datosInvalidos(error.message)
      throw error
    }

    const tarjeta = await prisma.tarjeta.create({
      data: {
        espacioId: contexto.espacioId,
        cuentaId: cuenta.id,
        nombre: datos.nombre,
        ultimos4: datos.ultimos4 ?? null,
        limite: BigInt(datos.limite),
        diaCorte: datos.diaCorte,
        diaPago: datos.diaPago,
        modalidad: datos.modalidad,
        tin: datos.tin ?? null,
        minimoPorcentaje: datos.minimoPorcentaje,
        minimoSuelo: BigInt(datos.minimoSuelo),
      },
    })
    return respuesta.code(201).send({ tarjeta: await estadoDe(tarjeta) })
  })

  /**
   * Qué cuesta aplazar.
   *
   * Se puede simular sobre una tarjeta guardada o con números sueltos, porque
   * la pregunta «¿cuánto me costaría de verdad?» se hace antes de contratar
   * nada, y es justo entonces cuando más falta hace la respuesta.
   */
  app.post('/api/espacios/:id/tarjetas/simular', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    await exigirEspacio(prisma, usuario.id, id, 'lector')
    const datos = esquemaSimular.parse(peticion.body)

    try {
      return simularAplazado({
        saldo: datos.saldo,
        tinAnual: datos.tin ?? 0,
        ...(datos.cuotaFija === undefined ? {} : { cuotaFija: datos.cuotaFija }),
        ...(datos.minimoPorcentaje === undefined ? {} : { minimoPorcentaje: datos.minimoPorcentaje }),
        ...(datos.minimoSuelo === undefined ? {} : { minimoSuelo: datos.minimoSuelo }),
      })
    } catch (error) {
      if (error instanceof ErrorTarjeta) throw datosInvalidos(error.message)
      throw error
    }
  })

  app.delete('/api/espacios/:id/tarjetas/:tarjetaId', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id, tarjetaId } = peticion.params as { id: string; tarjetaId: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')
    await buscarTarjeta(contexto.espacioId, tarjetaId)
    await prisma.tarjeta.update({ where: { id: tarjetaId }, data: { borradaEn: new Date() } })
    return { ok: true as const }
  })
}
