import type { FastifyInstance } from 'fastify'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { crearApp, limpiarBd, prisma, registrar, type Cuenta } from './ayuda.js'

/**
 * El cuadro. Lo que se prueba aquí es lo que no puede probar el dominio: que
 * las piezas se juntan bien, que nada se cuenta dos veces y que un espacio
 * compartido no enseña de más.
 */

let app: FastifyInstance
let yo: Cuenta
let espacioId: string

const hoy = () => new Date().toISOString().slice(0, 10)
const enDias = (dias: number) => {
  const f = new Date()
  f.setDate(f.getDate() + dias)
  return f.toISOString().slice(0, 10)
}

async function crearCuenta(datos: Record<string, unknown>) {
  const respuesta = await app.inject({
    method: 'POST',
    url: `/api/espacios/${espacioId}/cuentas`,
    headers: { cookie: yo.cookie },
    payload: { tipo: 'corriente', saldoInicial: 0, ...datos },
  })
  return (respuesta.json() as { cuenta: { id: string } }).cuenta.id
}

async function cuadro(cookie = yo.cookie) {
  return app.inject({ method: 'GET', url: `/api/espacios/${espacioId}/cuadro`, headers: { cookie } })
}

beforeEach(async () => {
  await limpiarBd()
  app = await crearApp()
  yo = await registrar(app, 'yo@ejemplo.es')
  espacioId = yo.espacioPersonalId
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('el patrimonio neto', () => {
  it('suma lo líquido y resta las deudas', async () => {
    await crearCuenta({ nombre: 'Corriente', saldoInicial: 350_000 })
    await crearCuenta({ nombre: 'Piso', tipo: 'activo_no_liquido', saldoInicial: 18_000_000 })
    await app.inject({
      method: 'POST',
      url: `/api/espacios/${espacioId}/deudas`,
      headers: { cookie: yo.cookie },
      payload: {
        nombre: 'Hipoteca',
        tipo: 'hipoteca',
        principalOriginal: 15_000_000,
        tin: 3,
        plazoMeses: 360,
        fechaPrimerPago: enDias(30),
      },
    })

    const cuerpo = (await cuadro()).json()
    expect(cuerpo.patrimonio.activos).toBe(18_350_000)
    expect(cuerpo.patrimonio.pasivos).toBe(15_000_000)
    expect(cuerpo.patrimonio.neto).toBe(3_350_000)
  })

  it('una cuenta marcada como fuera del patrimonio no cuenta', async () => {
    await crearCuenta({ nombre: 'Corriente', saldoInicial: 100_000 })
    await crearCuenta({ nombre: 'De la empresa', saldoInicial: 900_000, computaPatrimonio: false })
    expect((await cuadro()).json().patrimonio.activos).toBe(100_000)
  })

  it('la cartera de inversión entra por su valor', async () => {
    const inversion = await app.inject({
      method: 'POST',
      url: `/api/espacios/${espacioId}/inversiones`,
      headers: { cookie: yo.cookie },
      payload: { nombre: 'Cartera', tipo: 'broker' },
    })
    const cuentaInvId = (inversion.json() as { cuenta: { id: string } }).cuenta.id
    const posicion = await app.inject({
      method: 'POST',
      url: `/api/espacios/${espacioId}/inversiones/${cuentaInvId}/posiciones`,
      headers: { cookie: yo.cookie },
      payload: { nombre: 'Índice', clase: 'renta_variable' },
    })
    const posicionId = (posicion.json() as { posicion: { id: string } }).posicion.id
    await app.inject({
      method: 'POST',
      url: `/api/espacios/${espacioId}/inversiones/posiciones/${posicionId}/movimientos`,
      headers: { cookie: yo.cookie },
      payload: { tipo: 'compra', fecha: hoy(), participaciones: 10, importe: 100_000 },
    })
    await app.inject({
      method: 'PATCH',
      url: `/api/espacios/${espacioId}/inversiones/posiciones/${posicionId}/precio`,
      headers: { cookie: yo.cookie },
      payload: { ultimoPrecio: 12_000 },
    })

    const cuerpo = (await cuadro()).json()
    expect(cuerpo.valorCartera).toBe(120_000)
    expect(cuerpo.patrimonio.activos).toBe(120_000)
  })
})

describe('la proyección a 30 días', () => {
  it('parte del saldo líquido y aplica lo previsto', async () => {
    const cuentaId = await crearCuenta({ nombre: 'Corriente', saldoInicial: 120_000 })
    await app.inject({
      method: 'POST',
      url: `/api/espacios/${espacioId}/movimientos`,
      headers: { cookie: yo.cookie },
      payload: {
        cuentaId,
        importe: -75_000,
        fecha: enDias(5),
        concepto: 'Alquiler',
        estado: 'previsto',
      },
    })

    const cuerpo = (await cuadro()).json()
    expect(cuerpo.liquido).toBe(120_000)
    expect(cuerpo.proyeccion.dias).toHaveLength(30)
    expect(cuerpo.proyeccion.saldoFinal).toBe(45_000)
    expect(cuerpo.proyeccion.minimo.saldo).toBe(45_000)
  })

  it('avisa del primer día en negativo', async () => {
    const cuentaId = await crearCuenta({ nombre: 'Corriente', saldoInicial: 50_000 })
    await app.inject({
      method: 'POST',
      url: `/api/espacios/${espacioId}/movimientos`,
      headers: { cookie: yo.cookie },
      payload: { cuentaId, importe: -75_000, fecha: enDias(5), concepto: 'Alquiler', estado: 'previsto' },
    })
    const cuerpo = (await cuadro()).json()
    expect(cuerpo.proyeccion.primerDiaEnNegativo).toBe(enDias(5))
  })

  it('las cuotas de las deudas entran en la proyección solas', async () => {
    await crearCuenta({ nombre: 'Corriente', saldoInicial: 500_000 })
    await app.inject({
      method: 'POST',
      url: `/api/espacios/${espacioId}/deudas`,
      headers: { cookie: yo.cookie },
      payload: {
        nombre: 'Coche',
        tipo: 'auto',
        principalOriginal: 1_200_000,
        tin: 7.5,
        plazoMeses: 60,
        fechaPrimerPago: enDias(10),
      },
    })
    const cuerpo = (await cuadro()).json()
    const cuota = cuerpo.vencimientos.find((v: { concepto: string }) => v.concepto === 'Coche')
    expect(cuota).toMatchObject({ fecha: enDias(10), importe: -24_046 })
    expect(cuerpo.proyeccion.saldoFinal).toBe(500_000 - 24_046)
  })
})

describe('la foto del patrimonio', () => {
  it('se guarda una por mes y se puede repetir sin duplicar', async () => {
    await crearCuenta({ nombre: 'Corriente', saldoInicial: 100_000 })
    for (let i = 0; i < 3; i++) {
      const respuesta = await app.inject({
        method: 'POST',
        url: `/api/espacios/${espacioId}/cuadro/foto`,
        headers: { cookie: yo.cookie },
      })
      expect(respuesta.json().guardada).toBe(true)
    }
    expect(await prisma.fotoPatrimonio.count()).toBe(1)
  })

  it('con una sola foto el gráfico dice que no hay bastante', async () => {
    await crearCuenta({ nombre: 'Corriente', saldoInicial: 100_000 })
    await app.inject({
      method: 'POST',
      url: `/api/espacios/${espacioId}/cuadro/foto`,
      headers: { cookie: yo.cookie },
    })
    const cuerpo = (await cuadro()).json()
    expect(cuerpo.historico.hayBastante).toBe(false)
    expect(cuerpo.variacionMes).toBeNull()
  })

  it('con una foto de un mes anterior sí compara', async () => {
    await crearCuenta({ nombre: 'Corriente', saldoInicial: 100_000 })
    const mesPasado = new Date()
    mesPasado.setMonth(mesPasado.getMonth() - 1, 1)
    await prisma.fotoPatrimonio.create({
      data: {
        espacioId,
        mes: new Date(Date.UTC(mesPasado.getFullYear(), mesPasado.getMonth(), 1)),
        activos: BigInt(80_000),
        pasivos: BigInt(0),
        patrimonioNeto: BigInt(80_000),
      },
    })
    await app.inject({
      method: 'POST',
      url: `/api/espacios/${espacioId}/cuadro/foto`,
      headers: { cookie: yo.cookie },
    })
    const cuerpo = (await cuadro()).json()
    expect(cuerpo.variacionMes).toEqual({ absoluta: 20_000, porcentaje: 25 })
    expect(cuerpo.historico.hayBastante).toBe(true)
  })
})

describe('en un espacio compartido', () => {
  it('el cuadro no cuenta la cuenta privada de otro', async () => {
    const compartido = await app.inject({
      method: 'POST',
      url: '/api/espacios',
      headers: { cookie: yo.cookie },
      payload: { nombre: 'Casa', tipo: 'pareja' },
    })
    const casaId = (compartido.json() as { espacio: { id: string } }).espacio.id
    const otra = await registrar(app, 'otra@ejemplo.es')
    await prisma.miembroEspacio.create({
      data: { espacioId: casaId, usuarioId: otra.usuarioId, rol: 'editor' },
    })

    await app.inject({
      method: 'POST',
      url: `/api/espacios/${casaId}/cuentas`,
      headers: { cookie: yo.cookie },
      payload: { nombre: 'Mi hucha', tipo: 'ahorro', saldoInicial: 500_000, visibleEnEspacio: false },
    })

    const mio = await app.inject({ method: 'GET', url: `/api/espacios/${casaId}/cuadro`, headers: { cookie: yo.cookie } })
    const suyo = await app.inject({ method: 'GET', url: `/api/espacios/${casaId}/cuadro`, headers: { cookie: otra.cookie } })
    expect(mio.json().patrimonio.neto).toBe(500_000)
    expect(suyo.json().patrimonio.neto).toBe(0)
  })
})
