import { esCuentaVisiblePara } from '@norte/dominio'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { exigirEspacio } from '../acceso.js'
import { conflicto, noEncontrado } from '../errores.js'
import { usuarioDe } from '../servidor.js'

const TIPOS = [
  'corriente',
  'ahorro',
  'efectivo',
  'tarjeta_credito',
  'inversion',
  'prestamo',
  'activo_no_liquido',
] as const

const esquemaCuenta = z.object({
  nombre: z.string().trim().min(1, 'La cuenta necesita un nombre.').max(80),
  tipo: z.enum(TIPOS),
  saldoInicial: z.number().int('El saldo va en céntimos enteros.').default(0),
  divisa: z.string().length(3).default('EUR'),
  entidad: z.string().max(80).nullish(),
  // Cuatro dígitos y ni uno más: el IBAN completo no se guarda nunca.
  ultimos4: z.string().regex(/^\d{4}$/, 'Solo los cuatro últimos dígitos.').nullish(),
  computaPatrimonio: z.boolean().default(true),
  visibleEnEspacio: z.boolean().default(true),
})

export async function rutasCuentas(app: FastifyInstance, opciones: { prisma: PrismaClient }) {
  const { prisma } = opciones

  /**
   * Las cuentas del espacio **que este usuario puede ver**.
   *
   * Aquí es donde se cumple la promesa de «tu pareja ve lo compartido y nada
   * más»: una cuenta marcada como no visible solo la ve quien la creó, aunque
   * el otro sea propietario del espacio. La decisión la toma el dominio.
   */
  app.get('/api/espacios/:id/cuentas', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'lector')

    const cuentas = await prisma.cuenta.findMany({
      where: { espacioId: contexto.espacioId, borradaEn: null },
      orderBy: [{ archivadaEn: 'asc' }, { creadaEn: 'asc' }],
    })
    const visibles = cuentas.filter((c) => esCuentaVisiblePara(c, usuario.id))

    // Un saldo por cuenta en UNA consulta, no una por cuenta: con quince
    // cuentas serían quince viajes a la base de datos para pintar una lista.
    const sumas = await prisma.movimiento.groupBy({
      by: ['cuentaId'],
      where: {
        espacioId: contexto.espacioId,
        borradoEn: null,
        estado: 'confirmado',
        cuentaId: { in: visibles.map((c) => c.id) },
      },
      _sum: { importe: true },
    })
    const porCuenta = new Map(sumas.map((s) => [s.cuentaId, s._sum.importe ?? 0n]))

    return {
      cuentas: visibles.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        tipo: c.tipo,
        divisa: c.divisa,
        entidad: c.entidad,
        ultimos4: c.ultimos4,
        computaPatrimonio: c.computaPatrimonio,
        visibleEnEspacio: c.visibleEnEspacio,
        esMia: c.propietarioId === usuario.id,
        archivada: c.archivadaEn !== null,
        // Lo previsto no entra en el saldo: si entrara, no cuadraría con el
        // extracto del banco y eso es lo primero que hace desconfiar.
        saldo: c.saldoInicial + (porCuenta.get(c.id) ?? 0n),
      })),
    }
  })

  app.post('/api/espacios/:id/cuentas', async (peticion, respuesta) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')
    const datos = esquemaCuenta.parse(peticion.body)

    const repetida = await prisma.cuenta.findFirst({
      where: { espacioId: contexto.espacioId, nombre: datos.nombre, borradaEn: null },
    })
    if (repetida) throw conflicto('Ya tienes una cuenta con ese nombre.')

    const cuenta = await prisma.cuenta.create({
      data: {
        espacioId: contexto.espacioId,
        propietarioId: usuario.id,
        nombre: datos.nombre,
        tipo: datos.tipo,
        divisa: datos.divisa,
        saldoInicial: BigInt(datos.saldoInicial),
        entidad: datos.entidad ?? null,
        ultimos4: datos.ultimos4 ?? null,
        computaPatrimonio: datos.computaPatrimonio,
        visibleEnEspacio: datos.visibleEnEspacio,
      },
    })
    return respuesta.code(201).send({ cuenta: { ...cuenta, saldo: cuenta.saldoInicial } })
  })

  app.patch('/api/espacios/:id/cuentas/:cuentaId', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id, cuentaId } = peticion.params as { id: string; cuentaId: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')
    const datos = esquemaCuenta.partial().extend({ archivada: z.boolean().optional() }).parse(peticion.body)

    const cuenta = await prisma.cuenta.findFirst({
      where: { id: cuentaId, espacioId: contexto.espacioId, borradaEn: null },
    })
    if (!cuenta || !esCuentaVisiblePara(cuenta, usuario.id)) {
      throw noEncontrado('Esa cuenta no existe en este espacio.')
    }

    const actualizada = await prisma.cuenta.update({
      where: { id: cuenta.id },
      data: {
        ...(datos.nombre !== undefined ? { nombre: datos.nombre } : {}),
        ...(datos.tipo !== undefined ? { tipo: datos.tipo } : {}),
        ...(datos.entidad !== undefined ? { entidad: datos.entidad ?? null } : {}),
        ...(datos.ultimos4 !== undefined ? { ultimos4: datos.ultimos4 ?? null } : {}),
        ...(datos.saldoInicial !== undefined ? { saldoInicial: BigInt(datos.saldoInicial) } : {}),
        ...(datos.computaPatrimonio !== undefined ? { computaPatrimonio: datos.computaPatrimonio } : {}),
        ...(datos.visibleEnEspacio !== undefined ? { visibleEnEspacio: datos.visibleEnEspacio } : {}),
        ...(datos.archivada !== undefined ? { archivadaEn: datos.archivada ? new Date() : null } : {}),
      },
    })
    return { cuenta: actualizada }
  })

  /** A la papelera, con sus movimientos. Nada se borra de verdad. */
  app.delete('/api/espacios/:id/cuentas/:cuentaId', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id, cuentaId } = peticion.params as { id: string; cuentaId: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')

    const cuenta = await prisma.cuenta.findFirst({
      where: { id: cuentaId, espacioId: contexto.espacioId, borradaEn: null },
    })
    if (!cuenta || !esCuentaVisiblePara(cuenta, usuario.id)) {
      throw noEncontrado('Esa cuenta no existe en este espacio.')
    }

    const ahora = new Date()
    await prisma.$transaction([
      prisma.movimiento.updateMany({
        where: { cuentaId: cuenta.id, borradoEn: null },
        data: { borradoEn: ahora },
      }),
      prisma.cuenta.update({ where: { id: cuenta.id }, data: { borradaEn: ahora } }),
    ])
    return { ok: true }
  })
}
