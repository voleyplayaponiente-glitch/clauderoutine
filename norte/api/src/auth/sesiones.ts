import { createHmac, randomBytes } from 'node:crypto'
import type { PrismaClient, Usuario } from '@prisma/client'

/**
 * Sesiones por cookie.
 *
 * Dos decisiones que no son casuales:
 *
 * · **La cookie es `httpOnly`.** Un token en `localStorage` es legible por
 *   cualquier script que se cuele en la página; uno en cookie httpOnly, no.
 * · **En la base de datos no se guarda el testigo, sino su HMAC** con el
 *   secreto del servidor. Quien se lleve una copia de la base de datos no puede
 *   suplantar a nadie con lo que hay dentro, igual que con las contraseñas.
 */

export const COOKIE_SESION = 'norte_sesion'

/** Un mes. Es una app que se abre a diario; pedir la contraseña cada semana solo
 *  consigue que la gente elija una peor. */
const DURACION_DIAS = 30

export function generarToken(): string {
  return randomBytes(32).toString('base64url')
}

export function huellaDeToken(token: string, secreto: string): string {
  return createHmac('sha256', secreto).update(token).digest('hex')
}

export interface DatosSesion {
  agente?: string | null
  ip?: string | null
}

export async function crearSesion(
  prisma: PrismaClient,
  secreto: string,
  usuarioId: string,
  datos: DatosSesion = {},
): Promise<{ token: string; expiraEn: Date }> {
  const token = generarToken()
  const expiraEn = new Date(Date.now() + DURACION_DIAS * 24 * 60 * 60 * 1000)
  await prisma.sesion.create({
    data: {
      usuarioId,
      hashToken: huellaDeToken(token, secreto),
      expiraEn,
      agente: datos.agente?.slice(0, 300) ?? null,
      ip: datos.ip ?? null,
    },
  })
  return { token, expiraEn }
}

/** Devuelve el usuario de la sesión, o `null` si el testigo no vale o caducó. */
export async function usuarioDeSesion(
  prisma: PrismaClient,
  secreto: string,
  token: string | undefined,
): Promise<Usuario | null> {
  if (!token) return null
  const sesion = await prisma.sesion.findUnique({
    where: { hashToken: huellaDeToken(token, secreto) },
    include: { usuario: true },
  })
  if (!sesion) return null
  if (sesion.expiraEn.getTime() < Date.now()) {
    await prisma.sesion.delete({ where: { id: sesion.id } }).catch(() => {})
    return null
  }
  if (sesion.usuario.borradoEn) return null

  // `ultimoUso` se refresca como mucho una vez por hora: escribir en cada
  // petición convierte un GET en una escritura y no aporta nada.
  if (Date.now() - sesion.ultimoUso.getTime() > 60 * 60 * 1000) {
    await prisma.sesion
      .update({ where: { id: sesion.id }, data: { ultimoUso: new Date() } })
      .catch(() => {})
  }
  return sesion.usuario
}

export async function cerrarSesion(
  prisma: PrismaClient,
  secreto: string,
  token: string | undefined,
): Promise<void> {
  if (!token) return
  await prisma.sesion.deleteMany({ where: { hashToken: huellaDeToken(token, secreto) } })
}

/** Cierra todas las sesiones de un usuario. Se usa al cambiar la contraseña. */
export async function cerrarTodasLasSesiones(prisma: PrismaClient, usuarioId: string): Promise<void> {
  await prisma.sesion.deleteMany({ where: { usuarioId } })
}

export async function limpiarSesionesCaducadas(prisma: PrismaClient): Promise<number> {
  const { count } = await prisma.sesion.deleteMany({ where: { expiraEn: { lt: new Date() } } })
  return count
}
