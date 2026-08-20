import { esCuentaVisiblePara } from '@norte/dominio'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { exigirEspacio } from '../acceso.js'
import { usuarioDe } from '../servidor.js'

/**
 * Sacar tus datos de Norte.
 *
 * Es la contrapartida del licenciamiento y va deliberadamente en el mismo
 * despliegue: **exportar pide rol de lector y nunca pregunta por la licencia**.
 * Una aplicación que te deja de dejar sacar tus datos cuando dejas de pagarle
 * no te vendió un programa, te alquiló tus propios movimientos.
 *
 * Dos formatos, cada uno para lo suyo:
 *  · **JSON** — todo el espacio, tal cual, para volver a montarlo o para
 *    guardarlo. Los importes van en céntimos enteros, como en la base.
 *  · **CSV** — los movimientos, que es lo que la gente abre en una hoja de
 *    cálculo. Con `;` y coma decimal, que es lo que espera un Excel en español.
 *
 * Lo que **no** sale: nada de otra persona. La visibilidad de cuentas se
 * respeta igual que en el resto de la aplicación; exportar no puede ser la
 * puerta de atrás para leer la cuenta privada de quien comparte espacio.
 */

function comoIso(fecha: Date): string {
  return fecha.toISOString().slice(0, 10)
}

