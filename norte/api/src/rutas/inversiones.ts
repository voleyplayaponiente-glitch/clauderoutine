import {
  calcularDesvios,
  estadoDePosicion,
  repartoPorClase,
  valorarPosicion,
  xirr,
  type ClaseActivo,
  type Flujo,
  type MovimientoInversion,
} from '@norte/dominio'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { exigirEspacio } from '../acceso.js'
import { noEncontrado } from '../errores.js'
import { usuarioDe } from '../servidor.js'

/**
 * Inversiones.
 *
 * Igual que en presupuesto y en deudas, **lo que se guarda son los hechos**
 * —compras, ventas, dividendos y el último precio con su fecha— y todo lo
 * demás se calcula. Las columnas `participaciones` y `costeMedio` de la tabla
 * existen para un futuro caché, pero hoy la verdad son los movimientos.
 */

const CLASES = [
  'renta_variable',
  'renta_fija',
  'monetario',
  'inmobiliario',
  'materias_primas',
  'cripto',
  'otros',
] as const

const TIPOS_MOVIMIENTO = [
  'compra',
  'venta',
  'aportacion',
  'retirada',
  'dividendo',
  'comision',
  'split',
] as const

const esquemaCuenta = z.object({
  nombre: z.string().trim().min(1, 'La cuenta necesita un nombre.').max(80),
  broker: z.string().max(80).nullish(),
  tipo: z.enum(['broker', 'plan_pensiones', 'fondo', 'cripto', 'inmobiliario']).default('broker'),
})

const esquemaPosicion = z.object({
  nombre: z.string().trim().min(1, 'La posición necesita un nombre.').max(120),
  isin: z.string().trim().max(12).nullish(),
  ticker: z.string().trim().max(12).nullish(),
  clase: z.enum(CLASES).default('renta_variable'),
  region: z.string().max(60).nullish(),
})

const esquemaMovimiento = z.object({
  tipo: z.enum(TIPOS_MOVIMIENTO),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha va como aaaa-mm-dd.'),
  participaciones: z.number().min(0).max(1e12).default(0),
  importe: z.number().int().min(0, 'El importe va en céntimos.'),
  comision: z.number().int().min(0).default(0),
})

