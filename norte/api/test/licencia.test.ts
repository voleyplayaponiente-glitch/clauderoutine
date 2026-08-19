import type { FastifyInstance } from 'fastify'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  claveDePrueba,
  crearApp,
  crearEspacioDe,
  limpiarBd,
  prisma,
  quitarLicencia,
  registrar,
  type Cuenta,
} from './ayuda.js'
import { olvidarLicencia } from '../src/licencia/estado.js'

/**
 * La licencia. Lo que se prueba aquí es lo único que importa de verdad de un
 * licenciamiento: que **cierra la escritura y nunca la puerta**.
 */

let app: FastifyInstance
let julio: Cuenta

/**
 * Los usuarios que crean los tests nacen con la fecha de hoy, que hasta el
 * 20/08/2026 cae dentro de la cláusula de anterioridad. Para probar los
 * límites hace falta gente «nueva», así que se les envejece la fecha al revés:
 * se les pone una fecha posterior a la frontera.
 */
async function comoRecienLlegado(usuarioId: string) {
  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { creadoEn: new Date('2026-12-01T00:00:00.000Z') },
  })
  olvidarLicencia()
}

beforeEach(async () => {
  await limpiarBd()
  app = await crearApp()
  julio = await registrar(app, 'julio@ejemplo.es')
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('sin licencia', () => {
  it('el dueño usa Norte entero', async () => {
    await quitarLicencia()
    await comoRecienLlegado(julio.usuarioId)

    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/espacios/${julio.espacioPersonalId}/cuentas`,
      headers: { cookie: julio.cookie },
      payload: { nombre: 'Corriente', tipo: 'corriente', saldoInicial: 0 },
    })
    expect(respuesta.statusCode).toBe(201)
  })

  it('la segunda persona puede LEER y EXPORTAR, pero no apuntar', async () => {
    const marta = await registrar(app, 'marta@ejemplo.es')
    const casa = await crearEspacioDe(app, julio)
    await app.inject({
      method: 'POST',
      url: `/api/espacios/${casa}/miembros`,
      headers: { cookie: julio.cookie },
      payload: { email: marta.email, rol: 'editor' },
    })

    await quitarLicencia()
    await comoRecienLlegado(julio.usuarioId)
    await comoRecienLlegado(marta.usuarioId)

    const escribir = await app.inject({
      method: 'POST',
      url: `/api/espacios/${casa}/cuentas`,
      headers: { cookie: marta.cookie },
      payload: { nombre: 'Suya', tipo: 'corriente', saldoInicial: 0 },
    })
    expect(escribir.statusCode).toBe(403)
    expect(escribir.json().error.mensaje).toMatch(/solo lectura/i)

    // Y esto es lo que hace que no sea un secuestro:
    const leer = await app.inject({
      method: 'GET',
      url: `/api/espacios/${casa}/movimientos`,
      headers: { cookie: marta.cookie },
    })
    expect(leer.statusCode).toBe(200)

    const exportar = await app.inject({
      method: 'GET',
      url: `/api/espacios/${casa}/exportar`,
      headers: { cookie: marta.cookie },
    })
    expect(exportar.statusCode).toBe(200)
  })

  it('el dueño nunca se queda sin escribir, aunque sobre gente', async () => {
    const marta = await registrar(app, 'marta@ejemplo.es')
    await quitarLicencia()
    await comoRecienLlegado(julio.usuarioId)
    await comoRecienLlegado(marta.usuarioId)

    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/espacios/${julio.espacioPersonalId}/cuentas`,
      headers: { cookie: julio.cookie },
      payload: { nombre: 'Corriente', tipo: 'corriente', saldoInicial: 0 },
    })
    expect(respuesta.statusCode).toBe(201)
  })
})

