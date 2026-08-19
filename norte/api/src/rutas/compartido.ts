import {
  calcularSaldos,
  cuentasDeSocios,
  comprobarParticipaciones,
  ErrorNegocio,
  ErrorReparto,
  clasificarPorPlazo,
  TIPOS_REPARTO,
  type GastoCompartido,
  type Reparto,
  type TipoReparto,
} from '@norte/dominio'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { exigirEspacio } from '../acceso.js'
import { conflicto, datosInvalidos, noEncontrado } from '../errores.js'
import { usuarioDe } from '../servidor.js'

/**
 * Espacios compartidos: repartos, liquidaciones y modo negocio.
 *
 * Tres decisiones que sostienen todo lo de aquí:
 *
 *  · **Quién pagó es el dueño de la cuenta de la que salió el dinero.** No hay
 *    un campo «pagador» que rellenar y que alguien olvidará: sale del hecho.
 *
 *  · **La cuenta del periodo se calcula, no se guarda.** Lo único que se
 *    persiste es el cierre (`liquidaciones` + `pagos_liquidacion`), que es una
 *    decisión y por tanto un hecho. Mientras el periodo está abierto, corregir
 *    un gasto corrige la cuenta; una vez cerrado, ya no la mueve.
 *
 *  · **Un gasto compartido de una cuenta privada SÍ entra en la cuenta común,
 *    pero sin decir de qué cuenta salió.** Quien comparte un gasto está
 *    diciendo «esto lo pagué yo y te toca la mitad»: el otro tiene que poder
 *    ver el concepto y el importe para estar de acuerdo. Lo que no tiene por
 *    qué ver es en qué cuenta lo tiene domiciliado. Por eso la cuenta común
 *    nunca devuelve `cuentaId` ni el nombre de la cuenta.
 */

const esquemaReparto = z.object({
  nombre: z.string().trim().min(1, 'El reparto necesita un nombre.').max(80),
  tipo: z.enum(TIPOS_REPARTO as unknown as [TipoReparto, ...TipoReparto[]]),
  partes: z
    .array(
      z.object({
        usuarioId: z.string().min(1),
        porcentaje: z.number().min(0).max(100).optional(),
        importeFijo: z.number().int().min(0).max(100_000_000).nullable().optional(),
      }),
    )
    .min(1, 'Un reparto necesita al menos un participante.')
    .max(20),
})

const esquemaCapital = z.object({
  usuarioId: z.string().min(1),
  tipo: z.enum(['aportacion', 'retirada', 'reparto_beneficios']),
  importe: z.number().int().min(1).max(1_000_000_000),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha va como aaaa-mm-dd.'),
  notas: z.string().trim().max(300).optional(),
})

const FECHA = /^\d{4}-\d{2}-\d{2}$/

