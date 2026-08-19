import {
  compararAmortizacion,
  compararEstrategias,
  cuadroConAmortizaciones,
  cuotaFrancesa,
  ErrorPrestamo,
  generarCuadro,
  resumirCuadro,
  taeDesdeTin,
  type Cuota,
  type Prestamo,
} from '@norte/dominio'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { exigirEspacio } from '../acceso.js'
import { datosInvalidos, noEncontrado } from '../errores.js'
import { usuarioDe } from '../servidor.js'

/**
 * Deudas: cuadros de amortización y simulaciones.
 *
 * **El cuadro no se guarda: se calcula.** Sale entero de los datos del préstamo
 * más las amortizaciones anticipadas que el usuario haya registrado, así que
 * guardarlo sería tener dos verdades sobre lo mismo y arriesgarse a que la
 * copia envejezca. La tabla `cuadro_amortizacion` queda para cuando lleguen las
 * revisiones de tipo variable, donde el cuadro real ya no se deduce de un solo
 * tipo.
 */

const SISTEMAS = ['frances', 'aleman', 'americano'] as const
const TIPOS = [
  'hipoteca',
  'prestamo_personal',
  'auto',
  'estudios',
  'familiar',
  'tarjeta_revolving',
] as const

const esquemaDeuda = z.object({
  nombre: z.string().trim().min(1, 'La deuda necesita un nombre.').max(80),
  tipo: z.enum(TIPOS),
  entidad: z.string().max(80).nullish(),
  principalOriginal: z.number().int().positive('El principal va en céntimos y debe ser positivo.'),
  tin: z.number().min(0, 'El tipo no puede ser negativo.').max(100),
  plazoMeses: z.number().int().min(1).max(720),
  sistema: z.enum(SISTEMAS).default('frances'),
  fechaPrimerPago: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha va como aaaa-mm-dd.'),
  tipoVariable: z.boolean().default(false),
  diferencial: z.number().min(-5).max(20).nullish(),
  revisionMeses: z.number().int().min(1).max(60).nullish(),
  comisionAmortizacion: z.number().min(0).max(10).default(0),
})

const esquemaSimulacion = z.object({
  trasCuota: z.number().int().min(0).max(720),
  importe: z.number().int().positive('El importe a amortizar va en céntimos.'),
})

const esquemaAmortizacion = esquemaSimulacion.extend({
  reducePlazo: z.boolean().default(true),
})

