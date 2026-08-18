/**
 * Cuentas y movimientos.
 *
 * Además del CRUD, aquí se comprueba la promesa que hace vendible esta app:
 * **una cuenta marcada como no compartida no la ve nadie más**, ni sus
 * movimientos, ni siquiera el propietario del espacio.
 */

import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { crearApp, crearEspacioDe, limpiarBd, prisma, registrar, type Cuenta } from './ayuda.js'

let app: FastifyInstance

beforeAll(async () => {
  app = await crearApp()
})
beforeEach(async () => {
  await limpiarBd()
})
afterAll(async () => {
  await app.close()
  await prisma.$disconnect()
})

const hoy = new Date().toISOString().slice(0, 10)

async function crearCuenta(cuenta: Cuenta, espacioId: string, cuerpo: Record<string, unknown> = {}) {
  const respuesta = await app.inject({
    method: 'POST',
    url: `/api/espacios/${espacioId}/cuentas`,
    headers: { cookie: cuenta.cookie },
    payload: { nombre: 'Nómina', tipo: 'corriente', saldoInicial: 100000, ...cuerpo },
  })
  if (respuesta.statusCode !== 201) throw new Error(`No se pudo crear la cuenta: ${respuesta.body}`)
  return (respuesta.json() as { cuenta: { id: string } }).cuenta.id
}

const anotar = (cuenta: Cuenta, espacioId: string, cuerpo: Record<string, unknown>) =>
  app.inject({
    method: 'POST',
    url: `/api/espacios/${espacioId}/movimientos`,
    headers: { cookie: cuenta.cookie },
    payload: { fecha: hoy, ...cuerpo },
  })

describe('cuentas', () => {
  it('se crean y traen su saldo, que arranca en el inicial', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    await crearCuenta(ana, ana.espacioPersonalId, { saldoInicial: 250000 })

    const lista = await app.inject({
      method: 'GET',
      url: `/api/espacios/${ana.espacioPersonalId}/cuentas`,
      headers: { cookie: ana.cookie },
    })
    expect(lista.json().cuentas[0]).toMatchObject({ nombre: 'Nómina', saldo: 250000, esMia: true })
  })

  it('el saldo suma lo confirmado y NO lo previsto', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const cuentaId = await crearCuenta(ana, ana.espacioPersonalId, { saldoInicial: 100000 })

    await anotar(ana, ana.espacioPersonalId, { cuentaId, importe: -34000, concepto: 'Compra' })
    await anotar(ana, ana.espacioPersonalId, {
      cuentaId,
      importe: -60000,
      concepto: 'Luz prevista',
      estado: 'previsto',
    })

    const lista = await app.inject({
      method: 'GET',
      url: `/api/espacios/${ana.espacioPersonalId}/cuentas`,
      headers: { cookie: ana.cookie },
    })
    // 1.000 − 340 = 660. Los 600 previstos no restan: si restaran, el saldo no
    // cuadraría con el del banco.
    expect(lista.json().cuentas[0].saldo).toBe(66000)
  })

  it('no guarda el número de cuenta entero, solo los cuatro últimos', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const malo = await app.inject({
      method: 'POST',
      url: `/api/espacios/${ana.espacioPersonalId}/cuentas`,
      headers: { cookie: ana.cookie },
      payload: { nombre: 'Banco', tipo: 'corriente', ultimos4: 'ES9121000418450200051332' },
    })
    expect(malo.statusCode).toBe(400)
    expect(malo.json().error.mensaje).toContain('cuatro últimos')
  })

  it('borrar una cuenta se lleva sus movimientos a la papelera, sin borrar nada de verdad', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const cuentaId = await crearCuenta(ana, ana.espacioPersonalId)
    await anotar(ana, ana.espacioPersonalId, { cuentaId, importe: -1000, concepto: 'Café' })

    await app.inject({
      method: 'DELETE',
      url: `/api/espacios/${ana.espacioPersonalId}/cuentas/${cuentaId}`,
      headers: { cookie: ana.cookie },
    })

    expect(await prisma.movimiento.count()).toBe(1)
    const movimiento = await prisma.movimiento.findFirstOrThrow()
    expect(movimiento.borradoEn).not.toBeNull()
  })
})

