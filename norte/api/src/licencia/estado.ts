import { decidirLicencia, type EstadoLicencia } from '@norte/dominio'
import type { PrismaClient } from '@prisma/client'
import { leerClave } from './clave.js'

/**
 * El estado de licencia de esta instalación.
 *
 * Se cachea unos segundos porque lo pregunta **cada escritura**: sin caché,
 * apuntar un gasto costaría dos consultas más de las que necesita. El caché se
 * tira a la basura en cuanto alguien cambia la licencia, así que pegar una
 * clave nueva se nota en el acto y no «en menos de un minuto».
 */

const VIGENCIA_CACHE = 30_000

let cache: { estado: EstadoLicencia; hasta: number } | null = null

export function olvidarLicencia(): void {
  cache = null
}

export async function estadoDeLicencia(prisma: PrismaClient): Promise<EstadoLicencia> {
  const ahora = new Date()
  if (cache && cache.hasta > ahora.getTime()) return cache.estado

  const [guardada, usuarios] = await Promise.all([
    prisma.licencia.findFirst(),
    prisma.usuario.findMany({
      where: { borradoEn: null },
      orderBy: { creadoEn: 'asc' },
      select: { id: true, creadoEn: true },
    }),
  ])

  // La variable de entorno permite provisionar una instalación sin entrar a la
  // interfaz; la clave guardada manda sobre ella porque es la que se pegó aquí.
  const clave = guardada?.clave ?? process.env.NORTE_LICENCIA
  const estado = decidirLicencia(clave ? leerClave(clave) : null, {
    usuarios: usuarios.map((usuario) => ({
      id: usuario.id,
      creadoEn: usuario.creadoEn.toISOString().slice(0, 10),
    })),
    ahora,
  })

  cache = { estado, hasta: ahora.getTime() + VIGENCIA_CACHE }
  return estado
}
