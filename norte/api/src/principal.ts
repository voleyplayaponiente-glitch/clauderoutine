import { crearPrisma } from './bd.js'
import { ErrorConfiguracion, leerConfiguracion } from './configuracion.js'
import { limpiarSesionesCaducadas } from './auth/sesiones.js'
import { crearServidor } from './servidor.js'

/** Arranque del servidor. Todo lo que puede fallar, falla aquí y en voz alta. */
async function arrancar() {
  let configuracion
  try {
    configuracion = leerConfiguracion()
  } catch (error) {
    if (error instanceof ErrorConfiguracion) {
      console.error(error.message)
      process.exit(1)
    }
    throw error
  }

  const prisma = crearPrisma(configuracion.urlBaseDatos)
  const app = await crearServidor({ prisma, configuracion })

  // Las sesiones caducadas se barren al arrancar y una vez al día. No hace
  // falta un planificador para esto.
  const barrido = setInterval(
    () => {
      limpiarSesionesCaducadas(prisma).catch((error) => app.log.error({ err: error }, 'barrido de sesiones'))
    },
    24 * 60 * 60 * 1000,
  )
  barrido.unref()
  await limpiarSesionesCaducadas(prisma).catch(() => {})

  const cerrar = async (senal: string) => {
    app.log.info(`Recibido ${senal}, cerrando`)
    clearInterval(barrido)
    await app.close()
    await prisma.$disconnect()
    process.exit(0)
  }
  process.on('SIGTERM', () => void cerrar('SIGTERM'))
  process.on('SIGINT', () => void cerrar('SIGINT'))

  // 0.0.0.0 y no localhost: dentro de un contenedor, escuchar solo en el bucle
  // local equivale a no escuchar.
  await app.listen({ port: configuracion.puerto, host: '0.0.0.0' })
}

arrancar().catch((error) => {
  console.error('Norte no ha podido arrancar:', error)
  process.exit(1)
})