describe('pegar una clave', () => {
  it('una clave buena amplía el cupo en el acto', async () => {
    const marta = await registrar(app, 'marta@ejemplo.es')
    await quitarLicencia()
    await comoRecienLlegado(julio.usuarioId)
    await comoRecienLlegado(marta.usuarioId)

    const antes = await app.inject({
      method: 'POST',
      url: `/api/espacios/${julio.espacioPersonalId}/cuentas`,
      headers: { cookie: marta.cookie },
      payload: { nombre: 'x', tipo: 'corriente', saldoInicial: 0 },
    })
    // 404 porque el espacio personal de Julio no es suyo; lo que importa es el
    // caso siguiente, en el que sí es miembro.
    expect([403, 404]).toContain(antes.statusCode)

    const puesta = await app.inject({
      method: 'POST',
      url: '/api/licencia',
      headers: { cookie: julio.cookie },
      payload: { clave: claveDePrueba({ plan: 'pareja', maxUsuarios: 2 }) },
    })
    expect(puesta.statusCode).toBe(200)
    expect(puesta.json().estado.valida).toBe(true)
    expect(puesta.json().estado.soloLectura).toEqual([])
  })

  it('una clave inventada se rechaza, y una manipulada también', async () => {
    const buena = claveDePrueba({ maxUsuarios: 2 })
    const manipulada = buena.replace(/\.[^.]+$/, '.ZmlybWFmYWxzYQ')

    for (const clave of ['NORTE-1.aaa.bbb', 'cualquier cosa', manipulada]) {
      const respuesta = await app.inject({
        method: 'POST',
        url: '/api/licencia',
        headers: { cookie: julio.cookie },
        payload: { clave },
      })
      expect(respuesta.statusCode).toBe(400)
    }
  })

  it('una licencia caducada no amplía nada', async () => {
    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/licencia',
      headers: { cookie: julio.cookie },
      payload: { clave: claveDePrueba({ caducaEn: '2020-01-01', maxUsuarios: 50 }) },
    })
    expect(respuesta.statusCode).toBe(200)
    expect(respuesta.json().estado.valida).toBe(false)
    expect(respuesta.json().estado.maxUsuarios).toBe(1)
  })

  it('solo el dueño de la instalación puede cambiarla', async () => {
    const marta = await registrar(app, 'marta@ejemplo.es')
    const respuesta = await app.inject({
      method: 'POST',
      url: '/api/licencia',
      headers: { cookie: marta.cookie },
      payload: { clave: claveDePrueba() },
    })
    expect(respuesta.statusCode).toBe(403)
  })

  it('cualquiera puede ver en qué estado está: tiene derecho a saber por qué', async () => {
    const marta = await registrar(app, 'marta@ejemplo.es')
    const respuesta = await app.inject({
      method: 'GET',
      url: '/api/licencia',
      headers: { cookie: marta.cookie },
    })
    expect(respuesta.statusCode).toBe(200)
    expect(respuesta.json().soyElDueno).toBe(false)
    // La clave no viaja al navegador.
    expect(JSON.stringify(respuesta.json())).not.toContain('NORTE-1.')
  })
})

describe('quien ya estaba', () => {
  it('sigue escribiendo aunque no haya licencia', async () => {
    const marta = await registrar(app, 'marta@ejemplo.es')
    const casa = await crearEspacioDe(app, julio)
    await app.inject({
      method: 'POST',
      url: `/api/espacios/${casa}/miembros`,
      headers: { cookie: julio.cookie },
      payload: { email: marta.email, rol: 'editor' },
    })

    await quitarLicencia()
    // Las dos cuentas son anteriores a la frontera de anterioridad.
    await prisma.usuario.updateMany({ data: { creadoEn: new Date('2026-08-01T00:00:00.000Z') } })
    olvidarLicencia()

    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/espacios/${casa}/cuentas`,
      headers: { cookie: marta.cookie },
      payload: { nombre: 'Suya', tipo: 'corriente', saldoInicial: 0 },
    })
    expect(respuesta.statusCode).toBe(201)
  })
})
