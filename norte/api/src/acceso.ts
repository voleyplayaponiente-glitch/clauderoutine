import { decidirAcceso, type Rol } from '@norte/dominio'
import type { PrismaClient } from '@prisma/client'
import { ErrorApi } from './errores.js'

/**
 * El guardián. **Todo** lo que toca datos de un espacio pasa por aquí.
 *
 * La decisión de si se puede o no vive en `@norte/dominio` (pura y con tests);
 * este fichero solo va a buscar la membresía a la base de datos y traduce el
 * «no» a un error HTTP. Separarlo así es lo que permite probar la regla de
 * privacidad sin levantar un servidor, y que no acabe repetida —y divergiendo—
 * en veinte rutas.
 */

export interface Contexto {
  espacioId: string
  rol: Rol
}

async function buscarMembresia(prisma: PrismaClient, usuarioId: string, espacioId: string) {
  const miembro = await prisma.miembroEspacio.findFirst({
    where: {
      usuarioId,
      espacioId,
      bajaEn: null,
      // Un espacio en la papelera es, a todos los efectos, un espacio que no
      // existe: si no se filtrara aquí seguiría siendo accesible por su id.
      espacio: { borradoEn: null },
    },
  })
  return miembro ? { usuarioId, espacioId, rol: miembro.rol as Rol } : null
}

/**
 * Exige acceso al espacio con al menos el rol indicado. Lanza `ErrorApi` si no.
 *
 * A quien no es miembro se le responde 404, no 403: un 403 confirmaría que el
 * espacio existe.
 */
export async function exigirEspacio(
  prisma: PrismaClient,
  usuarioId: string,
  espacioId: string,
  rolMinimo: Rol = 'lector',
): Promise<Contexto> {
  const membresia = await buscarMembresia(prisma, usuarioId, espacioId)
  const decision = decidirAcceso(membresia, { espacioId, rolMinimo })

  if (!decision.permitido) {
    throw new ErrorApi(decision.motivo, decision.mensaje)
  }
  return { espacioId, rol: decision.rol }
}

/** Los espacios de los que el usuario es miembro, para el selector de arriba. */
export async function espaciosDe(prisma: PrismaClient, usuarioId: string) {
  const membresias = await prisma.miembroEspacio.findMany({
    where: { usuarioId, bajaEn: null, espacio: { borradoEn: null } },
    include: { espacio: true },
    orderBy: { altaEn: 'asc' },
  })
  return membresias.map((m) => ({
    id: m.espacio.id,
    nombre: m.espacio.nombre,
    tipo: m.espacio.tipo,
    divisaBase: m.espacio.divisaBase,
    rol: m.rol as Rol,
  }))
}