export async function rutasDeudas(app: FastifyInstance, opciones: { prisma: PrismaClient }) {
  const { prisma } = opciones

  type DeudaConExtras = Awaited<ReturnType<typeof buscarDeuda>>

  async function buscarDeuda(espacioId: string, deudaId: string) {
    const deuda = await prisma.deuda.findFirst({
      where: { id: deudaId, espacioId, borradaEn: null },
      include: { amortizaciones: { orderBy: { fecha: 'asc' } } },
    })
    if (!deuda) throw noEncontrado('Esa deuda no existe en este espacio.')
    return deuda
  }

  function aPrestamo(deuda: {
    principalOriginal: bigint
    tin: unknown
    plazoMeses: number
    sistema: string
    fechaPrimerPago: Date
  }): Prestamo {
    return {
      principal: Number(deuda.principalOriginal),
      tinAnual: Number(deuda.tin),
      meses: deuda.plazoMeses,
      sistema: deuda.sistema as Prestamo['sistema'],
      primerPago: deuda.fechaPrimerPago.toISOString().slice(0, 10),
    }
  }

  /** La cuota a la que corresponde una fecha dentro del cuadro. */
  function cuotaEnFecha(cuadro: Cuota[], fecha: string): number {
    let numero = 0
    for (const fila of cuadro) {
      if (fila.fecha <= fecha) numero = fila.numero
      else break
    }
    return numero
  }

  function estadoDe(deuda: DeudaConExtras) {
    const prestamo = aPrestamo(deuda)
    const extras = deuda.amortizaciones.map((a) => ({
      trasCuota: cuotaEnFecha(generarCuadro(prestamo), a.fecha.toISOString().slice(0, 10)),
      importe: Number(a.importe),
      modo: (a.reducePlazo ? 'reducir_plazo' : 'reducir_cuota') as 'reducir_plazo' | 'reducir_cuota',
    }))
    const cuadro = extras.length > 0 ? cuadroConAmortizaciones(prestamo, extras) : generarCuadro(prestamo)

    const hoy = new Date().toISOString().slice(0, 10)
    const pagadas = cuadro.filter((c) => c.fecha <= hoy)
    const siguiente = cuadro.find((c) => c.fecha > hoy) ?? null
    const saldoPendiente = pagadas.length > 0 ? pagadas[pagadas.length - 1]!.saldoVivo : prestamo.principal

    return {
      id: deuda.id,
      nombre: deuda.nombre,
      tipo: deuda.tipo,
      entidad: deuda.entidad,
      principalOriginal: Number(deuda.principalOriginal),
      tin: Number(deuda.tin),
      // La TAE que exige la ley incluye comisiones y seguros; esta es la
      // conversión pura del nominal, así que es el suelo, no la del contrato.
      taeEquivalente: taeDesdeTin(Number(deuda.tin)),
      plazoMeses: deuda.plazoMeses,
      sistema: deuda.sistema,
      tipoVariable: deuda.tipoVariable,
      diferencial: deuda.diferencial === null ? null : Number(deuda.diferencial),
      revisionMeses: deuda.revisionMeses,
      comisionAmortizacion: Number(deuda.comisionAmortizacion),
      fechaPrimerPago: prestamo.primerPago,
      cuota: cuadro[0]?.cuota ?? 0,
      cuotaActual: siguiente?.cuota ?? 0,
      saldoPendiente,
      cuotasPagadas: pagadas.length,
      proximoPago: siguiente ? { fecha: siguiente.fecha, cuota: siguiente.cuota } : null,
      resumen: resumirCuadro(cuadro, prestamo.principal),
      amortizaciones: deuda.amortizaciones.map((a) => ({
        id: a.id,
        fecha: a.fecha.toISOString().slice(0, 10),
        importe: Number(a.importe),
        reducePlazo: a.reducePlazo,
        comision: Number(a.comision),
        interesAhorrado: Number(a.interesAhorrado),
      })),
    }
  }

  async function todas(espacioId: string) {
    const deudas = await prisma.deuda.findMany({
      where: { espacioId, borradaEn: null },
      include: { amortizaciones: { orderBy: { fecha: 'asc' } } },
      orderBy: { creadaEn: 'asc' },
    })
    return deudas.map(estadoDe)
  }

  // ── Listar ────────────────────────────────────────────────────────────────
  app.get('/api/espacios/:id/deudas', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'lector')
    return { deudas: await todas(contexto.espacioId) }
  })

  // ── Crear ─────────────────────────────────────────────────────────────────
  app.post('/api/espacios/:id/deudas', async (peticion, respuesta) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')
    const datos = esquemaDeuda.parse(peticion.body)

    let cuota: number
    try {
      cuota =
        datos.sistema === 'frances'
          ? cuotaFrancesa(datos.principalOriginal, datos.tin, datos.plazoMeses)
          : generarCuadro({
              principal: datos.principalOriginal,
              tinAnual: datos.tin,
              meses: datos.plazoMeses,
              sistema: datos.sistema,
              primerPago: datos.fechaPrimerPago,
            })[0]!.cuota
    } catch (error) {
      if (error instanceof ErrorPrestamo) throw datosInvalidos(error.message)
      throw error
    }

    const deuda = await prisma.deuda.create({
      data: {
        espacioId: contexto.espacioId,
        nombre: datos.nombre,
        tipo: datos.tipo,
        entidad: datos.entidad ?? null,
        principalOriginal: BigInt(datos.principalOriginal),
        saldoPendiente: BigInt(datos.principalOriginal),
        tin: datos.tin,
        tae: taeDesdeTin(datos.tin),
        plazoMeses: datos.plazoMeses,
        cuota: BigInt(cuota),
        sistema: datos.sistema,
        fechaPrimerPago: new Date(datos.fechaPrimerPago),
        tipoVariable: datos.tipoVariable,
        diferencial: datos.diferencial ?? null,
        revisionMeses: datos.revisionMeses ?? null,
        comisionAmortizacion: datos.comisionAmortizacion,
      },
      include: { amortizaciones: true },
    })
    return respuesta.code(201).send({ deuda: estadoDe(deuda) })
  })

  // ── El cuadro entero ──────────────────────────────────────────────────────
  app.get('/api/espacios/:id/deudas/:deudaId/cuadro', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id, deudaId } = peticion.params as { id: string; deudaId: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'lector')
    const deuda = await buscarDeuda(contexto.espacioId, deudaId)
    const prestamo = aPrestamo(deuda)
    const extras = deuda.amortizaciones.map((a) => ({
      trasCuota: cuotaEnFecha(generarCuadro(prestamo), a.fecha.toISOString().slice(0, 10)),
      importe: Number(a.importe),
      modo: (a.reducePlazo ? 'reducir_plazo' : 'reducir_cuota') as 'reducir_plazo' | 'reducir_cuota',
    }))
    const cuadro = extras.length > 0 ? cuadroConAmortizaciones(prestamo, extras) : generarCuadro(prestamo)
    return { cuadro, resumen: resumirCuadro(cuadro, prestamo.principal) }
  })

  // ── Simular una amortización anticipada ───────────────────────────────────
  app.post('/api/espacios/:id/deudas/:deudaId/simular', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id, deudaId } = peticion.params as { id: string; deudaId: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'lector')
    const deuda = await buscarDeuda(contexto.espacioId, deudaId)
    const datos = esquemaSimulacion.parse(peticion.body)

    // Las dos opciones se calculan SIEMPRE y se devuelven juntas. Elegir entre
    // reducir cuota y reducir plazo sin ver las dos cifras no es elegir.
    const comparacion = compararAmortizacion(aPrestamo(deuda), {
      ...datos,
      comisionPorcentaje: Number(deuda.comisionAmortizacion),
    })
    return {
      // Los cuadros completos no viajan: para decidir sobran, y son 360 filas
      // por cada opción.
      reducirPlazo: sinCuadro(comparacion.reducirPlazo),
      reducirCuota: sinCuadro(comparacion.reducirCuota),
    }
  })

  // ── Registrar una amortización ────────────────────────────────────────────
  app.post('/api/espacios/:id/deudas/:deudaId/amortizaciones', async (peticion, respuesta) => {
    const usuario = usuarioDe(peticion)
    const { id, deudaId } = peticion.params as { id: string; deudaId: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')
    const deuda = await buscarDeuda(contexto.espacioId, deudaId)
    const datos = esquemaAmortizacion.parse(peticion.body)

    const prestamo = aPrestamo(deuda)
    const cuadro = generarCuadro(prestamo)
    const fila = cuadro[Math.min(datos.trasCuota, cuadro.length) - 1] ?? cuadro[0]!
    const comparacion = compararAmortizacion(prestamo, {
      trasCuota: datos.trasCuota,
      importe: datos.importe,
      comisionPorcentaje: Number(deuda.comisionAmortizacion),
    })
    const elegida = datos.reducePlazo ? comparacion.reducirPlazo : comparacion.reducirCuota

    await prisma.amortizacionExtra.create({
      data: {
        deudaId: deuda.id,
        fecha: new Date(fila.fecha),
        importe: BigInt(datos.importe),
        reducePlazo: datos.reducePlazo,
        comision: BigInt(elegida.comision),
        interesAhorrado: BigInt(elegida.interesAhorrado),
      },
    })

    return respuesta.code(201).send({ deuda: estadoDe(await buscarDeuda(contexto.espacioId, deudaId)) })
  })

  app.delete('/api/espacios/:id/deudas/:deudaId/amortizaciones/:amortizacionId', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id, deudaId, amortizacionId } = peticion.params as {
      id: string
      deudaId: string
      amortizacionId: string
    }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')
    await buscarDeuda(contexto.espacioId, deudaId)
    const borradas = await prisma.amortizacionExtra.deleteMany({
      where: { id: amortizacionId, deudaId },
    })
    if (borradas.count === 0) throw noEncontrado('Esa amortización no existe.')
    return { deuda: estadoDe(await buscarDeuda(contexto.espacioId, deudaId)) }
  })

  // ── En qué orden pagarlas todas ───────────────────────────────────────────
  app.get('/api/espacios/:id/deudas/estrategias', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'lector')
    const extra = Number((peticion.query as { extra?: string }).extra ?? 0)
    if (!Number.isInteger(extra) || extra < 0) {
      throw datosInvalidos('El extra mensual va en céntimos enteros.', { campo: 'extra' })
    }

    const deudas = (await todas(contexto.espacioId))
      .filter((d) => d.saldoPendiente > 0)
      .map((d) => ({
        id: d.id,
        nombre: d.nombre,
        saldo: d.saldoPendiente,
        tinAnual: d.tin,
        cuotaMinima: d.cuotaActual || d.cuota,
      }))

    if (deudas.length === 0) return { extra, deudas: 0, avalancha: null, bolaDeNieve: null }
    return { extra, deudas: deudas.length, ...compararEstrategias(deudas, extra) }
  })

  app.delete('/api/espacios/:id/deudas/:deudaId', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id, deudaId } = peticion.params as { id: string; deudaId: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')
    await buscarDeuda(contexto.espacioId, deudaId)
    await prisma.deuda.update({ where: { id: deudaId }, data: { borradaEn: new Date() } })
    return { ok: true as const }
  })
}

function sinCuadro<T extends { cuadro: unknown }>(resultado: T): Omit<T, 'cuadro'> {
  const { cuadro: _, ...resto } = resultado
  return resto
}