/** Un campo de CSV para un Excel en español: separador `;` y coma decimal. */
function campo(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  const texto = String(valor)
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

/**
 * Un campo de texto que ha escrito una persona. Además de entrecomillar, se
 * neutraliza la **inyección de fórmulas**: Excel ejecuta como fórmula cualquier
 * celda que empiece por `=`, `+`, `-` o `@` (y las hojas de cálculo llegan a
 * lanzar comandos con `=cmd|…`). En un espacio compartido esto es un ataque de
 * verdad: un miembro escribe un concepto que empieza por `=` y el ordenador
 * del otro lo ejecuta al abrir SU exportación. El apóstrofo delante le dice a
 * Excel «esto es texto» y no se ve en la celda.
 */
function textoDePersona(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  const texto = String(valor)
  return campo(/^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto)
}

function euros(centimos: bigint | number): string {
  const entero = typeof centimos === 'bigint' ? centimos : BigInt(Math.round(centimos))
  const negativo = entero < 0n
  const abs = negativo ? -entero : entero
  return `${negativo ? '-' : ''}${abs / 100n},${String(abs % 100n).padStart(2, '0')}`
}

export async function rutasExportar(app: FastifyInstance, opciones: { prisma: PrismaClient }) {
  const { prisma } = opciones

  async function cuentasVisibles(espacioId: string, usuarioId: string) {
    const cuentas = await prisma.cuenta.findMany({
      where: { espacioId, borradaEn: null },
      orderBy: { creadaEn: 'asc' },
    })
    return cuentas.filter((cuenta) => esCuentaVisiblePara(cuenta, usuarioId))
  }

  app.get('/api/espacios/:id/exportar', async (peticion, respuesta) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'lector')
    const espacioId = contexto.espacioId

    const cuentas = await cuentasVisibles(espacioId, usuario.id)
    const ids = cuentas.map((cuenta) => cuenta.id)

    const [espacio, categorias, movimientos, deudas, tarjetas, inversiones, presupuestos] =
      await Promise.all([
        prisma.espacio.findUnique({ where: { id: espacioId } }),
        prisma.categoria.findMany({ where: { espacioId, borradaEn: null }, orderBy: { orden: 'asc' } }),
        prisma.movimiento.findMany({
          where: { espacioId, borradoEn: null, cuentaId: { in: ids } },
          orderBy: { fecha: 'asc' },
        }),
        prisma.deuda.findMany({ where: { espacioId, borradaEn: null } }),
        prisma.tarjeta.findMany({ where: { espacioId, borradaEn: null } }),
        prisma.cuentaInversion.findMany({
          where: { espacioId, borradaEn: null },
          include: { posiciones: { include: { movimientos: true } } },
        }),
        prisma.presupuesto.findMany({ where: { espacioId }, include: { lineas: true } }),
      ])

    const nombre = (espacio?.nombre ?? 'norte').replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()
    respuesta.header(
      'Content-Disposition',
      `attachment; filename="norte-${nombre}-${comoIso(new Date())}.json"`,
    )
    respuesta.type('application/json; charset=utf-8')

    // `JSON.stringify` no sabe serializar BigInt: los céntimos se pasan a
    // número entero, que aguanta de sobra cualquier importe real.
    return JSON.stringify(
      {
        formato: 'norte/exportacion',
        version: 1,
        exportadoEn: new Date().toISOString(),
        aviso:
          'Los importes van en céntimos enteros. Este fichero es tuyo: Norte no se queda ' +
          'con ninguna copia ni necesita permiso de nadie para dártelo.',
        espacio: espacio && {
          nombre: espacio.nombre,
          tipo: espacio.tipo,
          divisaBase: espacio.divisaBase,
          creadoEn: espacio.creadoEn.toISOString(),
        },
        cuentas: cuentas.map((cuenta) => ({
          id: cuenta.id,
          nombre: cuenta.nombre,
          tipo: cuenta.tipo,
          divisa: cuenta.divisa,
          saldoInicial: Number(cuenta.saldoInicial),
          entidad: cuenta.entidad,
          ultimos4: cuenta.ultimos4,
          visibleEnEspacio: cuenta.visibleEnEspacio,
        })),
        categorias: categorias.map((categoria) => ({
          id: categoria.id,
          nombre: categoria.nombre,
          padreId: categoria.padreId,
          flujo: categoria.flujo,
          tipo: categoria.tipo,
        })),
        movimientos: movimientos.map((movimiento) => ({
          id: movimiento.id,
          cuentaId: movimiento.cuentaId,
          categoriaId: movimiento.categoriaId,
          fecha: comoIso(movimiento.fecha),
          importe: Number(movimiento.importe),
          concepto: movimiento.concepto,
          comercio: movimiento.comercio,
          notas: movimiento.notas,
          etiquetas: movimiento.etiquetas,
          estado: movimiento.estado,
          esCompartido: movimiento.esCompartido,
        })),
        // Campo a campo y no con `...deuda`: un volcado con puntos suspensivos
        // exporta mañana lo que se añada a la tabla sin que nadie lo decida.
        deudas: deudas.map((deuda) => ({
          nombre: deuda.nombre,
          tipo: deuda.tipo,
          entidad: deuda.entidad,
          principalOriginal: Number(deuda.principalOriginal),
          saldoPendiente: Number(deuda.saldoPendiente),
          tin: Number(deuda.tin),
          plazoMeses: deuda.plazoMeses,
          cuota: Number(deuda.cuota),
          sistema: deuda.sistema,
          comisionAmortizacion: Number(deuda.comisionAmortizacion),
          fechaPrimerPago: comoIso(deuda.fechaPrimerPago),
          liquidadaEn: deuda.liquidadaEn ? comoIso(deuda.liquidadaEn) : null,
        })),
        tarjetas: tarjetas.map((tarjeta) => ({
          nombre: tarjeta.nombre,
          ultimos4: tarjeta.ultimos4,
          limite: Number(tarjeta.limite),
          diaCorte: tarjeta.diaCorte,
          diaPago: tarjeta.diaPago,
          modalidad: tarjeta.modalidad,
          tin: tarjeta.tin === null ? null : Number(tarjeta.tin),
          minimoPorcentaje: Number(tarjeta.minimoPorcentaje),
          minimoSuelo: Number(tarjeta.minimoSuelo),
        })),
        inversiones: inversiones.map((cuenta) => ({
          nombre: cuenta.nombre,
          broker: cuenta.broker,
          posiciones: cuenta.posiciones.map((posicion) => ({
            nombre: posicion.nombre,
            isin: posicion.isin,
            clase: posicion.clase,
            ultimoPrecio: Number(posicion.ultimoPrecio),
            fechaValoracion: posicion.fechaValoracion ? comoIso(posicion.fechaValoracion) : null,
            movimientos: posicion.movimientos.map((movimiento) => ({
              tipo: movimiento.tipo,
              fecha: comoIso(movimiento.fecha),
              participaciones: Number(movimiento.participaciones),
              importe: Number(movimiento.importe),
              comision: Number(movimiento.comision),
            })),
          })),
        })),
        presupuestos: presupuestos.map((presupuesto) => ({
          mes: comoIso(presupuesto.mes),
          metodo: presupuesto.metodo,
          lineas: presupuesto.lineas.map((linea) => ({
            categoriaId: linea.categoriaId,
            asignado: Number(linea.asignado),
            rollover: linea.rollover,
          })),
        })),
      },
      null,
      2,
    )
  })

  app.get('/api/espacios/:id/exportar.csv', async (peticion, respuesta) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'lector')
    const espacioId = contexto.espacioId

    const cuentas = await cuentasVisibles(espacioId, usuario.id)
    const porId = new Map(cuentas.map((cuenta) => [cuenta.id, cuenta.nombre]))

    const [movimientos, categorias, espacio] = await Promise.all([
      prisma.movimiento.findMany({
        where: { espacioId, borradoEn: null, cuentaId: { in: [...porId.keys()] } },
        orderBy: { fecha: 'asc' },
      }),
      prisma.categoria.findMany({ where: { espacioId } }),
      prisma.espacio.findUnique({ where: { id: espacioId } }),
    ])
    const nombreCategoria = new Map(categorias.map((categoria) => [categoria.id, categoria.nombre]))

    const cabecera = [
      'Fecha', 'Cuenta', 'Concepto', 'Comercio', 'Categoria',
      'Importe', 'Estado', 'Compartido', 'Etiquetas', 'Notas',
    ]
    // Lo que sale de la base tal cual (fechas, estados, el importe que
    // generamos nosotros) va con `campo`; lo que escribió una persona —o vino
    // de un extracto— va con `textoDePersona`. El importe empieza por `-` a
    // menudo y es legítimo: por eso la neutralización no puede ser general.
    const filas = movimientos.map((movimiento) =>
      [
        campo(comoIso(movimiento.fecha)),
        textoDePersona(porId.get(movimiento.cuentaId) ?? ''),
        textoDePersona(movimiento.concepto),
        textoDePersona(movimiento.comercio),
        textoDePersona(
          movimiento.categoriaId ? (nombreCategoria.get(movimiento.categoriaId) ?? '') : '',
        ),
        campo(euros(movimiento.importe)),
        campo(movimiento.estado),
        campo(movimiento.esCompartido ? 'si' : 'no'),
        textoDePersona(movimiento.etiquetas.join(', ')),
        textoDePersona(movimiento.notas),
      ].join(';'),
    )

    const nombre = (espacio?.nombre ?? 'norte').replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()
    respuesta.header(
      'Content-Disposition',
      `attachment; filename="norte-${nombre}-${comoIso(new Date())}.csv"`,
    )
    respuesta.type('text/csv; charset=utf-8')
    // BOM: sin él, Excel abre el fichero en la codificación del sistema y se
    // come todas las tildes y las eñes.
    return `﻿${[cabecera.join(';'), ...filas].join('\r\n')}\r\n`
  })
}
