import type { FastifyInstance } from 'fastify'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { crearApp, limpiarBd, prisma, registrar, type Cuenta } from './ayuda.js'

let app: FastifyInstance
let yo: Cuenta
let espacioId: string
let cuentaId: string
let posicionId: string

async function cartera(cookie = yo.cookie) {
  const respuesta = await app.inject({
    method: 'GET',
    url: `/api/espacios/${espacioId}/inversiones`,
    headers: { cookie },
  })
  return respuesta
}

async function apuntar(datos: Record<string, unknown>) {
  return app.inject({
    method: 'POST',
    url: `/api/espacios/${espacioId}/inversiones/posiciones/${posicionId}/movimientos`,
    headers: { cookie: yo.cookie },
    payload: datos,
  })
}

beforeEach(async () => {
  await limpiarBd()
  app = await crearApp()
  yo = await registrar(app, 'yo@ejemplo.es')
  espacioId = yo.espacioPersonalId

  const cuenta = await app.inject({
    method: 'POST',
    url: `/api/espacios/${espacioId}/inversiones`,
    headers: { cookie: yo.cookie },
    payload: { nombre: 'Broker', broker: 'Indexa', tipo: 'broker' },
  })
  cuentaId = (cuenta.json() as { cuenta: { id: string } }).cuenta.id

  const posicion = await app.inject({
    method: 'POST',
    url: `/api/espacios/${espacioId}/inversiones/${cuentaId}/posiciones`,
    headers: { cookie: yo.cookie },
    payload: { nombre: 'MSCI World', isin: 'IE00B4L5Y983', clase: 'renta_variable' },
  })
  posicionId = (posicion.json() as { posicion: { id: string } }).posicion.id
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('la cartera', () => {
  it('acumula compras y calcula el coste medio', async () => {
    await apuntar({ tipo: 'compra', fecha: '2024-01-15', participaciones: 10, importe: 100_000, comision: 500 })
    await apuntar({ tipo: 'compra', fecha: '2024-06-15', participaciones: 10, importe: 140_000, comision: 500 })

    const posicion = (await cartera()).json().cuentas[0].posiciones[0]
    expect(posicion.participaciones).toBe(20)
    expect(posicion.costeTotal).toBe(241_000)
    expect(posicion.costeMedio).toBe(12_050)
  })

  it('sin precio no inventa un valor: la rentabilidad viene en null', async () => {
    await apuntar({ tipo: 'compra', fecha: '2024-01-15', participaciones: 10, importe: 100_000 })
    const cuerpo = (await cartera()).json()
    expect(cuerpo.cuentas[0].posiciones[0].rentabilidad).toBeNull()
    expect(cuerpo.total.valor).toBe(0)
    // Sin valor, tampoco hay TIR que dar.
    expect(cuerpo.tir).toBeNull()
  })

  it('con precio calcula valor, plusvalía latente y TIR', async () => {
    await apuntar({ tipo: 'compra', fecha: '2025-01-01', participaciones: 10, importe: 100_000 })
    await app.inject({
      method: 'PATCH',
      url: `/api/espacios/${espacioId}/inversiones/posiciones/${posicionId}/precio`,
      headers: { cookie: yo.cookie },
      payload: { ultimoPrecio: 12_000 },
    })

    const cuerpo = (await cartera()).json()
    expect(cuerpo.total.valor).toBe(120_000)
    expect(cuerpo.total.plusvaliaLatente).toBe(20_000)
    expect(cuerpo.total.rentabilidad).toBeCloseTo(20, 6)
    expect(cuerpo.tir).toBeGreaterThan(0)
  })

  it('guarda la fecha de valoración: un precio sin fecha no dice nada', async () => {
    await app.inject({
      method: 'PATCH',
      url: `/api/espacios/${espacioId}/inversiones/posiciones/${posicionId}/precio`,
      headers: { cookie: yo.cookie },
      payload: { ultimoPrecio: 12_000, fechaValoracion: '2026-08-19' },
    })
    const posicion = (await cartera()).json().cuentas[0].posiciones[0]
    expect(posicion.fechaValoracion).toBe('2026-08-19')
  })

  it('los dividendos suman aparte y no bajan el coste', async () => {
    await apuntar({ tipo: 'compra', fecha: '2025-01-01', participaciones: 10, importe: 100_000 })
    await apuntar({ tipo: 'dividendo', fecha: '2025-06-01', participaciones: 0, importe: 3_000 })
    const cuerpo = (await cartera()).json()
    expect(cuerpo.total.dividendos).toBe(3_000)
    expect(cuerpo.total.coste).toBe(100_000)
  })

  it('vender parte deja la plusvalía realizada guardada', async () => {
    await apuntar({ tipo: 'compra', fecha: '2025-01-01', participaciones: 20, importe: 200_000 })
    await apuntar({ tipo: 'venta', fecha: '2025-09-01', participaciones: 10, importe: 130_000 })
    const cuerpo = (await cartera()).json()
    expect(cuerpo.total.plusvaliaRealizada).toBe(30_000)
    expect(cuerpo.cuentas[0].posiciones[0].participaciones).toBe(10)
  })
})

describe('el rebalanceo', () => {
  it('avisa solo cuando el desvío pasa del umbral en puntos', async () => {
    await apuntar({ tipo: 'compra', fecha: '2025-01-01', participaciones: 10, importe: 800_000 })
    await app.inject({
      method: 'PATCH',
      url: `/api/espacios/${espacioId}/inversiones/posiciones/${posicionId}/precio`,
      headers: { cookie: yo.cookie },
      payload: { ultimoPrecio: 80_000 },
    })

    const respuesta = await app.inject({
      method: 'PUT',
      url: `/api/espacios/${espacioId}/inversiones/objetivos`,
      headers: { cookie: yo.cookie },
      payload: {
        objetivos: [
          { clase: 'renta_variable', objetivo: 70, umbral: 5 },
          { clase: 'renta_fija', objetivo: 30, umbral: 5 },
        ],
      },
    })
    const desvios = respuesta.json().desvios as {
      clase: string
      desviacion: number
      fueraDeRango: boolean
      ajuste: number
    }[]
    const variable = desvios.find((d) => d.clase === 'renta_variable')!
    // Toda la cartera es renta variable: 100 % contra un objetivo del 70.
    expect(variable.desviacion).toBeCloseTo(30, 6)
    expect(variable.fueraDeRango).toBe(true)
    // Un 30 % de los 8.000 € de cartera son 2.400 € que habría que vender.
    expect(variable.ajuste).toBe(-240_000)
  })
})

describe('las inversiones son del espacio', () => {
  it('otro no ve la cartera ni añade movimientos', async () => {
    const otra = await registrar(app, 'otra@ejemplo.es')
    expect((await cartera(otra.cookie)).statusCode).toBe(404)

    const intento = await app.inject({
      method: 'POST',
      url: `/api/espacios/${otra.espacioPersonalId}/inversiones/posiciones/${posicionId}/movimientos`,
      headers: { cookie: otra.cookie },
      payload: { tipo: 'compra', fecha: '2025-01-01', participaciones: 1, importe: 1_000 },
    })
    expect(intento.statusCode).toBe(404)
    expect(await prisma.movimientoInversion.count()).toBe(0)
  })

  it('quien solo lee no toca precios', async () => {
    const otra = await registrar(app, 'otra@ejemplo.es')
    await prisma.miembroEspacio.create({
      data: { espacioId, usuarioId: otra.usuarioId, rol: 'lector' },
    })
    const intento = await app.inject({
      method: 'PATCH',
      url: `/api/espacios/${espacioId}/inversiones/posiciones/${posicionId}/precio`,
      headers: { cookie: otra.cookie },
      payload: { ultimoPrecio: 99_999 },
    })
    expect(intento.statusCode).toBe(403)
  })
})
