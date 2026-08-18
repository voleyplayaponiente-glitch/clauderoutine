import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { crearApp, limpiarBd, prisma, registrar, type Cuenta } from './ayuda.js'

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

async function cuentaDe(cuenta: Cuenta, espacioId: string) {
  const r = await app.inject({
    method: 'POST',
    url: `/api/espacios/${espacioId}/cuentas`,
    headers: { cookie: cuenta.cookie },
    payload: { nombre: 'Corriente', tipo: 'corriente' },
  })
  return (r.json() as { cuenta: { id: string } }).cuenta.id
}

const ayer = () => {
  const f = new Date()
  f.setDate(f.getDate() - 1)
  return f.toISOString().slice(0, 10)
}

describe('recurrentes', () => {
  it('se crean y dicen cuándo toca la próxima', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const cuentaId = await cuentaDe(ana, ana.espacioPersonalId)

    const creada = await app.inject({
      method: 'POST',
      url: `/api/espacios/${ana.espacioPersonalId}/recurrentes`,
      headers: { cookie: ana.cookie },
      payload: {
        cuentaId,
        concepto: 'Alquiler',
        importe: -85000,
        periodicidad: 'mensual',
        desde: '2026-01-01',
        diaDelMes: 1,
      },
    })
    expect(creada.statusCode).toBe(201)

    const lista = await app.inject({
      method: 'GET',
      url: `/api/espacios/${ana.espacioPersonalId}/recurrentes`,
      headers: { cookie: ana.cookie },
    })
    const regla = lista.json().recurrentes[0]
    expect(regla).toMatchObject({ concepto: 'Alquiler', importe: -85000 })
    expect(regla.proxima).toMatch(/^\d{4}-\d{2}-01$/)
  })

  it('generar deja previstos, y generar otra vez NO los duplica', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const cuentaId = await cuentaDe(ana, ana.espacioPersonalId)
    await app.inject({
      method: 'POST',
      url: `/api/espacios/${ana.espacioPersonalId}/recurrentes`,
      headers: { cookie: ana.cookie },
      payload: {
        cuentaId,
        concepto: 'Netflix',
        importe: -1399,
        periodicidad: 'mensual',
        desde: ayer(),
      },
    })

    const generar = () =>
      app.inject({
        method: 'POST',
        url: `/api/espacios/${ana.espacioPersonalId}/recurrentes/generar`,
        headers: { cookie: ana.cookie },
        payload: {},
      })

    const primera = await generar()
    expect(primera.json().creados).toBeGreaterThan(0)

    const segunda = await generar()
    // Si esto duplicara, un temporizador nocturno llenaría la app de recibos
    // fantasma en una semana.
    expect(segunda.json().creados).toBe(0)
    expect(segunda.json().revisados).toBe(primera.json().creados)
  })

  it('los previstos no tocan el saldo, pero sí están en la lista', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const cuentaId = await cuentaDe(ana, ana.espacioPersonalId)
    await app.inject({
      method: 'POST',
      url: `/api/espacios/${ana.espacioPersonalId}/recurrentes`,
      headers: { cookie: ana.cookie },
      payload: { cuentaId, concepto: 'Gimnasio', importe: -3500, periodicidad: 'mensual', desde: ayer() },
    })
    await app.inject({
      method: 'POST',
      url: `/api/espacios/${ana.espacioPersonalId}/recurrentes/generar`,
      headers: { cookie: ana.cookie },
      payload: {},
    })

    const cuentas = await app.inject({
      method: 'GET',
      url: `/api/espacios/${ana.espacioPersonalId}/cuentas`,
      headers: { cookie: ana.cookie },
    })
    expect(cuentas.json().cuentas[0].saldo).toBe(0)

    const previstos = await app.inject({
      method: 'GET',
      url: `/api/espacios/${ana.espacioPersonalId}/movimientos?estado=previsto`,
      headers: { cookie: ana.cookie },
    })
    expect(previstos.json().total).toBeGreaterThan(0)
  })

  it('al borrar la regla se van sus previstos, pero no lo ya confirmado', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const cuentaId = await cuentaDe(ana, ana.espacioPersonalId)
    const creada = await app.inject({
      method: 'POST',
      url: `/api/espacios/${ana.espacioPersonalId}/recurrentes`,
      headers: { cookie: ana.cookie },
      payload: { cuentaId, concepto: 'Seguro', importe: -4200, periodicidad: 'mensual', desde: ayer() },
    })
    const reglaId = creada.json().recurrente.id
    await app.inject({
      method: 'POST',
      url: `/api/espacios/${ana.espacioPersonalId}/recurrentes/generar`,
      headers: { cookie: ana.cookie },
      payload: {},
    })
    // Uno de ellos ya ha pasado de verdad y se confirma.
    const uno = await prisma.movimiento.findFirstOrThrow({ where: { reglaId } })
    await prisma.movimiento.update({ where: { id: uno.id }, data: { estado: 'confirmado' } })

    await app.inject({
      method: 'DELETE',
      url: `/api/espacios/${ana.espacioPersonalId}/recurrentes/${reglaId}`,
      headers: { cookie: ana.cookie },
    })

    const vivos = await prisma.movimiento.findMany({ where: { reglaId, borradoEn: null } })
    expect(vivos).toHaveLength(1)
    expect(vivos[0]!.estado).toBe('confirmado')
  })

  it('una recurrente de la cuenta privada de otro no se ve', async () => {
    const ana = await registrar(app, 'ana@ejemplo.es')
    const berta = await registrar(app, 'berta@ejemplo.es')
    const casa = (await app.inject({
      method: 'POST',
      url: '/api/espacios',
      headers: { cookie: ana.cookie },
      payload: { nombre: 'Casa', tipo: 'pareja' },
    })).json().espacio.id
    await app.inject({
      method: 'POST',
      url: `/api/espacios/${casa}/miembros`,
      headers: { cookie: ana.cookie },
      payload: { email: berta.email, rol: 'editor' },
    })

    const privada = (await app.inject({
      method: 'POST',
      url: `/api/espacios/${casa}/cuentas`,
      headers: { cookie: ana.cookie },
      payload: { nombre: 'La mía', tipo: 'corriente', visibleEnEspacio: false },
    })).json().cuenta.id

    await app.inject({
      method: 'POST',
      url: `/api/espacios/${casa}/recurrentes`,
      headers: { cookie: ana.cookie },
      payload: { cuentaId: privada, concepto: 'Psicólogo', importe: -6000, periodicidad: 'mensual', desde: ayer() },
    })

    const lista = await app.inject({
      method: 'GET',
      url: `/api/espacios/${casa}/recurrentes`,
      headers: { cookie: berta.cookie },
    })
    expect(lista.json().recurrentes).toHaveLength(0)
    expect(lista.body).not.toContain('Psicólogo')
  })
})