function comoFecha(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`)
}

function comoIso(fecha: Date): string {
  return fecha.toISOString().slice(0, 10)
}

/** El día siguiente, para que un periodo empiece donde acabó el anterior. */
function diaSiguiente(iso: string): string {
  const fecha = comoFecha(iso)
  fecha.setUTCDate(fecha.getUTCDate() + 1)
  return comoIso(fecha)
}

export async function rutasCompartido(app: FastifyInstance, opciones: { prisma: PrismaClient }) {
  const { prisma } = opciones

  /** Los miembros de alta, que son entre quienes se reparte. */
  async function miembrosDe(espacioId: string) {
    return prisma.miembroEspacio.findMany({
      where: { espacioId, bajaEn: null },
      include: { usuario: { select: { id: true, nombre: true, email: true } } },
      orderBy: { altaEn: 'asc' },
    })
  }

  async function repartosDe(espacioId: string) {
    return prisma.reparto.findMany({
      where: { espacioId, borradoEn: null },
      include: { partes: true },
      orderBy: { creadoEn: 'asc' },
    })
  }

  // ─────────────────────────────────────────────── Repartos

  app.get('/api/espacios/:id/repartos', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'lector')

    const [repartos, miembros] = await Promise.all([
      repartosDe(contexto.espacioId),
      miembrosDe(contexto.espacioId),
    ])

    return {
      repartos: repartos.map((reparto) => ({
        id: reparto.id,
        nombre: reparto.nombre,
        tipo: reparto.tipo as TipoReparto,
        partes: reparto.partes.map((parte) => ({
          usuarioId: parte.usuarioId,
          porcentaje: Number(parte.porcentaje),
          importeFijo: Number(parte.importeFijo),
        })),
      })),
      miembros: miembros.map((miembro) => ({
        usuarioId: miembro.usuarioId,
        nombre: miembro.usuario.nombre,
        email: miembro.usuario.email,
        rol: miembro.rol,
        participacion: Number(miembro.participacion),
      })),
    }
  })

  /** Que todas las partes sean miembros: un reparto no puede nombrar a alguien
   *  de fuera, ni convertirse en una forma de descubrir ids de usuario. */
  async function comprobarPartes(espacioId: string, partes: { usuarioId: string }[]) {
    const miembros = new Set((await miembrosDe(espacioId)).map((m) => m.usuarioId))
    for (const parte of partes) {
      if (!miembros.has(parte.usuarioId)) {
        throw datosInvalidos('Hay alguien en el reparto que no es miembro de este espacio.')
      }
    }
  }

  app.post('/api/espacios/:id/repartos', async (peticion, respuesta) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')
    const datos = esquemaReparto.parse(peticion.body)
    await comprobarPartes(contexto.espacioId, datos.partes)

    const reparto = await prisma.reparto.create({
      data: {
        espacioId: contexto.espacioId,
        nombre: datos.nombre,
        tipo: datos.tipo,
        partes: {
          create: datos.partes.map((parte) => ({
            usuarioId: parte.usuarioId,
            porcentaje: parte.porcentaje ?? 0,
            importeFijo: BigInt(parte.importeFijo ?? 0),
          })),
        },
      },
      include: { partes: true },
    })

    respuesta.code(201)
    return { reparto: { id: reparto.id, nombre: reparto.nombre, tipo: reparto.tipo } }
  })

  app.patch('/api/espacios/:id/repartos/:repartoId', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id, repartoId } = peticion.params as { id: string; repartoId: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')
    const datos = esquemaReparto.parse(peticion.body)
    await comprobarPartes(contexto.espacioId, datos.partes)

    const existente = await prisma.reparto.findFirst({
      where: { id: repartoId, espacioId: contexto.espacioId, borradoEn: null },
    })
    if (!existente) throw noEncontrado('Ese reparto no existe.')

    await prisma.$transaction([
      prisma.parteReparto.deleteMany({ where: { repartoId } }),
      prisma.reparto.update({
        where: { id: repartoId },
        data: {
          nombre: datos.nombre,
          tipo: datos.tipo,
          partes: {
            create: datos.partes.map((parte) => ({
              usuarioId: parte.usuarioId,
              porcentaje: parte.porcentaje ?? 0,
              importeFijo: BigInt(parte.importeFijo ?? 0),
            })),
          },
        },
      }),
    ])

    return { ok: true }
  })

  app.delete('/api/espacios/:id/repartos/:repartoId', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id, repartoId } = peticion.params as { id: string; repartoId: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')

    const existente = await prisma.reparto.findFirst({
      where: { id: repartoId, espacioId: contexto.espacioId, borradoEn: null },
    })
    if (!existente) throw noEncontrado('Ese reparto no existe.')

    // Se marca como borrado, no se borra: los movimientos que lo usaron siguen
    // apuntando a él y las liquidaciones ya cerradas tienen que poder
    // explicarse dentro de un año.
    await prisma.reparto.update({ where: { id: repartoId }, data: { borradoEn: new Date() } })
    return { ok: true }
  })

  // ─────────────────────────────────────────────── La cuenta del periodo

  /**
   * La cuenta del periodo abierto. Es una función y no solo una ruta porque el
   * cierre la necesita: quien firma un cierre no puede ser quien decide las
   * cifras, así que el servidor las vuelve a calcular aquí mismo en lugar de
   * fiarse de lo que mande el navegador.
   */
  async function calcularCuenta(espacioId: string) {
    const [miembros, repartos, ultima] = await Promise.all([
      miembrosDe(espacioId),
      repartosDe(espacioId),
      prisma.liquidacion.findFirst({ where: { espacioId }, orderBy: { hasta: 'desc' } }),
    ])

    const cierre = ultima
      ? { hasta: comoIso(ultima.hasta), cerradoEn: ultima.creadaEn.toISOString() }
      : null
    const desde = ultima ? diaSiguiente(comoIso(ultima.hasta)) : null

    const movimientos = await prisma.movimiento.findMany({
      where: { espacioId, esCompartido: true, borradoEn: null, estado: 'confirmado' },
      include: {
        cuenta: { select: { propietarioId: true } },
        reparto: { include: { partes: true } },
      },
      orderBy: { fecha: 'asc' },
    })

    const unico = repartos.length === 1 ? repartos[0] : null
    const sinReparto: { id: string; fecha: string; concepto: string; importe: number }[] = []
    const gastos: (GastoCompartido & { apuntadoEn: string })[] = []
    // Los ingresos con los que se ha repartido, mes a mes. Un reparto «según
    // los ingresos» sin enseñar los ingresos es pedir un acto de fe: quien
    // recibe la cifra tiene derecho a ver de dónde sale.
    const ingresosUsados = new Map<string, Map<string, number>>()

    for (const movimiento of movimientos) {
      const fecha = comoIso(movimiento.fecha)
      // El gasto, en positivo. Un ingreso compartido (una devolución, un
      // regalo común) sale en negativo y se reparte igual.
      const importe = -Number(movimiento.importe)
      const elegido = movimiento.reparto ?? unico

      if (!elegido) {
        // Sin regla no se inventa una: partir a medias por defecto sería
        // decidir por dos personas algo que no han acordado.
        sinReparto.push({ id: movimiento.id, fecha, concepto: movimiento.concepto, importe })
        continue
      }

      gastos.push({
        id: movimiento.id,
        fecha,
        concepto: movimiento.concepto,
        importe,
        pagadoPor: movimiento.cuenta.propietarioId,
        apuntadoEn: movimiento.creadoEn.toISOString(),
        reparto: await comoRepartoDeDominio(elegido, espacioId, fecha, ingresosUsados),
      })
    }

    // Lo que ya se liquidó desaparece sin ruido; lo que llegó tarde se avisa.
    const { enPlazo, tardios } = clasificarPorPlazo(gastos, cierre)

    let cuenta
    try {
      cuenta = calcularSaldos(
        enPlazo,
        miembros.map((m) => m.usuarioId),
      )
    } catch (error) {
      if (error instanceof ErrorReparto) throw datosInvalidos(error.message)
      throw error
    }

    const nombre = (usuarioId: string) =>
      miembros.find((m) => m.usuarioId === usuarioId)?.usuario.nombre ?? 'Alguien'

    return {
      desde,
      hasta: comoIso(new Date()),
      total: cuenta.total,
      saldos: cuenta.saldos.map((saldo) => ({ ...saldo, nombre: nombre(saldo.usuarioId) })),
      pagos: cuenta.pagos.map((pago) => ({
        ...pago,
        deNombre: nombre(pago.deUsuarioId),
        aNombre: nombre(pago.aUsuarioId),
      })),
      // Sin `cuentaId` ni nombre de cuenta: ver la nota de la cabecera.
      gastos: enPlazo.map((gasto) => ({
        id: gasto.id,
        fecha: gasto.fecha,
        concepto: gasto.concepto,
        importe: gasto.importe,
        pagadoPor: gasto.pagadoPor,
        pagadoPorNombre: nombre(gasto.pagadoPor),
      })),
      tardios: tardios.map((gasto) => ({
        id: gasto.id,
        fecha: gasto.fecha,
        concepto: gasto.concepto,
        importe: gasto.importe,
      })),
      sinReparto,
      // Solo los meses que de verdad han entrado en esta cuenta. Explicar el
      // reparto de un gasto que ya se pagó el mes pasado es ruido.
      ingresosUsados: [...ingresosUsados.entries()]
        .filter(([mes]) => enPlazo.some((gasto) => gasto.fecha.slice(0, 7) === mes))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([mes, porPersona]) => ({
          mes,
          personas: miembros.map((miembro) => ({
            usuarioId: miembro.usuarioId,
            nombre: miembro.usuario.nombre,
            ingreso: porPersona.get(miembro.usuarioId) ?? 0,
          })),
        })),
    }
  }

  app.get('/api/espacios/:id/cuenta', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'lector')
    return calcularCuenta(contexto.espacioId)
  })

  /**
   * Traduce el reparto de la base al del dominio. En `proporcional_ingresos`
   * hay que ir a buscar los ingresos reales del periodo, que no se guardan en
   * la regla: guardarlos la dejaría vieja al mes siguiente.
   */
  async function comoRepartoDeDominio(
    reparto: { tipo: string; partes: { usuarioId: string; porcentaje: unknown; importeFijo: bigint }[] },
    espacioId: string,
    fecha: string,
    usados: Map<string, Map<string, number>>,
  ): Promise<Reparto> {
    const partes = reparto.partes.map((parte) => ({
      usuarioId: parte.usuarioId,
      porcentaje: Number(parte.porcentaje),
      importeFijo: Number(parte.importeFijo) > 0 ? Number(parte.importeFijo) : null,
    }))

    if (reparto.tipo !== 'proporcional_ingresos') {
      return { tipo: reparto.tipo as TipoReparto, partes }
    }

    const mes = fecha.slice(0, 7)
    // El mapa hace de caché además de servir para explicarlo en pantalla: sin
    // esto, un periodo con treinta gastos compartidos lanzaba treinta
    // consultas de ingresos para preguntar treinta veces por el mismo mes.
    let ingresos = usados.get(mes)
    if (!ingresos) {
      ingresos = await ingresosDelMes(espacioId, mes)
      usados.set(mes, ingresos)
    }
    return {
      tipo: 'proporcional_ingresos',
      partes: partes.map((parte) => ({ ...parte, ingreso: ingresos.get(parte.usuarioId) ?? 0 })),
    }
  }

  /**
   * Lo que ha ingresado cada uno en sus cuentas del espacio ese mes. Es la
   * única definición de «ingresos» que Norte puede comprobar; los sueldos que
   * no pasan por aquí no los conoce, y por eso la pantalla dice de dónde sale
   * el número en vez de dejar que alguien suponga.
   */
  async function ingresosDelMes(espacioId: string, mes: string): Promise<Map<string, number>> {
    const desde = comoFecha(`${mes}-01`)
    const hasta = new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth() + 1, 1))

    const movimientos = await prisma.movimiento.findMany({
      where: {
        espacioId,
        borradoEn: null,
        estado: 'confirmado',
        fecha: { gte: desde, lt: hasta },
        importe: { gt: 0 },
        categoria: { flujo: 'ingreso' },
      },
      include: { cuenta: { select: { propietarioId: true } } },
    })

    const total = new Map<string, number>()
    for (const movimiento of movimientos) {
      const quien = movimiento.cuenta.propietarioId
      total.set(quien, (total.get(quien) ?? 0) + Number(movimiento.importe))
    }
    return total
  }

  // ─────────────────────────────────────────────── Cierres

  app.get('/api/espacios/:id/liquidaciones', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'lector')

    const [liquidaciones, miembros] = await Promise.all([
      prisma.liquidacion.findMany({
        where: { espacioId: contexto.espacioId },
        include: { pagos: true },
        orderBy: { hasta: 'desc' },
        take: 24,
      }),
      miembrosDe(contexto.espacioId),
    ])

    const nombre = (usuarioId: string) =>
      miembros.find((m) => m.usuarioId === usuarioId)?.usuario.nombre ?? 'Alguien'

    return {
      liquidaciones: liquidaciones.map((liquidacion) => ({
        id: liquidacion.id,
        desde: comoIso(liquidacion.desde),
        hasta: comoIso(liquidacion.hasta),
        estado: liquidacion.estado,
        saldadaEn: liquidacion.saldadaEn?.toISOString() ?? null,
        pagos: liquidacion.pagos.map((pago) => ({
          id: pago.id,
          deUsuarioId: pago.deUsuarioId,
          aUsuarioId: pago.aUsuarioId,
          deNombre: nombre(pago.deUsuarioId),
          aNombre: nombre(pago.aUsuarioId),
          importe: Number(pago.importe),
          pagadoEn: pago.pagadoEn?.toISOString() ?? null,
        })),
      })),
    }
  })

  app.post('/api/espacios/:id/liquidaciones', async (peticion, respuesta) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')
    const cuerpo = z
      .object({ hasta: z.string().regex(FECHA).optional() })
      .parse(peticion.body ?? {})

    const abierta = await prisma.liquidacion.findFirst({
      where: { espacioId: contexto.espacioId, estado: 'pendiente' },
    })
    if (abierta) {
      throw conflicto('Ya hay un cierre pendiente de saldar. Márcalo como pagado antes de cerrar otro.')
    }

    const cuenta = await calcularCuenta(contexto.espacioId)

    if (cuenta.pagos.length === 0) {
      throw conflicto('No hay nada que liquidar: las cuentas ya están a cero.')
    }

    const primero = cuenta.gastos.map((gasto) => gasto.fecha).sort()[0]
    const desde = cuenta.desde ?? primero ?? cuenta.hasta
    const hasta = cuerpo.hasta ?? cuenta.hasta

    const liquidacion = await prisma.liquidacion.create({
      data: {
        espacioId: contexto.espacioId,
        desde: comoFecha(desde),
        hasta: comoFecha(hasta),
        pagos: {
          create: cuenta.pagos.map((pago) => ({
            deUsuarioId: pago.deUsuarioId,
            aUsuarioId: pago.aUsuarioId,
            importe: BigInt(pago.importe),
          })),
        },
      },
      include: { pagos: true },
    })

    await prisma.registroActividad.create({
      data: {
        espacioId: contexto.espacioId,
        usuarioId: usuario.id,
        accion: 'liquidacion.cerrada',
        entidad: 'liquidacion',
        entidadId: liquidacion.id,
        detalle: { desde, hasta, pagos: liquidacion.pagos.length },
      },
    })

    respuesta.code(201)
    return { liquidacion: { id: liquidacion.id, desde, hasta, pagos: liquidacion.pagos.length } }
  })

  app.post('/api/espacios/:id/liquidaciones/:liquidacionId/saldar', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id, liquidacionId } = peticion.params as { id: string; liquidacionId: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')

    const liquidacion = await prisma.liquidacion.findFirst({
      where: { id: liquidacionId, espacioId: contexto.espacioId },
    })
    if (!liquidacion) throw noEncontrado('Ese cierre no existe.')
    if (liquidacion.estado === 'saldada') return { ok: true, yaEstaba: true }

    const ahora = new Date()
    await prisma.$transaction([
      prisma.pagoLiquidacion.updateMany({
        where: { liquidacionId, pagadoEn: null },
        data: { pagadoEn: ahora },
      }),
      prisma.liquidacion.update({
        where: { id: liquidacionId },
        data: { estado: 'saldada', saldadaEn: ahora },
      }),
    ])

    return { ok: true }
  })

  // ─────────────────────────────────────────────── Modo negocio

  app.get('/api/espacios/:id/negocio', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'lector')

    const espacio = await prisma.espacio.findUnique({ where: { id: contexto.espacioId } })
    if (!espacio || espacio.tipo !== 'negocio') {
      throw noEncontrado('Este espacio no es un negocio.')
    }

    const [miembros, capital, resultado] = await Promise.all([
      miembrosDe(contexto.espacioId),
      prisma.movimientoCapital.findMany({
        where: { espacioId: contexto.espacioId },
        orderBy: { fecha: 'desc' },
        take: 200,
      }),
      resultadoDelEjercicio(contexto.espacioId),
    ])

    const socios = miembros.map((miembro) => ({
      usuarioId: miembro.usuarioId,
      participacion: Number(miembro.participacion),
    }))

    let cuentas: ReturnType<typeof cuentasDeSocios> | null = null
    let aviso: string | null = null
    try {
      cuentas = cuentasDeSocios(
        socios,
        capital.map((movimiento) => ({
          usuarioId: movimiento.usuarioId,
          tipo: movimiento.tipo,
          importe: Number(movimiento.importe),
        })),
        resultado,
      )
    } catch (error) {
      if (error instanceof ErrorNegocio) aviso = error.message
      else throw error
    }

    return {
      resultado,
      aviso,
      socios: (cuentas ?? []).map((cuenta) => ({
        ...cuenta,
        nombre: miembros.find((m) => m.usuarioId === cuenta.usuarioId)?.usuario.nombre ?? 'Socio',
      })),
      movimientos: capital.map((movimiento) => ({
        id: movimiento.id,
        usuarioId: movimiento.usuarioId,
        nombre: miembros.find((m) => m.usuarioId === movimiento.usuarioId)?.usuario.nombre ?? 'Socio',
        tipo: movimiento.tipo,
        importe: Number(movimiento.importe),
        fecha: comoIso(movimiento.fecha),
        notas: movimiento.notas,
      })),
    }
  })

  /** Ingresos menos gastos del año en curso. El resultado que se reparte. */
  async function resultadoDelEjercicio(espacioId: string): Promise<number> {
    const anio = new Date().getUTCFullYear()
    const movimientos = await prisma.movimiento.findMany({
      where: {
        espacioId,
        borradoEn: null,
        estado: 'confirmado',
        fecha: { gte: comoFecha(`${anio}-01-01`), lte: comoFecha(`${anio}-12-31`) },
        categoria: { flujo: { in: ['ingreso', 'gasto'] } },
      },
      select: { importe: true },
    })
    return movimientos.reduce((total, movimiento) => total + Number(movimiento.importe), 0)
  }

  app.post('/api/espacios/:id/negocio/capital', async (peticion, respuesta) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')
    const datos = esquemaCapital.parse(peticion.body)

    const espacio = await prisma.espacio.findUnique({ where: { id: contexto.espacioId } })
    if (!espacio || espacio.tipo !== 'negocio') throw noEncontrado('Este espacio no es un negocio.')

    const socio = await prisma.miembroEspacio.findFirst({
      where: { espacioId: contexto.espacioId, usuarioId: datos.usuarioId, bajaEn: null },
    })
    if (!socio) throw datosInvalidos('Ese socio no es miembro de este espacio.')

    const movimiento = await prisma.movimientoCapital.create({
      data: {
        espacioId: contexto.espacioId,
        usuarioId: datos.usuarioId,
        tipo: datos.tipo,
        importe: BigInt(datos.importe),
        fecha: comoFecha(datos.fecha),
        notas: datos.notas ?? null,
      },
    })

    respuesta.code(201)
    return { movimiento: { id: movimiento.id } }
  })

  app.patch('/api/espacios/:id/participaciones', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    // Cambiar quién posee cuánto de una sociedad no es tarea de un editor.
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'propietario')
    const datos = z
      .object({
        participaciones: z
          .array(z.object({ usuarioId: z.string().min(1), participacion: z.number().min(0).max(100) }))
          .min(1)
          .max(20),
      })
      .parse(peticion.body)

    const miembros = await miembrosDe(contexto.espacioId)
    const conocidos = new Set(miembros.map((m) => m.usuarioId))
    for (const parte of datos.participaciones) {
      if (!conocidos.has(parte.usuarioId)) {
        throw datosInvalidos('Hay alguien que no es miembro de este espacio.')
      }
    }
    if (datos.participaciones.length !== miembros.length) {
      throw datosInvalidos('Faltan socios: las participaciones se envían todas juntas.')
    }

    try {
      comprobarParticipaciones(datos.participaciones)
    } catch (error) {
      if (error instanceof ErrorNegocio) throw datosInvalidos(error.message)
      throw error
    }

    await prisma.$transaction(
      datos.participaciones.map((parte) =>
        prisma.miembroEspacio.updateMany({
          where: { espacioId: contexto.espacioId, usuarioId: parte.usuarioId },
          data: { participacion: parte.participacion },
        }),
      ),
    )

    return { ok: true }
  })

}
