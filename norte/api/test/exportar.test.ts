import type { FastifyInstance } from 'fastify'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { crearApp, crearEspacioDe, limpiarBd, prisma, quitarLicencia, registrar, type Cuenta } from './ayuda.js'
import { olvidarLicencia } from '../src/licencia/estado.js'

/**
 * Exportar. Lo importante: que siempre se pueda (los datos son del usuario) y
 * que un concepto malicioso no se convierta en una fórmula en el Excel de otro.
 */

let app: FastifyInstance
let yo: Cuenta

async function crearCuenta(datos: Record<string, unknown> = {}) {
  const r = await app.inject({
    method: 'POST',
    url: `/api/espacios/${yo.espacioPersonalId}/cuentas`,
    headers: { cookie: yo.cookie },
    payload: { nombre: 'Corriente', tipo: 'corriente', saldoInicial: 0, ...datos },
  })
  return (r.json() as { cuenta: { id: string } }).cuenta.id
}

async function apuntar(cuentaId: string, concepto: string, importe = -1000) {
  return app.inject({
    method: 'POST',
    url: `/api/espacios/${yo.espacioPersonalId}/movimientos`,
    headers: { cookie: yo.cookie },
    payload: { cuentaId, importe, fecha: '2026-08-10', concepto },
  })
}

beforeEach(async () => {
  await limpiarBd()
  app = await crearApp()
  yo = await registrar(app, 'yo@ejemplo.es')
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('inyección de fórmulas en el CSV', () => {
  it('un concepto que empieza por = se neutraliza para que Excel no lo ejecute', async () => {
    const cuentaId = await crearCuenta()
    // El clásico: al abrir el CSV, Excel ejecutaría esto.
    await apuntar(cuentaId, '=1+1')
    await apuntar(cuentaId, '=cmd|/c calc')
    await apuntar(cuentaId, '@SUM(A1:A9)')
    await apuntar(cuentaId, '-2+3')

    const csv = (await app.inject({
      method: 'GET',
      url: `/api/espacios/${yo.espacioPersonalId}/exportar.csv`,
      headers: { cookie: yo.cookie },
    })).body

    // Cada concepto peligroso va precedido de un apóstrofo: eso hace que Excel
    // lo trate como texto y no lo ejecute.
    expect(csv).toContain("'=1+1")
    expect(csv).toContain("'=cmd")
    expect(csv).toContain("'@SUM(A1:A9)")
    expect(csv).toContain("'-2+3")
    // Y la comprobación que de verdad importa: NINGÚN campo de ninguna fila
    // arranca por =, + o @ (con o sin comillas), que es lo que Excel ejecuta.
    for (const linea of csv.split('\r\n').slice(1).filter(Boolean)) {
      for (const campo of linea.split(';')) {
        expect(/^"?[=+@]/.test(campo)).toBe(false)
      }
    }
  })

  it('el importe negativo, que empieza por -, NO se toca: es un número legítimo', async () => {
    const cuentaId = await crearCuenta()
    await apuntar(cuentaId, 'Compra', -1234)
    const csv = (await app.inject({
      method: 'GET',
      url: `/api/espacios/${yo.espacioPersonalId}/exportar.csv`,
      headers: { cookie: yo.cookie },
    })).body
    expect(csv).toContain('-12,34')
    expect(csv).not.toContain("'-12,34")
  })
})

describe('exportar es un derecho, no un privilegio', () => {
  it('funciona aunque la cuenta esté en solo lectura por la licencia', async () => {
    const marta = await registrar(app, 'marta@ejemplo.es')
    const casa = await crearEspacioDe(app, yo)
    await app.inject({
      method: 'POST',
      url: `/api/espacios/${casa}/miembros`,
      headers: { cookie: yo.cookie },
      payload: { email: marta.email, rol: 'editor' },
    })

    await quitarLicencia()
    await prisma.usuario.updateMany({ data: { creadoEn: new Date('2026-12-01T00:00:00.000Z') } })
    olvidarLicencia()

    // Marta no puede escribir…
    const escribir = await app.inject({
      method: 'POST',
      url: `/api/espacios/${casa}/cuentas`,
      headers: { cookie: marta.cookie },
      payload: { nombre: 'x', tipo: 'corriente', saldoInicial: 0 },
    })
    expect(escribir.statusCode).toBe(403)

    // …pero sí exportar, en los dos formatos.
    for (const ruta of ['/exportar', '/exportar.csv']) {
      const r = await app.inject({
        method: 'GET',
        url: `/api/espacios/${casa}${ruta}`,
        headers: { cookie: marta.cookie },
      })
      expect(r.statusCode).toBe(200)
    }
  })
})
