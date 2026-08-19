import type { FastifyInstance } from 'fastify'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { crearApp, limpiarBd, prisma, registrar, type Cuenta } from './ayuda.js'

/**
 * Deudas y tarjetas de punta a punta. Las fórmulas tienen sus propias pruebas
 * en el dominio; aquí se prueba lo que es del servidor: que el cuadro se
 * calcula y no se guarda, que las amortizaciones se acumulan bien y que nadie
 * ve ni toca las deudas de otro espacio.
 */

let app: FastifyInstance
let yo: Cuenta
let espacioId: string

const HIPOTECA = {
  nombre: 'Hipoteca',
  tipo: 'hipoteca',
  entidad: 'Banco',
  principalOriginal: 15_000_000,
  tin: 3,
  plazoMeses: 360,
  sistema: 'frances',
  fechaPrimerPago: '2026-09-01',
  comisionAmortizacion: 0.5,
}

async function crearDeuda(datos: Record<string, unknown> = {}) {
  const respuesta = await app.inject({
    method: 'POST',
    url: `/api/espacios/${espacioId}/deudas`,
    headers: { cookie: yo.cookie },
    payload: { ...HIPOTECA, ...datos },
  })
  return respuesta
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

describe('crear una deuda', () => {
  it('calcula la cuota y la TAE equivalente sola', async () => {
    const respuesta = await crearDeuda()
    expect(respuesta.statusCode).toBe(201)
    const { deuda } = respuesta.json() as { deuda: Record<string, number> }
    expect(deuda.cuota).toBe(63_241)
    expect(deuda.taeEquivalente).toBeCloseTo(3.0416, 4)
  })

  it('el cuadro no se guarda en la base: se calcula', async () => {
    await crearDeuda()
    expect(await prisma.cuotaAmortizacion.count()).toBe(0)

    const lista = await app.inject({
      method: 'GET',
      url: `/api/espacios/${espacioId}/deudas`,
      headers: { cookie: yo.cookie },
    })
    expect(lista.json().deudas[0].resumen.cuotas).toBe(360)
  })

  it('devuelve el cuadro entero cuando se pide', async () => {
    const { deuda } = (await crearDeuda()).json() as { deuda: { id: string } }
    const respuesta = await app.inject({
      method: 'GET',
      url: `/api/espacios/${espacioId}/deudas/${deuda.id}/cuadro`,
      headers: { cookie: yo.cookie },
    })
    const { cuadro, resumen } = respuesta.json() as {
      cuadro: { saldoVivo: number }[]
      resumen: { totalIntereses: number }
    }
    expect(cuadro).toHaveLength(360)
    expect(cuadro[cuadro.length - 1]!.saldoVivo).toBe(0)
    expect(resumen.totalIntereses).toBe(7_766_533)
  })

  it('rechaza un plazo imposible en vez de calcular con él', async () => {
    expect((await crearDeuda({ plazoMeses: 0 })).statusCode).toBe(400)
    expect((await crearDeuda({ tin: -1 })).statusCode).toBe(400)
  })
})

describe('simular una amortización anticipada', () => {
  it('devuelve las dos opciones juntas, con la comisión descontada', async () => {
    const { deuda } = (await crearDeuda()).json() as { deuda: { id: string } }
    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/espacios/${espacioId}/deudas/${deuda.id}/simular`,
      headers: { cookie: yo.cookie },
      payload: { trasCuota: 24, importe: 1_000_000 },
    })
    const { reducirPlazo, reducirCuota } = respuesta.json() as Record<
      string,
      { interesAhorrado: number; ahorroNeto: number; comision: number; cuotasAhorradas: number }
    >
    // La comisión del 0,5 % sobre 10.000 € son 50 €, y sale del ahorro.
    expect(reducirPlazo.comision).toBe(5_000)
    expect(reducirPlazo.ahorroNeto).toBe(reducirPlazo.interesAhorrado - 5_000)
    expect(reducirPlazo.interesAhorrado).toBeGreaterThan(reducirCuota.interesAhorrado)
    expect(reducirCuota.cuotasAhorradas).toBe(0)
  })

  it('simular no cambia nada', async () => {
    const { deuda } = (await crearDeuda()).json() as { deuda: { id: string } }
    await app.inject({
      method: 'POST',
      url: `/api/espacios/${espacioId}/deudas/${deuda.id}/simular`,
      headers: { cookie: yo.cookie },
      payload: { trasCuota: 24, importe: 1_000_000 },
    })
    expect(await prisma.amortizacionExtra.count()).toBe(0)
  })
})

describe('registrar amortizaciones', () => {
  it('acorta el préstamo y guarda cuánto interés ahorró', async () => {
    const { deuda } = (await crearDeuda()).json() as { deuda: { id: string } }
    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/espacios/${espacioId}/deudas/${deuda.id}/amortizaciones`,
      headers: { cookie: yo.cookie },
      payload: { trasCuota: 12, importe: 1_000_000, reducePlazo: true },
    })
    expect(respuesta.statusCode).toBe(201)
    const actualizada = respuesta.json().deuda
    expect(actualizada.resumen.cuotas).toBeLessThan(360)
    expect(actualizada.amortizaciones[0].interesAhorrado).toBeGreaterThan(0)
  })

  it('dos amortizaciones se acumulan y el cuadro sigue cerrando en cero', async () => {
    const { deuda } = (await crearDeuda()).json() as { deuda: { id: string } }
    for (const trasCuota of [12, 36]) {
      await app.inject({
        method: 'POST',
        url: `/api/espacios/${espacioId}/deudas/${deuda.id}/amortizaciones`,
        headers: { cookie: yo.cookie },
        payload: { trasCuota, importe: 500_000, reducePlazo: true },
      })
    }
    const respuesta = await app.inject({
      method: 'GET',
      url: `/api/espacios/${espacioId}/deudas/${deuda.id}/cuadro`,
      headers: { cookie: yo.cookie },
    })
    const cuadro = respuesta.json().cuadro as { saldoVivo: number; capital: number }[]
    expect(cuadro[cuadro.length - 1]!.saldoVivo).toBe(0)
    const capital = cuadro.reduce((t, c) => t + c.capital, 0)
    expect(capital + 1_000_000).toBe(15_000_000)
  })

  it('borrar una amortización devuelve el préstamo a como estaba', async () => {
    const { deuda } = (await crearDeuda()).json() as { deuda: { id: string } }
    const creada = await app.inject({
      method: 'POST',
      url: `/api/espacios/${espacioId}/deudas/${deuda.id}/amortizaciones`,
      headers: { cookie: yo.cookie },
      payload: { trasCuota: 12, importe: 1_000_000 },
    })
    const amortizacionId = creada.json().deuda.amortizaciones[0].id
    const tras = await app.inject({
      method: 'DELETE',
      url: `/api/espacios/${espacioId}/deudas/${deuda.id}/amortizaciones/${amortizacionId}`,
      headers: { cookie: yo.cookie },
    })
    expect(tras.json().deuda.resumen.cuotas).toBe(360)
  })
})

