import { CATEGORIAS_DEFECTO, type TipoEspacio } from '@norte/dominio'
import type { Prisma, PrismaClient } from '@prisma/client'

/**
 * Crear un espacio no es insertar una fila: es dejarlo **usable**. Un espacio
 * sin categorías obliga al usuario a inventarse una taxonomía contable antes de
 * poder apuntar su primer café, y ahí es donde se abandona una app de gastos.
 *
 * Va todo en una transacción: o hay espacio con sus categorías, o no hay nada.
 */
export async function crearEspacio(
  prisma: PrismaClient,
  datos: { usuarioId: string; nombre: string; tipo: TipoEspacio; divisaBase?: string },
) {
  return prisma.$transaction(async (tx) => {
    const espacio = await tx.espacio.create({
      data: {
        nombre: datos.nombre,
        tipo: datos.tipo,
        divisaBase: datos.divisaBase ?? 'EUR',
        miembros: {
          create: {
            usuarioId: datos.usuarioId,
            rol: 'propietario',
            // Quien crea un espacio de negocio empieza con el 100 %; ya lo
            // repartirá al invitar a sus socios.
            participacion: datos.tipo === 'negocio' ? 100 : 0,
          },
        },
      },
    })

    await sembrarCategorias(tx, espacio.id)

    await tx.registroActividad.create({
      data: {
        espacioId: espacio.id,
        usuarioId: datos.usuarioId,
        accion: 'crear',
        entidad: 'espacio',
        entidadId: espacio.id,
        detalle: { nombre: espacio.nombre, tipo: espacio.tipo },
      },
    })

    return espacio
  })
}

type Transaccion = Prisma.TransactionClient

/** Las categorías por defecto, madres primero para poder colgar las hijas. */
export async function sembrarCategorias(tx: Transaccion, espacioId: string): Promise<number> {
  let creadas = 0
  let orden = 0

  for (const madre of CATEGORIAS_DEFECTO) {
    const padre = await tx.categoria.create({
      data: {
        espacioId,
        nombre: madre.nombre,
        flujo: madre.flujo,
        tipo: madre.tipo,
        esencial: madre.esencial,
        icono: madre.icono,
        orden: orden++,
      },
    })
    creadas++

    if (!madre.hijas?.length) continue
    let ordenHija = 0
    for (const hija of madre.hijas) {
      await tx.categoria.create({
        data: {
          espacioId,
          padreId: padre.id,
          nombre: hija.nombre,
          flujo: madre.flujo,
          // Una hija hereda de su madre salvo que diga lo contrario: el seguro
          // del coche es fijo aunque «Transporte» sea variable.
          tipo: hija.tipo ?? madre.tipo,
          esencial: hija.esencial ?? madre.esencial,
          icono: madre.icono,
          orden: ordenHija++,
        },
      })
      creadas++
    }
  }
  return creadas
}