describe('movimientos', () => {
  it('se anotan, se listan y traen su resumen del filtro entero', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const cuentaId = await crearCuenta(ana, ana.espacioPersonalId)

    await anotar(ana, ana.espacioPersonalId, { cuentaId, importe: 240000, concepto: 'Nómina' })
    await anotar(ana, ana.espacioPersonalId, { cuentaId, importe: -45000, concepto: 'Compra' })
    await anotar(ana, ana.espacioPersonalId, { cuentaId, importe: -12500, concepto: 'Gasolina' })

    const lista = await app.inject({
      method: 'GET',
      url: `/api/espacios/${ana.espacioPersonalId}/movimientos`,
      headers: { cookie: ana.cookie },
    })
    const cuerpo = lista.json()
    expect(cuerpo.total).toBe(3)
    expect(cuerpo.resumen).toEqual({
      ingresos: 240000,
      gastos: 57500,
      balance: 182500,
      previsto: { ingresos: 0, gastos: 0 },
    })
  })

  it('busca por texto y filtra por fecha', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const cuentaId = await crearCuenta(ana, ana.espacioPersonalId)
    await anotar(ana, ana.espacioPersonalId, { cuentaId, importe: -2000, concepto: 'Mercadona', fecha: '2026-08-01' })
    await anotar(ana, ana.espacioPersonalId, { cuentaId, importe: -3000, concepto: 'Gasolina', fecha: '2026-07-15' })

    const texto = await app.inject({
      method: 'GET',
      url: `/api/espacios/${ana.espacioPersonalId}/movimientos?texto=merca`,
      headers: { cookie: ana.cookie },
    })
    expect(texto.json().total).toBe(1)

    const agosto = await app.inject({
      method: 'GET',
      url: `/api/espacios/${ana.espacioPersonalId}/movimientos?desde=2026-08-01&hasta=2026-08-31`,
      headers: { cookie: ana.cookie },
    })
    expect(agosto.json().total).toBe(1)
    expect(agosto.json().movimientos[0].concepto).toBe('Mercadona')
  })

  it('rechaza el importe cero con el mensaje del dominio', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const cuentaId = await crearCuenta(ana, ana.espacioPersonalId)

    const respuesta = await anotar(ana, ana.espacioPersonalId, { cuentaId, importe: 0, concepto: 'Nada' })
    expect(respuesta.statusCode).toBe(400)
    expect(respuesta.json().error.mensaje).toContain('no puede ser cero')
  })

  it('corregir un movimiento cambia el saldo', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const cuentaId = await crearCuenta(ana, ana.espacioPersonalId, { saldoInicial: 0 })
    const creado = await anotar(ana, ana.espacioPersonalId, { cuentaId, importe: -5000, concepto: 'Cena' })
    const id = creado.json().movimiento.id

    await app.inject({
      method: 'PATCH',
      url: `/api/espacios/${ana.espacioPersonalId}/movimientos/${id}`,
      headers: { cookie: ana.cookie },
      payload: { importe: -3250 },
    })

    const cuentas = await app.inject({
      method: 'GET',
      url: `/api/espacios/${ana.espacioPersonalId}/cuentas`,
      headers: { cookie: ana.cookie },
    })
    expect(cuentas.json().cuentas[0].saldo).toBe(-3250)
  })

  it('borrar es papelera, no borrado', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const cuentaId = await crearCuenta(ana, ana.espacioPersonalId)
    const creado = await anotar(ana, ana.espacioPersonalId, { cuentaId, importe: -1000, concepto: 'Café' })

    await app.inject({
      method: 'DELETE',
      url: `/api/espacios/${ana.espacioPersonalId}/movimientos/${creado.json().movimiento.id}`,
      headers: { cookie: ana.cookie },
    })

    const lista = await app.inject({
      method: 'GET',
      url: `/api/espacios/${ana.espacioPersonalId}/movimientos`,
      headers: { cookie: ana.cookie },
    })
    expect(lista.json().total).toBe(0)
    expect((await prisma.movimiento.findFirstOrThrow()).borradoEn).not.toBeNull()
  })
})

