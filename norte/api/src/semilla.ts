import { crearPrisma } from './bd.js'
import { cifrarContrasena } from './auth/contrasena.js'
import { leerConfiguracion } from './configuracion.js'
import { crearEspacio } from './espacios/crear.js'
import { crearServidor } from './servidor.js'
import { COOKIE_SESION } from './auth/sesiones.js'

/**
 * Datos de demostración.
 *
 * Crea el usuario y los espacios con sus categorías, y **llena el espacio
 * Personal** con lo que hace falta para que el cuadro de la fase 7 no salga
 * vacío: cuentas, dos préstamos, una cartera indexada, los recibos que vienen
 * y **18 meses de fotos del patrimonio**, que es el histórico que pide el
 * encargo.
 *
 * Dos decisiones que conviene no deshacer:
 *
 *  · **Los datos entran por las rutas de la API, no por Prisma.** Escribirlos a
 *    mano en las tablas duplicaría las reglas (visibilidad, categorías,
 *    huellas) y la semilla acabaría produciendo estados que la aplicación no
 *    sabe producir. Si una ruta cambia, la semilla se entera.
 *  · **El histórico se camina hacia atrás desde el patrimonio de hoy.** Sembrar
 *    cifras sueltas dejaba un escalón falso —el gráfico enseñaba un +33 % entre
 *    el último mes y el presente— que no era ni un dato ni un fallo visible.
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

  const personal = await crearEspacio(prisma, {
    usuarioId: usuario.id,
    nombre: 'Personal',
    tipo: 'personal',
  })
  await crearEspacio(prisma, { usuarioId: usuario.id, nombre: 'Casa', tipo: 'pareja' })

  // Se entra por la puerta, no se falsifica una sesión: el registro está
  // cerrado y esta cuenta puede no ser la primera de la instalación.
  const app = await crearServidor({ prisma, configuracion, registro: false })
  const entrada = await app.inject({
    method: 'POST',
    url: '/api/auth/entrar',
    payload: { email, contrasena },
  })
  const testigo = entrada.cookies.find((galleta) => galleta.name === COOKIE_SESION)
  if (!testigo) throw new Error('La semilla no ha podido entrar con el usuario recién creado.')
  const cookie = `${COOKIE_SESION}=${testigo.value}`

  const llamar = async (
    metodo: 'POST' | 'PATCH' | 'GET',
    ruta: string,
    cuerpo?: Record<string, unknown>,
  ) => {
    const respuesta = await app.inject({
      method: metodo,
      url: `/api/espacios/${personal.id}${ruta}`,
      headers: { cookie },
      payload: cuerpo,
    })
    if (respuesta.statusCode >= 400) {
      // Una semilla que falla a medias deja una demostración incoherente, que
      // es peor que no tener demostración.
      throw new Error(`${metodo} ${ruta} respondió ${respuesta.statusCode}: ${respuesta.body}`)
    }
    return respuesta
  }
  const post = (ruta: string, cuerpo: Record<string, unknown>) => llamar('POST', ruta, cuerpo)
  const patch = (ruta: string, cuerpo: Record<string, unknown>) => llamar('PATCH', ruta, cuerpo)
  const dentroDe = (dias: number) => {
    const fecha = new Date()
    fecha.setDate(fecha.getDate() + dias)
    return fecha.toISOString().slice(0, 10)
  }

  const corriente = (
    await post('/cuentas', { nombre: 'Cuenta corriente', tipo: 'corriente', saldoInicial: 214_000 })
  ).json() as { cuenta: { id: string } }
  await post('/cuentas', { nombre: 'Ahorro', tipo: 'ahorro', saldoInicial: 1_450_000 })
  await post('/cuentas', { nombre: 'Piso', tipo: 'activo_no_liquido', saldoInicial: 21_000_000 })
  const cuentaId = corriente.cuenta.id

  await post('/deudas', {
    nombre: 'Hipoteca',
    tipo: 'hipoteca',
    entidad: 'Banco',
    principalOriginal: 15_000_000,
    tin: 3,
    plazoMeses: 360,
    fechaPrimerPago: '2021-03-01',
    comisionAmortizacion: 0.5,
  })
  await post('/deudas', {
    nombre: 'Coche',
    tipo: 'auto',
    principalOriginal: 1_800_000,
    tin: 7.5,
    plazoMeses: 72,
    fechaPrimerPago: '2024-06-10',
  })

  const inversion = (await post('/inversiones', { nombre: 'Cartera indexada', broker: 'MyInvestor' }))
    .json() as { cuenta: { id: string } }
  const posicion = (
    await post(`/inversiones/${inversion.cuenta.id}/posiciones`, {
      nombre: 'Global Stock',
      clase: 'renta_variable',
    })
  ).json() as { posicion: { id: string } }
  // Aportación mensual: una cartera con una sola compra no tiene TIR que mirar.
  for (let mes = 0; mes < 18; mes++) {
    await post(`/inversiones/posiciones/${posicion.posicion.id}/movimientos`, {
      tipo: 'compra',
      fecha: new Date(2025, 1 + mes, 5).toISOString().slice(0, 10),
      participaciones: 1.2,
      importe: 30_000,
    })
  }
  await patch(`/inversiones/posiciones/${posicion.posicion.id}/precio`, { ultimoPrecio: 29_500 })

  // Lo que ya está comprometido, que es de lo único que se hace proyección.
  await post('/movimientos', { cuentaId, importe: -75_000, fecha: dentroDe(6), concepto: 'Alquiler garaje', estado: 'previsto' })
  await post('/movimientos', { cuentaId, importe: -12_400, fecha: dentroDe(9), concepto: 'Luz', estado: 'previsto' })
  await post('/movimientos', { cuentaId, importe: -3_990, fecha: dentroDe(14), concepto: 'Suscripciones', estado: 'previsto' })
  await post('/movimientos', { cuentaId, importe: 244_360, fecha: dentroDe(19), concepto: 'Nómina', estado: 'previsto' })

  const hoy = new Date()
  const cuadro = (await llamar('GET', '/cuadro')).json() as {
    patrimonio: { neto: number; pasivos: number }
  }

  // Variación mensual fija, no aleatoria: la semilla tiene que ser reproducible.
  const pasos = [1.4, 0.9, 1.1, -0.6, 1.3, 0.8, 1.0, 1.2, -0.9, 1.5, 0.7, 1.1, 0.9, 1.3, -0.4, 1.0, 1.2]
  let neto = cuadro.patrimonio.neto
  for (let atras = 1; atras <= pasos.length; atras++) {
    neto = Math.round(neto / (1 + pasos[atras - 1]! / 100))
    // Los pasivos bajan hacia el presente: hace `atras` meses quedaba más hipoteca.
    const pasivos = cuadro.patrimonio.pasivos + atras * 32_000
    await prisma.fotoPatrimonio.create({
      data: {
        espacioId: personal.id,
        mes: new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth() - atras, 1)),
        activos: BigInt(neto + pasivos),
        pasivos: BigInt(pasivos),
        patrimonioNeto: BigInt(neto),
      },
    })
  }
  await post('/cuadro/foto', {})

  console.log(`Sembrado. Entra con ${email} / ${contrasena}`)
  await app.close()
  await prisma.$disconnect()
}

sembrar().catch((error) => {
  console.error('No se ha podido sembrar:', error)
  process.exit(1)
})