describe('en qué orden pagarlas', () => {
  it('compara avalancha y bola de nieve sobre las deudas reales', async () => {
    await crearDeuda({ nombre: 'Coche', tipo: 'auto', principalOriginal: 1_200_000, tin: 7.5, plazoMeses: 60 })
    await crearDeuda({ nombre: 'Tarjeta', tipo: 'tarjeta_revolving', principalOriginal: 200_000, tin: 21, plazoMeses: 36 })

    const respuesta = await app.inject({
      method: 'GET',
      url: `/api/espacios/${espacioId}/deudas/estrategias?extra=20000`,
      headers: { cookie: yo.cookie },
    })
    const cuerpo = respuesta.json() as {
      deudas: number
      avalancha: { meses: number; interesTotal: number }
      sobrecosteBolaDeNieve: number
    }
    expect(cuerpo.deudas).toBe(2)
    expect(cuerpo.avalancha.meses).toBeGreaterThan(0)
    expect(cuerpo.sobrecosteBolaDeNieve).toBeGreaterThanOrEqual(0)
  })

  it('sin deudas responde que no hay nada que ordenar', async () => {
    const respuesta = await app.inject({
      method: 'GET',
      url: `/api/espacios/${espacioId}/deudas/estrategias?extra=0`,
      headers: { cookie: yo.cookie },
    })
    expect(respuesta.json()).toMatchObject({ deudas: 0, avalancha: null })
  })
})