describe('lo que no se comparte, no se ve', () => {
  it('una cuenta privada no la ve ni el otro propietario del espacio', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const berta = await registrar(app, 'berta@ejemplo.es')
    const casa = await crearEspacioDe(app, ana)
    await app.inject({
      method: 'POST',
      url: `/api/espacios/${casa}/miembros`,
      headers: { cookie: ana.cookie },
      payload: { email: berta.email, rol: 'editor' },
    })

    const comun = await crearCuenta(ana, casa, { nombre: 'Cuenta común' })
    const privada = await crearCuenta(ana, casa, { nombre: 'La mía', visibleEnEspacio: false })
    await anotar(ana, casa, { cuentaId: privada, importe: -9900, concepto: 'Regalo sorpresa' })
    await anotar(ana, casa, { cuentaId: comun, importe: -2000, concepto: 'Compra común' })

    const cuentas = await app.inject({
      method: 'GET',
      url: `/api/espacios/${casa}/cuentas`,
      headers: { cookie: berta.cookie },
    })
    const nombres = (cuentas.json().cuentas as { nombre: string }[]).map((c) => c.nombre)
    expect(nombres).toEqual(['Cuenta común'])

    // Y tampoco sus movimientos, ni en la lista ni en el resumen.
    const movimientos = await app.inject({
      method: 'GET',
      url: `/api/espacios/${casa}/movimientos`,
      headers: { cookie: berta.cookie },
    })
    expect(movimientos.json().total).toBe(1)
    expect(movimientos.json().resumen.gastos).toBe(2000)
    expect(JSON.stringify(movimientos.json())).not.toContain('Regalo sorpresa')
  })

  it('pedir la cuenta privada por su id tampoco la abre', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const berta = await registrar(app, 'berta@ejemplo.es')
    const casa = await crearEspacioDe(app, ana)
    await app.inject({
      method: 'POST',
      url: `/api/espacios/${casa}/miembros`,
      headers: { cookie: ana.cookie },
      payload: { email: berta.email, rol: 'editor' },
    })
    const privada = await crearCuenta(ana, casa, { nombre: 'La mía', visibleEnEspacio: false })
    await anotar(ana, casa, { cuentaId: privada, importe: -9900, concepto: 'Regalo sorpresa' })

    const filtrando = await app.inject({
      method: 'GET',
      url: `/api/espacios/${casa}/movimientos?cuentaId=${privada}`,
      headers: { cookie: berta.cookie },
    })
    expect(filtrando.json().total).toBe(0)

    // Y no puede escribir en ella.
    const intento = await anotar(berta, casa, { cuentaId: privada, importe: -100, concepto: 'Cuña' })
    expect(intento.statusCode).toBe(404)
  })

  it('no se puede anotar en una cuenta de otro espacio', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const berta = await registrar(app, 'berta@ejemplo.es')
    const cuentaDeAna = await crearCuenta(ana, ana.espacioPersonalId)

    const intento = await anotar(berta, berta.espacioPersonalId, {
      cuentaId: cuentaDeAna,
      importe: -1000,
      concepto: 'Cuña',
    })
    expect(intento.statusCode).toBe(404)
    expect(await prisma.movimiento.count()).toBe(0)
  })

  it('el lector ve pero no anota', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const berta = await registrar(app, 'berta@ejemplo.es')
    const casa = await crearEspacioDe(app, ana)
    await app.inject({
      method: 'POST',
      url: `/api/espacios/${casa}/miembros`,
      headers: { cookie: ana.cookie },
      payload: { email: berta.email, rol: 'lector' },
    })
    const cuentaId = await crearCuenta(ana, casa)

    const ver = await app.inject({
      method: 'GET',
      url: `/api/espacios/${casa}/movimientos`,
      headers: { cookie: berta.cookie },
    })
    expect(ver.statusCode).toBe(200)

    const escribir = await anotar(berta, casa, { cuentaId, importe: -1000, concepto: 'Café' })
    expect(escribir.statusCode).toBe(403)
  })
})
