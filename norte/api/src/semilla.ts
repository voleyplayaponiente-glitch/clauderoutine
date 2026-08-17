import { crearPrisma } from './bd.js'
import { cifrarContrasena } from './auth/contrasena.js'
import { leerConfiguracion } from './configuracion.js'
import { crearEspacio } from './espacios/crear.js'

/**
 * Datos de demostración.
 *
 * Hoy crea las cuentas y los espacios con sus categorías, que es lo que existe
 * en la fase 1. Los 18 meses de histórico realista que pide el encargo —nómina,
 * hipoteca, tarjetas, cartera indexada— se van añadiendo aquí conforme cada
 * fase trae su módulo: inventarlos antes de que haya movimientos sería llenar
 * tablas que nadie lee.
 */
async function sembrar() {
  const configuracion = leerConfiguracion()
  const prisma = crearPrisma(configuracion.urlBaseDatos)

  const email = 'demo@norte.local'
  const contrasena = 'demo para probar norte'

  const existente = await prisma.usuario.findUnique({ where: { email } })
  if (existente) {
    console.log(`Ya existe ${email}. Nada que sembrar.`)
    await prisma.$disconnect()
    return
  }

  const usuario = await prisma.usuario.create({
    data: { email, nombre: 'Demo', hashContrasena: await cifrarContrasena(contrasena) },
  })

  await crearEspacio(prisma, { usuarioId: usuario.id, nombre: 'Personal', tipo: 'personal' })
  await crearEspacio(prisma, { usuarioId: usuario.id, nombre: 'Casa', tipo: 'pareja' })

  console.log(`Sembrado. Entra con ${email} / ${contrasena}`)
  await prisma.$disconnect()
}

sembrar().catch((error) => {
  console.error('No se ha podido sembrar:', error)
  process.exit(1)
})
