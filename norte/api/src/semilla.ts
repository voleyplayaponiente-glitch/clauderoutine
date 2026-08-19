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
  const casa = await crearEspacio(prisma, { usuarioId: usuario.id, nombre: 'Casa', tipo: 'pareja' })

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

  /**
   * Un día **de este mes**, sin pasar de hoy. El gasto del mes no puede
   * sembrarse con días relativos: ejecutando la semilla un día 3, «hace 18
   * días» cae en el mes pasado y el presupuesto y el informe salen vacíos —que
   * es justo lo que pasó la primera vez.
   */
  const esteMes = (dia: number) => {
    const hoy = new Date()
    const elegido = Math.min(dia, hoy.getDate())
    return new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), elegido))
      .toISOString()
      .slice(0, 10)
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

  // Gasto del mes, con categoría. Sin esto, el presupuesto y el informe salen
  // vacíos y no se pueden juzgar: un mes de verdad tiene gasto, no solo
  // previsiones.
  const categoriasPersonal = await prisma.categoria.findMany({
    where: { espacioId: personal.id, borradaEn: null },
  })
  const categoria = (nombre: string) =>
    categoriasPersonal.find((c) => c.nombre.toLowerCase() === nombre.toLowerCase())?.id
  const gastosDelMes: [number, number, string, string][] = [
    [-95_000, 1, 'Alquiler', 'Vivienda'],
    [-6_240, 3, 'Luz', 'Suministros'],
    [-4_500, 4, 'Internet y móvil', 'Suministros'],
    [-13_480, 5, 'Compra semanal', 'Alimentación'],
    [-3_890, 7, 'Gasolina', 'Transporte'],
    [-11_950, 9, 'Compra semanal', 'Alimentación'],
    [-2_640, 10, 'Farmacia', 'Salud'],
    [-4_200, 12, 'Cena fuera', 'Ocio'],
    [-12_310, 14, 'Compra semanal', 'Alimentación'],
    [-1_890, 16, 'Café y prensa', 'Ocio'],
    [-5_600, 17, 'Ropa', 'Compras'],
  ]
  const ingresoPersonal = categoriasPersonal.find((c) => c.flujo === 'ingreso')
  await post('/movimientos', {
    cuentaId,
    importe: 244_360,
    fecha: esteMes(1),
    concepto: 'Nómina',
    categoriaId: ingresoPersonal?.id,
  })
  for (const [importe, dia, concepto, nombreCategoria] of gastosDelMes) {
    await post('/movimientos', {
      cuentaId,
      importe,
      fecha: esteMes(dia),
      concepto,
      categoriaId: categoria(nombreCategoria),
    })
  }

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

  await sembrarCasa()
  await sembrarNegocio()

  /**
   * El espacio de pareja. Hace falta una segunda persona de verdad —con su
   * cuenta y sus gastos— o la pantalla de compartido no enseña nada: el caso
   * interesante es justo el de dos personas que pagan cosas distintas.
   */
  async function sembrarCasa() {
    const pareja = await prisma.usuario.create({
      data: {
        email: 'pareja@norte.local',
        nombre: 'Marta',
        hashContrasena: await cifrarContrasena(contrasena),
      },
    })
    await prisma.miembroEspacio.create({
      data: { espacioId: casa.id, usuarioId: pareja.id, rol: 'editor' },
    })

    const enCasa = (ruta: string, cuerpo: Record<string, unknown>, quien = cookie) =>
      app.inject({
        method: 'POST',
        url: `/api/espacios/${casa.id}${ruta}`,
        headers: { cookie: quien },
        payload: cuerpo,
      })

    const entradaPareja = await app.inject({
      method: 'POST',
      url: '/api/auth/entrar',
      payload: { email: pareja.email, contrasena },
    })
    const galleta = entradaPareja.cookies.find((c) => c.name === COOKIE_SESION)!
    const cookiePareja = `${COOKIE_SESION}=${galleta.value}`

    const cuentaMia = ((await enCasa('/cuentas', {
      nombre: 'Corriente de Demo', tipo: 'corriente', saldoInicial: 180_000,
    })).json() as { cuenta: { id: string } }).cuenta.id
    const cuentaSuya = ((await enCasa('/cuentas', {
      nombre: 'Corriente de Marta', tipo: 'corriente', saldoInicial: 140_000,
    }, cookiePareja)).json() as { cuenta: { id: string } }).cuenta.id

    // Sueldos distintos: es lo que hace interesante el reparto proporcional.
    const ingreso = await prisma.categoria.findFirst({
      where: { espacioId: casa.id, flujo: 'ingreso' },
    })
    await enCasa('/movimientos', {
      cuentaId: cuentaMia, importe: 244_360, fecha: dentroDe(-12),
      concepto: 'Nómina', categoriaId: ingreso?.id,
    })
    await enCasa('/movimientos', {
      cuentaId: cuentaSuya, importe: 178_000, fecha: dentroDe(-12),
      concepto: 'Nómina', categoriaId: ingreso?.id,
    }, cookiePareja)

    await enCasa('/repartos', {
      nombre: 'Gastos comunes',
      tipo: 'proporcional_ingresos',
      partes: [{ usuarioId: usuario.id }, { usuarioId: pareja.id }],
    })

    const comunes: [string, number, string, number][] = [
      [cuentaMia, -95_000, 'Alquiler', -10],
      [cuentaMia, -6_240, 'Luz', -8],
      [cuentaSuya, -14_320, 'Compra semanal', -6],
      [cuentaSuya, -4_500, 'Internet', -4],
      [cuentaMia, -8_800, 'Cena fuera', -2],
    ]
    for (const [cuentaId, importe, concepto, dias] of comunes) {
      await enCasa(
        '/movimientos',
        { cuentaId, importe, fecha: dentroDe(dias), concepto, esCompartido: true },
        cuentaId === cuentaSuya ? cookiePareja : cookie,
      )
    }
  }


  /**
   * Un espacio de negocio con dos socios. Sin él, el modo negocio solo se
   * podría mirar creando la sociedad a mano, y lo que hay que poder juzgar es
   * la pantalla llena.
   */
  async function sembrarNegocio() {
    const empresa = await crearEspacio(prisma, {
      usuarioId: usuario.id,
      nombre: 'La empresa',
      tipo: 'negocio',
    })
    const socio = await prisma.usuario.findUnique({ where: { email: 'pareja@norte.local' } })
    await prisma.miembroEspacio.create({
      data: { espacioId: empresa.id, usuarioId: socio!.id, rol: 'editor', participacion: 40 },
    })
    await prisma.miembroEspacio.updateMany({
      where: { espacioId: empresa.id, usuarioId: usuario.id },
      data: { participacion: 60 },
    })

    const enEmpresa = (ruta: string, cuerpo: Record<string, unknown>) =>
      app.inject({
        method: 'POST',
        url: `/api/espacios/${empresa.id}${ruta}`,
        headers: { cookie },
        payload: cuerpo,
      })

    const bancoId = ((await enEmpresa('/cuentas', {
      nombre: 'Cuenta de la empresa', tipo: 'corriente', saldoInicial: 850_000,
    })).json() as { cuenta: { id: string } }).cuenta.id

    const ingreso = await prisma.categoria.findFirst({
      where: { espacioId: empresa.id, flujo: 'ingreso' },
    })
    const gasto = await prisma.categoria.findFirst({
      where: { espacioId: empresa.id, flujo: 'gasto' },
    })
    for (let mes = 0; mes < 7; mes++) {
      const fecha = new Date(Date.UTC(new Date().getUTCFullYear(), mes, 10)).toISOString().slice(0, 10)
      await enEmpresa('/movimientos', {
        cuentaId: bancoId, importe: 1_450_000, fecha, concepto: 'Facturación', categoriaId: ingreso?.id,
      })
      await enEmpresa('/movimientos', {
        cuentaId: bancoId, importe: -890_000, fecha, concepto: 'Gastos del mes', categoriaId: gasto?.id,
      })
    }

    await enEmpresa('/negocio/capital', {
      usuarioId: usuario.id, tipo: 'aportacion', importe: 1_800_000, fecha: '2024-01-15',
      notas: 'Capital inicial',
    })
    await enEmpresa('/negocio/capital', {
      usuarioId: socio!.id, tipo: 'aportacion', importe: 1_200_000, fecha: '2024-01-15',
      notas: 'Capital inicial',
    })
    await enEmpresa('/negocio/capital', {
      usuarioId: socio!.id, tipo: 'retirada', importe: 350_000, fecha: dentroDe(-40),
    })
  }

  console.log(`Sembrado. Entra con ${email} / ${contrasena}`)
  await app.close()
  await prisma.$disconnect()
}

sembrar().catch((error) => {
  console.error('No se ha podido sembrar:', error)
  process.exit(1)
})
