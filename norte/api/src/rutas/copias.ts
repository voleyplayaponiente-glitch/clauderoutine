import {
  agruparCopias,
  type EstadoCopias,
  type EstadoExterno,
  type FicheroCopia,
} from '@norte/dominio'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Configuracion } from '../configuracion.js'
import { sinPermiso } from '../errores.js'
import { usuarioDe } from '../servidor.js'

/**
 * Copias de seguridad, vistas desde la app.
 *
 * Las copias las hace otro contenedor; esta ruta solo mira lo que ha dejado
 * escrito y permite pedir una fuera de hora. Existe por una razón concreta:
 * **una copia que falla en silencio es peor que no tener copias**, porque da la
 * tranquilidad sin dar el respaldo. Si el estado no se enseña en la pantalla
 * que se abre todos los días, nadie se entera hasta que hace falta restaurar.
 */

/** Sin latido reciente, el servicio está parado por mucho que el último estado
 *  guardado diga que todo fue bien. */
const MINUTOS_LATIDO = 15

export async function rutasCopias(
  app: FastifyInstance,
  opciones: { prisma: PrismaClient; configuracion: Configuracion },
) {
  const { prisma, configuracion } = opciones

  /**
   * Solo el dueño de la instalación.
   *
   * No hay un rol de administrador todavía, pero sí un hecho: la primera
   * cuenta de una instalación es la de quien la montó —es la única que se pudo
   * crear sin invitación—. Las copias son de la instalación entera, no de un
   * espacio, así que es la persona a la que le corresponden.
   */
  async function exigirDueno(usuarioId: string) {
    const primero = await prisma.usuario.findFirst({
      where: { borradoEn: null },
      orderBy: [{ creadoEn: 'asc' }, { id: 'asc' }],
      select: { id: true },
    })
    if (!primero || primero.id !== usuarioId) {
      throw sinPermiso(
        'Las copias de seguridad las gestiona quien instaló Norte en este servidor.',
      )
    }
  }

  async function leerEstado(): Promise<EstadoCopias | null> {
    try {
      const crudo = await readFile(join(configuracion.copiasDir, 'estado.json'), 'utf8')
      const datos = JSON.parse(crudo) as Partial<EstadoCopias>
      return {
        ultima: typeof datos.ultima === 'string' ? datos.ultima : null,
        fichero: typeof datos.fichero === 'string' ? datos.fichero : null,
        bytes: Number(datos.bytes ?? 0),
        copias: Number(datos.copias ?? 0),
        ok: datos.ok !== false,
        mensaje: typeof datos.mensaje === 'string' ? datos.mensaje : null,
        externo: leerExterno(datos.externo),
      }
    } catch {
      // Ni fichero, ni JSON válido: se trata igual, porque para el usuario
      // significan lo mismo —no hay noticias del servicio de copias.
      return null
    }
  }

  /** El bloque del disco externo puede faltar (versión anterior del servicio) o
   *  venir a medias; se normaliza aquí para que la app no tenga que dudar. */
  function leerExterno(crudo: unknown): EstadoExterno | null {
    if (!crudo || typeof crudo !== 'object') return null
    const datos = crudo as Partial<EstadoExterno>
    return {
      conectado: datos.conectado === true,
      ruta: typeof datos.ruta === 'string' ? datos.ruta : null,
      copias: Number(datos.copias ?? 0),
      ultima: typeof datos.ultima === 'string' ? datos.ultima : null,
      libresMb: typeof datos.libresMb === 'number' ? datos.libresMb : null,
      mensaje: typeof datos.mensaje === 'string' ? datos.mensaje : null,
      vistoAlgunaVez: datos.vistoAlgunaVez === true,
    }
  }

  async function hayLatido(): Promise<boolean> {
    try {
      const info = await stat(join(configuracion.copiasDir, '.latido'))
      return Date.now() - info.mtimeMs < MINUTOS_LATIDO * 60_000
    } catch {
      return false
    }
  }

  async function listarCopias(): Promise<FicheroCopia[]> {
    try {
      const nombres = await readdir(configuracion.copiasDir)
      const ficheros = await Promise.all(
        nombres
          .filter((n) => n.startsWith('norte-'))
          .map(async (fichero) => ({
            fichero,
            bytes: (await stat(join(configuracion.copiasDir, fichero))).size,
          })),
      )
      return ficheros
    } catch {
      return []
    }
  }

  app.get('/api/copias', async (peticion) => {
    const usuario = usuarioDe(peticion)
    await exigirDueno(usuario.id)

    const [estado, servicioVivo, ficheros] = await Promise.all([
      leerEstado(),
      hayLatido(),
      listarCopias(),
    ])
    // El juicio (al día, atrasada, fallida) lo hace el dominio en la app con
    // estos mismos datos: así la regla vive en un sitio y tiene sus pruebas.
    return { estado, servicioVivo, copias: agruparCopias(ficheros), carpeta: configuracion.copiasDir }
  })

  app.post('/api/copias/ahora', async (peticion) => {
    const usuario = usuarioDe(peticion)
    await exigirDueno(usuario.id)

    // No se hace la copia aquí: esta imagen no lleva `pg_dump`, y meterlo solo
    // para un botón obligaría a casar su versión con la del servidor. Se deja
    // una señal y el servicio de copias la recoge en menos de un minuto.
    await mkdir(dirname(configuracion.copiasPeticion), { recursive: true })
    await writeFile(configuracion.copiasPeticion, new Date().toISOString())
    return { pedida: true as const }
  })
}
