import { DIAS_INVITACION, type Rol } from '@norte/dominio'
import type { PrismaClient } from '@prisma/client'
import { randomBytes } from 'node:crypto'
import { huellaDeToken } from './auth/sesiones.js'

/**
 * Invitaciones por enlace.
 *
 * Mismo criterio que con las sesiones: **en la base de datos no se guarda el
 * testigo, sino su HMAC** con el secreto del servidor. El enlace se enseña una
 * sola vez, al crearlo; si se pierde, se anula y se hace otro. Quien se lleve
 * una copia de la base de datos no puede fabricar invitaciones con lo que hay
 * dentro.
 */

export function generarTokenInvitacion(): string {
  return randomBytes(24).toString('base64url')
}

export async function crearInvitacion(
  prisma: PrismaClient,
  secreto: string,
  datos: { espacioId: string; invitadaPorId: string; email?: string | null; rol: Rol },
) {
  const token = generarTokenInvitacion()
  const expiraEn = new Date(Date.now() + DIAS_INVITACION * 24 * 60 * 60 * 1000)

  const invitacion = await prisma.invitacion.create({
    data: {
      espacioId: datos.espacioId,
      invitadaPorId: datos.invitadaPorId,
      email: datos.email?.trim().toLowerCase() || null,
      rol: datos.rol,
      hashToken: huellaDeToken(token, secreto),
      expiraEn,
    },
  })
  return { token, invitacion }
}

export async function buscarInvitacion(prisma: PrismaClient, secreto: string, token: string) {
  if (!token) return null
  return prisma.invitacion.findUnique({
    where: { hashToken: huellaDeToken(token, secreto) },
    include: { espacio: true, invitadaPor: { select: { nombre: true } } },
  })
}

/**
 * Marca la invitación como usada **y devuelve si lo consiguió**.
 *
 * Va con `updateMany` filtrando por `aceptadaEn: null` a propósito: es un
 * pulso atómico en la base de datos. Si dos personas abren el mismo enlace a la
 * vez, solo una de las dos actualiza una fila y la otra se queda fuera. Con un
 * `findUnique` + `update` habría un hueco entre comprobar y escribir por el que
 * pasarían las dos.
 */
export async function marcarInvitacionUsada(
  tx: { invitacion: { updateMany: PrismaClient['invitacion']['updateMany'] } },
  invitacionId: string,
): Promise<boolean> {
  const { count } = await tx.invitacion.updateMany({
    where: { id: invitacionId, aceptadaEn: null, revocadaEn: null },
    data: { aceptadaEn: new Date() },
  })
  return count === 1
}
