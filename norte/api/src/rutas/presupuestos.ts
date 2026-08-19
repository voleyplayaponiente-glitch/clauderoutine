import {
  calcularArrastre,
  calcularSobre,
  calendarioDelMes,
  esCuentaVisiblePara,
  proponerAsignacion,
  resumirPresupuesto,
  type Centimos,
  type EntradaSobre,
  type TipoCategoria,
} from '@norte/dominio'
import type { Prisma, PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { exigirEspacio } from '../acceso.js'
import { datosInvalidos, noEncontrado } from '../errores.js'
import { usuarioDe } from '../servidor.js'

/**
 * Presupuesto por sobres.
 *
 * Las cuentas se calculan **al vuelo** a partir de los movimientos; en la base
 * solo se guarda lo que el usuario decide (cuánto asigna a cada sobre y si
 * arrastra). Guardar el gasto agregado sería tener dos verdades sobre lo mismo,
 * y la que se queda vieja siempre es la copia.
 *
 * Todo se filtra por las cuentas que **esta persona** puede ver, igual que en
 * movimientos: en un espacio compartido, el presupuesto no puede ser la puerta
 * de atrás para ver los gastos de la cuenta privada de otro.
 */

const MES = /^\d{4}-\d{2}$/

const esquemaLinea = z.object({
  asignado: z.number().int('La asignación va en céntimos enteros.').min(0).max(1_000_000_00),
  rollover: z.boolean().optional(),
})

const esquemaLineas = z.object({
  lineas: z
    .array(
      z.object({
        categoriaId: z.string().min(1),
        asignado: z.number().int().min(0).max(1_000_000_00),
        rollover: z.boolean().optional(),
      }),
    )
    .max(300),
})

/** `2026-08` → el 1 de agosto de 2026, que es como se guarda el mes. */
function primerDia(mes: string): Date {
  const [anio, numero] = mes.split('-').map(Number)
  return new Date(Date.UTC(anio!, (numero ?? 1) - 1, 1))
}

function mesSiguiente(mes: string): string {
  const [anio, numero] = mes.split('-').map(Number)
  const fecha = new Date(Date.UTC(anio!, numero ?? 1, 1))
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`
}

function mesAnterior(mes: string, cuantos = 1): string {
  const [anio, numero] = mes.split('-').map(Number)
  const fecha = new Date(Date.UTC(anio!, (numero ?? 1) - 1 - cuantos, 1))
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`
}

function finDeMes(mes: string): Date {
  const [anio, numero] = mes.split('-').map(Number)
  return new Date(Date.UTC(anio!, numero ?? 1, 0))
}

export async function rutasPresupuestos(app: FastifyInstance, opciones: { prisma: PrismaClient }) {
  const { prisma } = opciones

  function leerMes(consulta: unknown): string {
    const mes = (consulta as { mes?: string } | null)?.mes
    if (!mes || !MES.test(mes)) {
      throw datosInvalidos('Falta el mes, o no viene como aaaa-mm.', { campo: 'mes' })
    }
    return mes
  }

  async function cuentasVisibles(espacioId: string, usuarioId: string): Promise<string[]> {
    const cuentas = await prisma.cuenta.findMany({
      where: { espacioId, borradaEn: null },
      select: { id: true, propietarioId: true, visibleEnEspacio: true },
    })
    return cuentas.filter((c) => esCuentaVisiblePara(c, usuarioId)).map((c) => c.id)
  }

  /** Gasto (en positivo) e ingreso por categoría en un mes. */
  async function movimientosDelMes(espacioId: string, cuentas: string[], mes: string) {
    const donde: Prisma.MovimientoWhereInput = {
      espacioId,
      borradoEn: null,
      cuentaId: { in: cuentas },
      fecha: { gte: primerDia(mes), lte: finDeMes(mes) },
    }
    const filas = await prisma.movimiento.groupBy({
      by: ['categoriaId', 'estado'],
      where: donde,
      _sum: { importe: true },
    })

    const gastado = new Map<string, Centimos>()
    const previsto = new Map<string, Centimos>()
    const sinCategoria = { confirmado: 0, previsto: 0 }

    for (const fila of filas) {
      const suma = Number(fila._sum.importe ?? 0)
      if (fila.categoriaId === null) {
        if (fila.estado === 'confirmado') sinCategoria.confirmado += suma
        else sinCategoria.previsto += suma
        continue
      }
      const destino = fila.estado === 'confirmado' ? gastado : previsto
      // El signo se le da la vuelta aquí y solo aquí: en un sobre, gastar 40 €
      // son 40, no −40. En la base sigue mandando el signo del movimiento.
      destino.set(fila.categoriaId, (destino.get(fila.categoriaId) ?? 0) - suma)
    }

    return { gastado, previsto, sinCategoria }
  }

  /**
   * Lo que se espera que entre este mes.
   *
   * **Solo cuenta lo clasificado en una categoría de ingreso.** Es deliberado:
   * en un extracto real, un traspaso de 5.000 € entre cuentas propias entra
   * como un apunte positivo, y sumarlo daría un presupuesto con miles de euros
   * que no existen. Si no hay nada clasificado, el resultado es cero y la
   * pantalla lo explica; inflar la cifra sería mucho peor.
   */
  async function ingresosDelMes(espacioId: string, cuentas: string[], mes: string) {
    const filas = await prisma.movimiento.groupBy({
      by: ['estado'],
      where: {
        espacioId,
        borradoEn: null,
        cuentaId: { in: cuentas },
        fecha: { gte: primerDia(mes), lte: finDeMes(mes) },
        categoria: { flujo: 'ingreso' },
      },
      _sum: { importe: true },
    })
    let confirmado = 0
    let previsto = 0
    for (const fila of filas) {
      const suma = Number(fila._sum.importe ?? 0)
      if (fila.estado === 'confirmado') confirmado += suma
      else previsto += suma
    }
    return { confirmado, previsto, total: confirmado + previsto }
  }

  async function estadoDelMes(espacioId: string, usuarioId: string, mes: string) {
    const cuentas = await cuentasVisibles(espacioId, usuarioId)

    const [categorias, presupuesto, gastos, ingresos] = await Promise.all([
      prisma.categoria.findMany({
        where: { espacioId, borradaEn: null, flujo: 'gasto' },
        orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
        select: { id: true, nombre: true, tipo: true, esencial: true, padreId: true },
      }),
      prisma.presupuesto.findUnique({
        where: { espacioId_mes: { espacioId, mes: primerDia(mes) } },
        include: { lineas: true },
      }),
      movimientosDelMes(espacioId, cuentas, mes),
      ingresosDelMes(espacioId, cuentas, mes),
    ])

    const porCategoria = new Map(presupuesto?.lineas.map((l) => [l.categoriaId, l]) ?? [])
    const calendario = calendarioDelMes(`${mes}-01`, new Date())

    const entradas: EntradaSobre[] = categorias.map((categoria) => {
      const linea = porCategoria.get(categoria.id)
      return {
        categoriaId: categoria.id,
        categoria: categoria.nombre,
        tipo: categoria.tipo as TipoCategoria,
        esencial: categoria.esencial,
        asignado: Number(linea?.asignado ?? 0),
        arrastrado: Number(linea?.arrastrado ?? 0),
        gastado: gastos.gastado.get(categoria.id) ?? 0,
        previsto: gastos.previsto.get(categoria.id) ?? 0,
        rollover: linea?.rollover ?? false,
      }
    })

    // El padre viaja con el sobre para que la pantalla pueda agrupar. No entra
    // en el dominio porque no cambia ninguna cuenta: es cómo se enseña.
    const sobres = entradas.map((entrada, i) => ({
      ...calcularSobre(entrada, calendario),
      padreId: categorias[i]!.padreId,
    }))

    return {
      mes,
      calendario,
      sobres,
      resumen: resumirPresupuesto(sobres, ingresos.total),
      ingresos,
      // Lo que no está clasificado no entra en ningún sobre. Se enseña para que
      // no parezca que el presupuesto cuadra cuando hay gasto fuera de él.
      sinClasificar: {
        gastado: -gastos.sinCategoria.confirmado,
        previsto: -gastos.sinCategoria.previsto,
      },
      cerrado: Boolean(
        await prisma.periodoPresupuesto.findUnique({
          where: { espacioId_mes: { espacioId, mes: primerDia(mes) } },
          select: { cerradoEn: true },
        }).then((p) => p?.cerradoEn),
      ),
    }
  }

  async function presupuestoDe(espacioId: string, mes: string) {
    return prisma.presupuesto.upsert({
      where: { espacioId_mes: { espacioId, mes: primerDia(mes) } },
      create: { espacioId, mes: primerDia(mes) },
      update: {},
    })
  }

  // ── Ver el mes ────────────────────────────────────────────────────────────
  app.get('/api/espacios/:id/presupuesto', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'lector')
    return estadoDelMes(contexto.espacioId, usuario.id, leerMes(peticion.query))
  })

  // ── Asignar a un sobre ────────────────────────────────────────────────────
  app.put('/api/espacios/:id/presupuesto/lineas/:categoriaId', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id, categoriaId } = peticion.params as { id: string; categoriaId: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')
    const mes = leerMes(peticion.query)
    const datos = esquemaLinea.parse(peticion.body)

    const categoria = await prisma.categoria.findFirst({
      where: { id: categoriaId, espacioId: contexto.espacioId, borradaEn: null, flujo: 'gasto' },
      select: { id: true },
    })
    if (!categoria) throw noEncontrado('Esa categoría de gasto no existe en este espacio.')

    const presupuesto = await presupuestoDe(contexto.espacioId, mes)
    await prisma.lineaPresupuesto.upsert({
      where: { presupuestoId_categoriaId: { presupuestoId: presupuesto.id, categoriaId } },
      create: {
        presupuestoId: presupuesto.id,
        categoriaId,
        asignado: BigInt(datos.asignado),
        rollover: datos.rollover ?? false,
      },
      update: {
        asignado: BigInt(datos.asignado),
        ...(datos.rollover === undefined ? {} : { rollover: datos.rollover }),
      },
    })

    return estadoDelMes(contexto.espacioId, usuario.id, mes)
  })

  // ── Asignar varios de golpe (aplicar una propuesta) ───────────────────────
  app.put('/api/espacios/:id/presupuesto/lineas', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')
    const mes = leerMes(peticion.query)
    const datos = esquemaLineas.parse(peticion.body)

    const validas = new Set(
      (
        await prisma.categoria.findMany({
          where: { espacioId: contexto.espacioId, borradaEn: null, flujo: 'gasto' },
          select: { id: true },
        })
      ).map((c) => c.id),
    )
    const desconocida = datos.lineas.find((l) => !validas.has(l.categoriaId))
    if (desconocida) throw noEncontrado('Una de las categorías no existe en este espacio.')

    const presupuesto = await presupuestoDe(contexto.espacioId, mes)
    await prisma.$transaction(
      datos.lineas.map((linea) =>
        prisma.lineaPresupuesto.upsert({
          where: {
            presupuestoId_categoriaId: {
              presupuestoId: presupuesto.id,
              categoriaId: linea.categoriaId,
            },
          },
          create: {
            presupuestoId: presupuesto.id,
            categoriaId: linea.categoriaId,
            asignado: BigInt(linea.asignado),
            rollover: linea.rollover ?? false,
          },
          update: {
            asignado: BigInt(linea.asignado),
            ...(linea.rollover === undefined ? {} : { rollover: linea.rollover }),
          },
        }),
      ),
    )

    return estadoDelMes(contexto.espacioId, usuario.id, mes)
  })

  // ── Propuesta a partir del gasto real ─────────────────────────────────────
  app.get('/api/espacios/:id/presupuesto/propuesta', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'lector')
    const mes = leerMes(peticion.query)
    const cuentas = await cuentasVisibles(contexto.espacioId, usuario.id)

    const categorias = await prisma.categoria.findMany({
      where: { espacioId: contexto.espacioId, borradaEn: null, flujo: 'gasto' },
      select: { id: true, nombre: true, tipo: true },
    })

    // Seis meses hacia atrás: suficiente para que la mediana signifique algo y
    // poco para que no arrastre hábitos de hace un año.
    const meses = Array.from({ length: 6 }, (_, i) => mesAnterior(mes, i + 1)).reverse()
    const historico = await Promise.all(
      meses.map((m) => movimientosDelMes(contexto.espacioId, cuentas, m)),
    )

    const propuestas = categorias.map((categoria) =>
      proponerAsignacion(
        { categoriaId: categoria.id, tipo: categoria.tipo as TipoCategoria },
        historico.map((h) => h.gastado.get(categoria.id) ?? 0),
      ),
    )

    return { mes, meses, propuestas }
  })

  // ── Cerrar el mes ─────────────────────────────────────────────────────────
  app.post('/api/espacios/:id/presupuesto/cerrar', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')
    const mes = leerMes(peticion.query)

    const estado = await estadoDelMes(contexto.espacioId, usuario.id, mes)
    const arrastres = calcularArrastre(estado.sobres).filter((a) => a.arrastrado !== 0)

    const siguiente = mesSiguiente(mes)
    const destino = await presupuestoDe(contexto.espacioId, siguiente)

    await prisma.$transaction([
      ...arrastres.map((arrastre) =>
        prisma.lineaPresupuesto.upsert({
          where: {
            presupuestoId_categoriaId: {
              presupuestoId: destino.id,
              categoriaId: arrastre.categoriaId,
            },
          },
          create: {
            presupuestoId: destino.id,
            categoriaId: arrastre.categoriaId,
            arrastrado: BigInt(arrastre.arrastrado),
            rollover: true,
          },
          update: { arrastrado: BigInt(arrastre.arrastrado) },
        }),
      ),
      // La foto del mes cerrado se guarda calculada: así el histórico no
      // cambia si mañana se corrige un movimiento viejo, y el cierre significa
      // algo. Lo vivo se sigue calculando al vuelo.
      prisma.periodoPresupuesto.upsert({
        where: { espacioId_mes: { espacioId: contexto.espacioId, mes: primerDia(mes) } },
        create: {
          espacioId: contexto.espacioId,
          mes: primerDia(mes),
          ingresosReales: BigInt(estado.ingresos.confirmado),
          gastosReales: BigInt(estado.resumen.gastado),
          ahorroReal: BigInt(estado.ingresos.confirmado - estado.resumen.gastado),
          previstoTotal: BigInt(estado.resumen.asignado),
          cerradoEn: new Date(),
          resumen: { sobres: estado.sobres.length, pasados: estado.resumen.sobresPasados },
        },
        update: {
          ingresosReales: BigInt(estado.ingresos.confirmado),
          gastosReales: BigInt(estado.resumen.gastado),
          ahorroReal: BigInt(estado.ingresos.confirmado - estado.resumen.gastado),
          previstoTotal: BigInt(estado.resumen.asignado),
          cerradoEn: new Date(),
          resumen: { sobres: estado.sobres.length, pasados: estado.resumen.sobresPasados },
        },
      }),
    ])

    return { mes, siguiente, arrastrados: arrastres.length }
  })
}
