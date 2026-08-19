import {
  cicloDe,
  cuadroConAmortizaciones,
  esCuentaVisiblePara,
  estadoDePosicion,
  generarCuadro,
  patrimonioNeto,
  proyectarSaldo,
  serieDePatrimonio,
  valorarPosicion,
  variacion,
  type ApunteFuturo,
  type ComponentePatrimonio,
  type MovimientoInversion,
  type Prestamo,
} from '@norte/dominio'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { exigirEspacio } from '../acceso.js'
import { usuarioDe } from '../servidor.js'

/**
 * El cuadro: todo lo que hay que ver de un vistazo.
 *
 * Una sola petición. Un panel que dispara ocho llamadas se pinta a trozos y
 * cada trozo aparece cuando le apetece; eso, en la pantalla que se abre todos
 * los días, se nota más que en ninguna otra.
 */

const DIAS_PROYECCION = 30

function aISO(fecha: Date): string {
  return fecha.toISOString().slice(0, 10)
}

function primerDiaDelMes(fecha: Date): Date {
  return new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), 1))
}

export async function rutasCuadro(app: FastifyInstance, opciones: { prisma: PrismaClient }) {
  const { prisma } = opciones

  async function reunir(espacioId: string, usuarioId: string) {
    const hoy = new Date()
    const hoyISO = aISO(hoy)
    const hasta = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + DIAS_PROYECCION)

    const [cuentas, saldos, deudas, carteras, tarjetas, fotos, previstos, documentos] = await Promise.all([
      prisma.cuenta.findMany({
        where: { espacioId, borradaEn: null },
        select: {
          id: true,
          nombre: true,
          tipo: true,
          propietarioId: true,
          visibleEnEspacio: true,
          computaPatrimonio: true,
          saldoInicial: true,
          archivadaEn: true,
        },
      }),
      prisma.movimiento.groupBy({
        by: ['cuentaId'],
        where: { espacioId, borradoEn: null, estado: 'confirmado' },
        _sum: { importe: true },
      }),
      prisma.deuda.findMany({
        where: { espacioId, borradaEn: null, liquidadaEn: null },
        include: { amortizaciones: { orderBy: { fecha: 'asc' } } },
      }),
      prisma.cuentaInversion.findMany({
        where: { espacioId, borradaEn: null },
        include: {
          posiciones: {
            where: { borradaEn: null },
            include: { movimientos: { orderBy: { fecha: 'asc' } } },
          },
        },
      }),
      prisma.tarjeta.findMany({ where: { espacioId, borradaEn: null } }),
      prisma.fotoPatrimonio.findMany({
        where: { espacioId },
        orderBy: { mes: 'asc' },
        take: 36,
      }),
      prisma.movimiento.findMany({
        where: {
          espacioId,
          borradoEn: null,
          estado: 'previsto',
          fecha: { gte: new Date(hoyISO), lte: hasta },
        },
        select: { fecha: true, importe: true, concepto: true, cuentaId: true },
        orderBy: { fecha: 'asc' },
      }),
      prisma.documento.count({ where: { espacioId, borradoEn: null, estado: 'revision' } }),
    ])

    const visibles = cuentas.filter((c) => esCuentaVisiblePara(c, usuarioId))
    const idsVisibles = new Set(visibles.map((c) => c.id))
    const porCuenta = new Map(saldos.map((s) => [s.cuentaId, Number(s._sum.importe ?? 0)]))
    const saldoDe = (cuenta: { id: string; saldoInicial: bigint }) =>
      Number(cuenta.saldoInicial) + (porCuenta.get(cuenta.id) ?? 0)

    // Las cuentas que ya representa otra cosa (una deuda, una cuenta de
    // inversión) no se cuentan dos veces.
    const yaContadas = new Set(
      [...deudas.map((d) => d.cuentaId), ...carteras.map((c) => c.cuentaId)].filter(
        (id): id is string => id !== null,
      ),
    )

    const componentes: ComponentePatrimonio[] = []
    let liquido = 0

    for (const cuenta of visibles) {
      if (!cuenta.computaPatrimonio || cuenta.archivadaEn !== null) continue
      if (yaContadas.has(cuenta.id)) continue
      const saldo = saldoDe(cuenta)

      if (cuenta.tipo === 'corriente' || cuenta.tipo === 'ahorro' || cuenta.tipo === 'efectivo') {
        liquido += saldo
        if (saldo !== 0) componentes.push({ nombre: cuenta.nombre, clase: 'liquido', valor: saldo })
      } else if (cuenta.tipo === 'tarjeta_credito') {
        const dispuesto = Math.max(0, -saldo)
        if (dispuesto > 0) componentes.push({ nombre: cuenta.nombre, clase: 'tarjeta', valor: dispuesto })
      } else if (cuenta.tipo === 'prestamo') {
        const debido = Math.max(0, -saldo)
        if (debido > 0) componentes.push({ nombre: cuenta.nombre, clase: 'deuda', valor: debido })
      } else if (cuenta.tipo === 'activo_no_liquido') {
        if (saldo !== 0) componentes.push({ nombre: cuenta.nombre, clase: 'bien', valor: saldo })
      } else if (cuenta.tipo === 'inversion') {
        if (saldo !== 0) componentes.push({ nombre: cuenta.nombre, clase: 'inversion', valor: saldo })
      }
    }

    // ── Deudas, con su cuadro recalculado ──────────────────────────────────
    const vencimientos: { fecha: string; concepto: string; importe: number; origen: string }[] = []

    for (const deuda of deudas) {
      const prestamo: Prestamo = {
        principal: Number(deuda.principalOriginal),
        tinAnual: Number(deuda.tin),
        meses: deuda.plazoMeses,
        sistema: deuda.sistema as Prestamo['sistema'],
        primerPago: aISO(deuda.fechaPrimerPago),
      }
      const base = generarCuadro(prestamo)
      const extras = deuda.amortizaciones.map((a) => ({
        trasCuota: base.filter((c) => c.fecha <= aISO(a.fecha)).length,
        importe: Number(a.importe),
        modo: (a.reducePlazo ? 'reducir_plazo' : 'reducir_cuota') as 'reducir_plazo' | 'reducir_cuota',
      }))
      const cuadro = extras.length > 0 ? cuadroConAmortizaciones(prestamo, extras) : base

      const pagadas = cuadro.filter((c) => c.fecha <= hoyISO)
      const pendiente = pagadas.length > 0 ? pagadas[pagadas.length - 1]!.saldoVivo : prestamo.principal
      if (pendiente > 0) componentes.push({ nombre: deuda.nombre, clase: 'deuda', valor: pendiente })

      for (const cuota of cuadro) {
        if (cuota.fecha > hoyISO && cuota.fecha <= aISO(hasta)) {
          vencimientos.push({
            fecha: cuota.fecha,
            concepto: deuda.nombre,
            importe: -cuota.cuota,
            origen: 'deuda',
          })
        }
      }
    }

    // ── Cartera ────────────────────────────────────────────────────────────
    let valorCartera = 0
    for (const cartera of carteras) {
      let valor = 0
      for (const posicion of cartera.posiciones) {
        const movimientos: MovimientoInversion[] = posicion.movimientos.map((m) => ({
          tipo: m.tipo as MovimientoInversion['tipo'],
          fecha: aISO(m.fecha),
          participaciones: Number(m.participaciones),
          importe: Number(m.importe),
          comision: Number(m.comision),
        }))
        const estado = estadoDePosicion(movimientos)
        valor += valorarPosicion(estado, posicion.ultimoPrecio === null ? null : Number(posicion.ultimoPrecio)).valor
      }
      if (valor > 0) componentes.push({ nombre: cartera.nombre, clase: 'inversion', valor })
      valorCartera += valor
    }

    // ── Tarjetas: lo dispuesto y cuándo se cobra ───────────────────────────
    for (const tarjeta of tarjetas) {
      if (!idsVisibles.has(tarjeta.cuentaId)) continue
      const ciclos = cicloDe({ diaCorte: tarjeta.diaCorte, diaPago: tarjeta.diaPago }, hoy)
      const saldo = porCuenta.get(tarjeta.cuentaId) ?? 0
      const dispuesto = Math.max(0, -saldo)
      if (dispuesto > 0 && ciclos.anterior.fechaPago >= hoyISO && ciclos.anterior.fechaPago <= aISO(hasta)) {
        vencimientos.push({
          fecha: ciclos.anterior.fechaPago,
          concepto: `${tarjeta.nombre} (recibo)`,
          importe: -dispuesto,
          origen: 'tarjeta',
        })
      }
    }

    // ── Proyección ─────────────────────────────────────────────────────────
    const apuntes: ApunteFuturo[] = [
      ...previstos
        .filter((p) => idsVisibles.has(p.cuentaId))
        .map((p) => ({ fecha: aISO(p.fecha), importe: Number(p.importe), concepto: p.concepto })),
      ...vencimientos.map((v) => ({ fecha: v.fecha, importe: v.importe, concepto: v.concepto })),
    ]
    const proyeccion = proyectarSaldo({
      saldoInicial: liquido,
      desde: hoyISO,
      dias: DIAS_PROYECCION,
      apuntes,
    })

    const patrimonio = patrimonioNeto(componentes)
    const serie = serieDePatrimonio(
      fotos.map((f) => ({ mes: aISO(f.mes), neto: Number(f.patrimonioNeto) })),
    )

    // La comparación es contra la foto del mes pasado, no contra la primera:
    // «cómo voy este mes» es la pregunta que se hace al abrir la app.
    const anterior = fotos.filter((f) => aISO(f.mes) < aISO(primerDiaDelMes(hoy)))
    const ultimaAnterior = anterior[anterior.length - 1]

    return {
      patrimonio,
      variacionMes: ultimaAnterior
        ? variacion(patrimonio.neto, Number(ultimaAnterior.patrimonioNeto))
        : null,
      historico: serie,
      proyeccion,
      liquido,
      valorCartera,
      vencimientos: [...apuntes]
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
        .slice(0, 8),
      documentosPorRevisar: documentos,
    }
  }

  app.get('/api/espacios/:id/cuadro', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'lector')
    return reunir(contexto.espacioId, usuario.id)
  })

  /**
   * Guarda la foto del patrimonio de este mes.
   *
   * Es idempotente por mes: la llama la propia pantalla al abrirse, así que la
   * foto del mes en curso se mantiene fresca y las de los meses pasados quedan
   * congeladas. Sin cron y sin tarea en el servidor.
   *
   * La contrapartida hay que decirla: **un mes en el que no abras Norte no
   * tendrá punto en el gráfico**. Es el precio de no montar un temporizador, y
   * es mejor que un hueco silencioso mal explicado.
   */
  app.post('/api/espacios/:id/cuadro/foto', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')
    const datos = await reunir(contexto.espacioId, usuario.id)
    const mes = primerDiaDelMes(new Date())

    await prisma.fotoPatrimonio.upsert({
      where: { espacioId_mes: { espacioId: contexto.espacioId, mes } },
      create: {
        espacioId: contexto.espacioId,
        mes,
        activos: BigInt(datos.patrimonio.activos),
        pasivos: BigInt(datos.patrimonio.pasivos),
        patrimonioNeto: BigInt(datos.patrimonio.neto),
        desglose: { componentes: datos.patrimonio.componentes } as object,
      },
      update: {
        activos: BigInt(datos.patrimonio.activos),
        pasivos: BigInt(datos.patrimonio.pasivos),
        patrimonioNeto: BigInt(datos.patrimonio.neto),
        desglose: { componentes: datos.patrimonio.componentes } as object,
      },
    })
    return { guardada: true as const, mes: aISO(mes) }
  })
}