const esquemaPrecio = z.object({
  ultimoPrecio: z.number().int().min(0, 'El precio va en céntimos por participación.'),
  fechaValoracion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

const esquemaObjetivos = z.object({
  objetivos: z
    .array(
      z.object({
        clase: z.enum(CLASES),
        objetivo: z.number().min(0).max(100),
        umbral: z.number().min(0).max(50).default(5),
      }),
    )
    .max(20),
})

export async function rutasInversiones(app: FastifyInstance, opciones: { prisma: PrismaClient }) {
  const { prisma } = opciones

  async function buscarCuenta(espacioId: string, cuentaInversionId: string) {
    const cuenta = await prisma.cuentaInversion.findFirst({
      where: { id: cuentaInversionId, espacioId, borradaEn: null },
    })
    if (!cuenta) throw noEncontrado('Esa cuenta de inversión no existe en este espacio.')
    return cuenta
  }

  async function buscarPosicion(espacioId: string, posicionId: string) {
    const posicion = await prisma.posicion.findFirst({
      where: { id: posicionId, borradaEn: null, cuentaInversion: { espacioId, borradaEn: null } },
      include: { movimientos: { orderBy: { fecha: 'asc' } } },
    })
    if (!posicion) throw noEncontrado('Esa posición no existe en este espacio.')
    return posicion
  }

  /** El signo del flujo lo pone el tipo, no el importe: en la base todos los
   *  importes son positivos y `tipo` dice si el dinero sale o entra. */
  function flujoDe(movimiento: {
    tipo: string
    fecha: Date
    importe: bigint
    comision: bigint
  }): Flujo | null {
    const fecha = movimiento.fecha.toISOString().slice(0, 10)
    const importe = Number(movimiento.importe)
    const comision = Number(movimiento.comision)
    switch (movimiento.tipo) {
      case 'compra':
      case 'aportacion':
        return { fecha, importe: -(importe + comision) }
      case 'venta':
      case 'retirada':
      case 'dividendo':
        return { fecha, importe: importe - comision }
      case 'comision':
        return { fecha, importe: -importe }
      default:
        return null
    }
  }

  async function carteraDe(espacioId: string) {
    const [cuentas, objetivos] = await Promise.all([
      prisma.cuentaInversion.findMany({
        where: { espacioId, borradaEn: null },
        orderBy: { creadaEn: 'asc' },
        include: {
          posiciones: {
            where: { borradaEn: null },
            orderBy: { creadaEn: 'asc' },
            include: { movimientos: { orderBy: { fecha: 'asc' } } },
          },
        },
      }),
      prisma.objetivoAsignacion.findMany({ where: { espacioId } }),
    ])

    const flujos: Flujo[] = []
    let valorTotal = 0
    let costeTotal = 0
    let dividendosTotal = 0
    let realizadaTotal = 0
    const paraReparto: { clase: ClaseActivo; valor: number }[] = []

    const cuentasFormateadas = cuentas.map((cuenta) => {
      const posiciones = cuenta.posiciones.map((posicion) => {
        const movimientos: MovimientoInversion[] = posicion.movimientos.map((m) => ({
          tipo: m.tipo as MovimientoInversion['tipo'],
          fecha: m.fecha.toISOString().slice(0, 10),
          participaciones: Number(m.participaciones),
          importe: Number(m.importe),
          comision: Number(m.comision),
        }))
        for (const movimiento of posicion.movimientos) {
          const flujo = flujoDe(movimiento)
          if (flujo) flujos.push(flujo)
        }

        const estado = estadoDePosicion(movimientos)
        const precio = posicion.ultimoPrecio === null ? null : Number(posicion.ultimoPrecio)
        const valoracion = valorarPosicion(estado, precio)

        valorTotal += valoracion.valor
        costeTotal += estado.costeTotal
        dividendosTotal += estado.dividendos
        realizadaTotal += estado.plusvaliaRealizada
        if (valoracion.valor > 0) {
          paraReparto.push({ clase: posicion.clase as ClaseActivo, valor: valoracion.valor })
        }

        return {
          id: posicion.id,
          nombre: posicion.nombre,
          isin: posicion.isin,
          ticker: posicion.ticker,
          clase: posicion.clase,
          region: posicion.region,
          participaciones: estado.participaciones,
          costeTotal: estado.costeTotal,
          costeMedio: estado.costeMedio,
          dividendos: estado.dividendos,
          plusvaliaRealizada: estado.plusvaliaRealizada,
          ultimoPrecio: precio,
          fechaValoracion: posicion.fechaValoracion?.toISOString().slice(0, 10) ?? null,
          ...valoracion,
          movimientos: posicion.movimientos.map((m) => ({
            id: m.id,
            tipo: m.tipo,
            fecha: m.fecha.toISOString().slice(0, 10),
            participaciones: Number(m.participaciones),
            importe: Number(m.importe),
            comision: Number(m.comision),
          })),
        }
      })

      return {
        id: cuenta.id,
        nombre: cuenta.nombre,
        broker: cuenta.broker,
        tipo: cuenta.tipo,
        divisa: cuenta.divisa,
        posiciones,
        valor: posiciones.reduce((total, p) => total + p.valor, 0),
      }
    })

    // El valor de hoy entra como un cobro imaginario: es lo que convierte una
    // lista de aportaciones en algo con TIR.
    const hoy = new Date().toISOString().slice(0, 10)
    const conValor = valorTotal > 0 ? [...flujos, { fecha: hoy, importe: valorTotal }] : flujos

    const reparto = repartoPorClase(paraReparto)
    const desvios = calcularDesvios(
      reparto,
      objetivos.map((o) => ({
        clase: o.clase as ClaseActivo,
        objetivo: Number(o.objetivo),
        umbral: Number(o.umbral),
      })),
    )

    return {
      cuentas: cuentasFormateadas,
      total: {
        valor: valorTotal,
        coste: costeTotal,
        plusvaliaLatente: valorTotal - costeTotal,
        dividendos: dividendosTotal,
        plusvaliaRealizada: realizadaTotal,
        rentabilidad: costeTotal > 0 ? ((valorTotal - costeTotal) / costeTotal) * 100 : null,
      },
      // `null` cuando no hay flujos de los dos signos o cuando no converge. La
      // pantalla lo enseña como «todavía no» y no como un cero.
      tir: xirr(conValor),
      reparto,
      desvios,
      // La rentabilidad ponderada por tiempo necesita valoraciones periódicas
      // de la cartera, y Norte todavía no las guarda. Decirlo es mejor que
      // calcular una TWR con un solo precio y llamarla comparable con el índice.
      twr: null as number | null,
    }
  }

  // ── Ver la cartera ────────────────────────────────────────────────────────
  app.get('/api/espacios/:id/inversiones', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'lector')
    return carteraDe(contexto.espacioId)
  })

  app.post('/api/espacios/:id/inversiones', async (peticion, respuesta) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')
    const datos = esquemaCuenta.parse(peticion.body)
    const cuenta = await prisma.cuentaInversion.create({
      data: {
        espacioId: contexto.espacioId,
        nombre: datos.nombre,
        broker: datos.broker ?? null,
        tipo: datos.tipo,
      },
    })
    return respuesta.code(201).send({ cuenta: { id: cuenta.id, nombre: cuenta.nombre } })
  })

  app.post('/api/espacios/:id/inversiones/:cuentaId/posiciones', async (peticion, respuesta) => {
    const usuario = usuarioDe(peticion)
    const { id, cuentaId } = peticion.params as { id: string; cuentaId: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')
    await buscarCuenta(contexto.espacioId, cuentaId)
    const datos = esquemaPosicion.parse(peticion.body)

    const posicion = await prisma.posicion.create({
      data: {
        cuentaInversionId: cuentaId,
        nombre: datos.nombre,
        isin: datos.isin ?? null,
        ticker: datos.ticker ?? null,
        clase: datos.clase,
        region: datos.region ?? null,
      },
    })
    return respuesta.code(201).send({ posicion: { id: posicion.id, nombre: posicion.nombre } })
  })

  app.post('/api/espacios/:id/inversiones/posiciones/:posicionId/movimientos', async (peticion, respuesta) => {
    const usuario = usuarioDe(peticion)
    const { id, posicionId } = peticion.params as { id: string; posicionId: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')
    await buscarPosicion(contexto.espacioId, posicionId)
    const datos = esquemaMovimiento.parse(peticion.body)

    await prisma.movimientoInversion.create({
      data: {
        posicionId,
        tipo: datos.tipo,
        fecha: new Date(datos.fecha),
        participaciones: datos.participaciones,
        importe: BigInt(datos.importe),
        comision: BigInt(datos.comision),
      },
    })
    return respuesta.code(201).send(await carteraDe(contexto.espacioId))
  })

  /** Poner el precio a mano. Norte no llama a ninguna API de cotizaciones: sin
   *  fecha un precio no dice nada, así que se guarda siempre con la suya y se
   *  enseña cuándo se valoró. */
  app.patch('/api/espacios/:id/inversiones/posiciones/:posicionId/precio', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id, posicionId } = peticion.params as { id: string; posicionId: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')
    await buscarPosicion(contexto.espacioId, posicionId)
    const datos = esquemaPrecio.parse(peticion.body)

    await prisma.posicion.update({
      where: { id: posicionId },
      data: {
        ultimoPrecio: BigInt(datos.ultimoPrecio),
        fechaValoracion: new Date(datos.fechaValoracion ?? new Date().toISOString().slice(0, 10)),
      },
    })
    return carteraDe(contexto.espacioId)
  })

  app.delete('/api/espacios/:id/inversiones/posiciones/:posicionId', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id, posicionId } = peticion.params as { id: string; posicionId: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')
    await buscarPosicion(contexto.espacioId, posicionId)
    await prisma.posicion.update({ where: { id: posicionId }, data: { borradaEn: new Date() } })
    return { ok: true as const }
  })

  app.delete('/api/espacios/:id/inversiones/:cuentaId', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id, cuentaId } = peticion.params as { id: string; cuentaId: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')
    await buscarCuenta(contexto.espacioId, cuentaId)
    await prisma.cuentaInversion.update({ where: { id: cuentaId }, data: { borradaEn: new Date() } })
    return { ok: true as const }
  })

  // ── Asignación objetivo ───────────────────────────────────────────────────
  app.put('/api/espacios/:id/inversiones/objetivos', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')
    const datos = esquemaObjetivos.parse(peticion.body)

    await prisma.$transaction([
      prisma.objetivoAsignacion.deleteMany({ where: { espacioId: contexto.espacioId } }),
      ...datos.objetivos.map((objetivo) =>
        prisma.objetivoAsignacion.create({
          data: {
            espacioId: contexto.espacioId,
            clase: objetivo.clase,
            objetivo: objetivo.objetivo,
            umbral: objetivo.umbral,
          },
        }),
      ),
    ])
    return carteraDe(contexto.espacioId)
  })
}