describe('las deudas son del espacio', () => {
  it('otro no las ve ni las toca', async () => {
    const { deuda } = (await crearDeuda()).json() as { deuda: { id: string } }
    const otra = await registrar(app, 'otra@ejemplo.es')

    const vista = await app.inject({
      method: 'GET',
      url: `/api/espacios/${espacioId}/deudas`,
      headers: { cookie: otra.cookie },
    })
    expect(vista.statusCode).toBe(404)

    const borrado = await app.inject({
      method: 'DELETE',
      url: `/api/espacios/${otra.espacioPersonalId}/deudas/${deuda.id}`,
      headers: { cookie: otra.cookie },
    })
    expect(borrado.statusCode).toBe(404)
    expect(await prisma.deuda.count({ where: { borradaEn: null } })).toBe(1)
  })
})

describe('tarjetas', () => {
  async function crearCuentaTarjeta(tipo = 'tarjeta_credito') {
    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/espacios/${espacioId}/cuentas`,
      headers: { cookie: yo.cookie },
      payload: { nombre: 'Visa', tipo, saldoInicial: 0 },
    })
    return (respuesta.json() as { cuenta: { id: string } }).cuenta.id
  }

  const TARJETA = {
    nombre: 'Visa',
    limite: 300_000,
    diaCorte: 25,
    diaPago: 5,
    modalidad: 'aplazado',
    tin: 24,
    minimoPorcentaje: 3,
    minimoSuelo: 3_000,
  }

  it('calcula el ciclo, lo consumido y la utilización', async () => {
    const cuentaId = await crearCuentaTarjeta()
    await app.inject({
      method: 'POST',
      url: `/api/espacios/${espacioId}/tarjetas`,
      headers: { cookie: yo.cookie },
      payload: { ...TARJETA, cuentaId },
    })
    // Un gasto de hoy entra en el ciclo en curso.
    const hoy = new Date().toISOString().slice(0, 10)
    await app.inject({
      method: 'POST',
      url: `/api/espacios/${espacioId}/movimientos`,
      headers: { cookie: yo.cookie },
      payload: { cuentaId, importe: -90_000, fecha: hoy, concepto: 'Compra' },
    })

    const lista = await app.inject({
      method: 'GET',
      url: `/api/espacios/${espacioId}/tarjetas`,
      headers: { cookie: yo.cookie },
    })
    const tarjeta = lista.json().tarjetas[0]
    expect(tarjeta.consumidoCiclo).toBe(90_000)
    expect(tarjeta.dispuesto).toBe(90_000)
    expect(tarjeta.utilizacion).toBe(30)
    expect(tarjeta.diasGratisSiComprasHoy).toBeGreaterThan(0)
    expect(tarjeta.ciclo.fechaPago > tarjeta.ciclo.hasta).toBe(true)
  })

  it('exige que la cuenta sea de tipo tarjeta de crédito', async () => {
    const cuentaId = await crearCuentaTarjeta('corriente')
    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/espacios/${espacioId}/tarjetas`,
      headers: { cookie: yo.cookie },
      payload: { ...TARJETA, cuentaId },
    })
    expect(respuesta.statusCode).toBe(400)
    expect(respuesta.json().error.mensaje).toMatch(/Tarjeta de crédito/)
  })

  it('no deja dos tarjetas sobre la misma cuenta', async () => {
    const cuentaId = await crearCuentaTarjeta()
    const payload = { ...TARJETA, cuentaId }
    await app.inject({ method: 'POST', url: `/api/espacios/${espacioId}/tarjetas`, headers: { cookie: yo.cookie }, payload })
    const segunda = await app.inject({ method: 'POST', url: `/api/espacios/${espacioId}/tarjetas`, headers: { cookie: yo.cookie }, payload })
    expect(segunda.statusCode).toBe(409)
  })

  it('simula lo que cuesta aplazar', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/espacios/${espacioId}/tarjetas/simular`,
      headers: { cookie: yo.cookie },
      payload: { saldo: 300_000, tin: 24, minimoPorcentaje: 3, minimoSuelo: 3_000 },
    })
    expect(respuesta.json()).toMatchObject({ meses: 159, pagadoTotal: 743_634 })
  })

  it('con una cuota que no cubre los intereses responde «nunca»', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/espacios/${espacioId}/tarjetas/simular`,
      headers: { cookie: yo.cookie },
      payload: { saldo: 300_000, tin: 24, cuotaFija: 6_000 },
    })
    expect(respuesta.json()).toMatchObject({ meses: null, nuncaSeLiquida: true })
  })
})
