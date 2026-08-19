import { apunteDeNomina, esCuentaVisiblePara, validarMovimiento } from '@norte/dominio'
import type { PrismaClient } from '@prisma/client'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { exigirEspacio } from '../acceso.js'
import type { Configuracion } from '../configuracion.js'
import {
  crearAlmacen,
  esExtensionAdmitida,
  extensionesAdmitidas,
  huellaContenido,
  TAMANO_MAXIMO,
} from '../documentos/almacen.js'
import { leerDocumento } from '../documentos/leer.js'
import { conflicto, datosInvalidos, noEncontrado } from '../errores.js'
import { usuarioDe } from '../servidor.js'

/**
 * La bandeja de entrada.
 *
 * Dos ideas mandan sobre todo lo demás:
 *
 *  1. **Un solo buzón.** Se suelta el fichero y la app averigua qué es. Elegir
 *     antes «esto es un extracto del BBVA en formato tal» es pedirle al usuario
 *     que haga el trabajo del programa.
 *  2. **Nada entra sin que lo veas.** Subir un documento no toca ni un saldo:
 *     deja el documento en revisión. Los movimientos se crean en un segundo
 *     paso, con la cuenta elegida y con lo que se haya desmarcado fuera.
 */

const esquemaAplicar = z.object({
  cuentaId: z.string().min(1),
  categoriaId: z.string().nullish(),
  apuntes: z
    .array(
      z.object({
        huella: z.string().min(1).max(120),
        fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha va como aaaa-mm-dd.'),
        concepto: z.string().trim().min(1).max(200),
        importe: z.number().int('El importe va en céntimos enteros.'),
        categoriaId: z.string().nullish(),
      }),
    )
    .min(1, 'No has marcado ningún movimiento para importar.')
    .max(5000),
})

/** Un movimiento anterior con el mismo importe y a menos de estos días se marca
 *  como posible repetido: pasa cuando algo se apuntó a mano y luego llega en el
 *  extracto. No se descarta solo, se avisa. */
const DIAS_PARECIDO = 3

export async function rutasDocumentos(
  app: FastifyInstance,
  opciones: { prisma: PrismaClient; configuracion: Configuracion },
) {
  const { prisma, configuracion } = opciones
  const almacen = crearAlmacen(configuracion.datosDir)

  async function documentoDe(espacioId: string, documentoId: string) {
    const documento = await prisma.documento.findFirst({
      where: { id: documentoId, espacioId, borradoEn: null },
    })
    if (!documento) throw noEncontrado('Ese documento no existe o ya lo has borrado.')
    return documento
  }

  /**
   * Lee el fichero de disco y le marca a cada apunte si ya está en la base.
   *
   * Se hace en cada consulta en vez de guardar el resultado: la lectura es
   * determinista, y así una mejora del lector se nota en los documentos que ya
   * estaban subidos sin tener que volver a subirlos.
   */
  async function lecturaDe(espacioId: string, documento: { id: string; rutaAlmacen: string; nombreOriginal: string }) {
    const datos = await almacen.leer(documento.rutaAlmacen)
    const lectura = await leerDocumento(documento.nombreOriginal, datos)

    const apuntes = lectura.extracto?.apuntes ?? []
    const deNomina = lectura.nomina ? apunteDeNomina(lectura.nomina) : null
    const propuestos = deNomina
      ? [{ ...deNomina, divisa: 'EUR', origen: 0 }]
      : apuntes

    if (propuestos.length === 0) {
      return { lectura, apuntes: [] as never[] }
    }

    const fechas = propuestos.map((a) => a.fecha).sort()
    const desde = new Date(fechas[0]!)
    const hasta = new Date(fechas[fechas.length - 1]!)
    desde.setDate(desde.getDate() - DIAS_PARECIDO)
    hasta.setDate(hasta.getDate() + DIAS_PARECIDO)

    const existentes = await prisma.movimiento.findMany({
      where: { espacioId, borradoEn: null, fecha: { gte: desde, lte: hasta } },
      select: { id: true, idExterno: true, importe: true, fecha: true, concepto: true },
    })
    const porHuella = new Map(existentes.filter((m) => m.idExterno).map((m) => [m.idExterno!, m]))

    const marcados = propuestos.map((apunte) => {
      const yaImportado = porHuella.has(apunte.huella)
      const parecido = yaImportado
        ? null
        : existentes.find(
            (m) =>
              !m.idExterno &&
              Number(m.importe) === apunte.importe &&
              Math.abs(m.fecha.getTime() - new Date(apunte.fecha).getTime()) <=
                DIAS_PARECIDO * 86_400_000,
          )
      return {
        ...apunte,
        yaImportado,
        ...(parecido ? { parecidoA: { concepto: parecido.concepto, fecha: fechaISO(parecido.fecha) } } : {}),
      }
    })

    return { lectura, apuntes: marcados }
  }

  // ── Subir ─────────────────────────────────────────────────────────────────
  app.post('/api/espacios/:id/documentos', async (peticion, respuesta) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')

    const fichero = await peticion.file({ limits: { fileSize: TAMANO_MAXIMO } })
    if (!fichero) throw datosInvalidos('No has adjuntado ningún fichero.')

    const nombreOriginal = fichero.filename.slice(0, 255)
    if (!esExtensionAdmitida(nombreOriginal)) {
      throw datosInvalidos(
        `No sé leer ese tipo de fichero. Admito: ${extensionesAdmitidas().join(', ')}.`,
      )
    }

    const datos = await fichero.toBuffer().catch(() => {
      throw datosInvalidos(
        `El fichero pasa de ${Math.round(TAMANO_MAXIMO / 1024 / 1024)} MB. Un extracto nunca ocupa tanto: comprueba que es el fichero correcto.`,
      )
    })
    if (datos.length === 0) throw datosInvalidos('El fichero está vacío.')

    const hash = huellaContenido(datos)
    const yaEstaba = await prisma.documento.findFirst({
      where: { espacioId: contexto.espacioId, hash },
    })
    if (yaEstaba && !yaEstaba.borradoEn) {
      // El mismo fichero byte a byte: se dice y se devuelve el que ya había, en
      // vez de crear un segundo documento que produciría los mismos apuntes.
      throw conflicto(`Este fichero ya lo subiste el ${yaEstaba.creadoEn.toLocaleDateString('es-ES')} («${yaEstaba.nombreOriginal}»).`)
    }

    const rutaAlmacen = await almacen.guardar(contexto.espacioId, datos, nombreOriginal)
    const lectura = await leerDocumento(nombreOriginal, datos)

    const documento = await prisma.documento.upsert({
      where: { espacioId_hash: { espacioId: contexto.espacioId, hash } },
      create: {
        espacioId: contexto.espacioId,
        subidoPorId: usuario.id,
        nombreOriginal,
        rutaAlmacen,
        mimeType: fichero.mimetype ?? 'application/octet-stream',
        tamanoBytes: datos.length,
        hash,
        tipo: lectura.deteccion.tipo,
        estado: lectura.error ? 'fallido' : 'revision',
        motivoTipo: lectura.deteccion.motivo,
        error: lectura.error ?? null,
        procesadoEn: new Date(),
      },
      update: {
        // Vuelve a subir uno que estaba en la papelera: se recupera.
        borradoEn: null,
        rutaAlmacen,
        subidoPorId: usuario.id,
        tipo: lectura.deteccion.tipo,
        estado: lectura.error ? 'fallido' : 'revision',
        motivoTipo: lectura.deteccion.motivo,
        error: lectura.error ?? null,
        procesadoEn: new Date(),
      },
    })

    return respuesta.code(201).send({ documento: formatear(documento) })
  })

  // ── Listar ────────────────────────────────────────────────────────────────
  app.get('/api/espacios/:id/documentos', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id } = peticion.params as { id: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'lector')

    const documentos = await prisma.documento.findMany({
      where: { espacioId: contexto.espacioId, borradoEn: null },
      orderBy: { creadoEn: 'desc' },
      take: 100,
      include: { _count: { select: { movimientos: true } } },
    })
    return {
      documentos: documentos.map((d) => ({ ...formatear(d), movimientos: d._count.movimientos })),
    }
  })

  // ── Leer para revisar ─────────────────────────────────────────────────────
  app.get('/api/espacios/:id/documentos/:documentoId/lectura', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id, documentoId } = peticion.params as { id: string; documentoId: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'lector')
    const documento = await documentoDe(contexto.espacioId, documentoId)

    const { lectura, apuntes } = await lecturaDe(contexto.espacioId, documento)
    return {
      documento: formatear(documento),
      deteccion: lectura.deteccion,
      ...(lectura.error ? { error: lectura.error } : {}),
      ...(lectura.hoja ? { hoja: lectura.hoja } : {}),
      ...(lectura.extracto
        ? {
            cuenta: lectura.extracto.cuenta,
            desde: lectura.extracto.desde,
            hasta: lectura.extracto.hasta,
            avisos: lectura.extracto.avisos,
          }
        : {}),
      ...(lectura.nomina ? { nomina: lectura.nomina, avisos: lectura.nomina.avisos } : {}),
      apuntes,
    }
  })

  // ── Aplicar ───────────────────────────────────────────────────────────────
  app.post('/api/espacios/:id/documentos/:documentoId/aplicar', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id, documentoId } = peticion.params as { id: string; documentoId: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')
    const documento = await documentoDe(contexto.espacioId, documentoId)
    const datos = esquemaAplicar.parse(peticion.body)

    const cuenta = await prisma.cuenta.findFirst({
      where: { id: datos.cuentaId, espacioId: contexto.espacioId, borradaEn: null },
      select: { id: true, propietarioId: true, visibleEnEspacio: true, divisa: true },
    })
    if (!cuenta || !esCuentaVisiblePara(cuenta, usuario.id)) {
      throw noEncontrado('Esa cuenta no existe en este espacio.')
    }

    const ahora = new Date()
    for (const apunte of datos.apuntes) {
      const validacion = validarMovimiento(
        { importe: apunte.importe, fecha: apunte.fecha, concepto: apunte.concepto, cuentaId: cuenta.id },
        ahora,
      )
      if (!validacion.valido) {
        throw datosInvalidos(`«${apunte.concepto}»: ${validacion.mensaje}`, { campo: validacion.campo })
      }
    }

    // `skipDuplicates` sobre el índice único (cuenta, idExterno) es lo que hace
    // que aplicar dos veces el mismo extracto no duplique nada, ni siquiera si
    // se pulsa el botón dos veces seguidas.
    const { count } = await prisma.movimiento.createMany({
      data: datos.apuntes.map((apunte) => ({
        espacioId: contexto.espacioId,
        cuentaId: cuenta.id,
        categoriaId: apunte.categoriaId ?? datos.categoriaId ?? null,
        importe: BigInt(apunte.importe),
        divisa: cuenta.divisa,
        importeBase: BigInt(apunte.importe),
        fecha: new Date(apunte.fecha),
        concepto: apunte.concepto,
        estado: 'confirmado' as const,
        documentoId: documento.id,
        idExterno: apunte.huella,
      })),
      skipDuplicates: true,
    })

    await prisma.documento.update({
      where: { id: documento.id },
      data: { estado: 'aplicado', procesadoEn: new Date() },
    })

    return { creados: count, omitidos: datos.apuntes.length - count }
  })

  // ── Borrar ────────────────────────────────────────────────────────────────
  app.delete('/api/espacios/:id/documentos/:documentoId', async (peticion) => {
    const usuario = usuarioDe(peticion)
    const { id, documentoId } = peticion.params as { id: string; documentoId: string }
    const contexto = await exigirEspacio(prisma, usuario.id, id, 'editor')
    const documento = await documentoDe(contexto.espacioId, documentoId)

    // El fichero se borra de verdad; el registro se marca. Los movimientos que
    // salieron de él se quedan: son datos del usuario, no del documento.
    await almacen.borrar(documento.rutaAlmacen).catch(() => undefined)
    await prisma.documento.update({
      where: { id: documento.id },
      data: { borradoEn: new Date() },
    })
    return { ok: true as const }
  })
}

function fechaISO(fecha: Date): string {
  return fecha.toISOString().slice(0, 10)
}

function formatear(documento: {
  id: string
  nombreOriginal: string
  mimeType: string
  tamanoBytes: number
  tipo: string
  estado: string
  motivoTipo: string | null
  error: string | null
  creadoEn: Date
}) {
  return {
    id: documento.id,
    nombreOriginal: documento.nombreOriginal,
    mimeType: documento.mimeType,
    tamanoBytes: documento.tamanoBytes,
    tipo: documento.tipo,
    estado: documento.estado,
    motivoTipo: documento.motivoTipo,
    error: documento.error,
    creadoEn: documento.creadoEn.toISOString(),
  }
}
