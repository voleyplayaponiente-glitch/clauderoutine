import type { FastifyInstance } from 'fastify'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { crearApp, crearEspacioDe, limpiarBd, prisma, registrar, type Cuenta } from './ayuda.js'

/**
 * Espacios compartidos. Lo que se prueba aquí es lo que el dominio no puede:
 * que quien pagó salga del dueño de la cuenta, que un cierre congele el
 * periodo, y que compartir un gasto no abra la puerta a la cuenta privada de
 * nadie.
 */

let app: FastifyInstance
let ana: Cuenta
let luis: Cuenta
let casa: string

const hoy = () => new Date().toISOString().slice(0, 10)

async function crearCuenta(cuenta: Cuenta, datos: Record<string, unknown> = {}) {
  const respuesta = await app.inject({
    method: 'POST',
    url: `/api/espacios/${casa}/cuentas`,
    headers: { cookie: cuenta.cookie },
    payload: { nombre: 'Corriente', tipo: 'corriente', saldoInicial: 0, ...datos },
  })
  return (respuesta.json() as { cuenta: { id: string } }).cuenta.id
}

async function gastar(
  cuenta: Cuenta,
  cuentaId: string,
  importe: number,
  concepto: string,
  extra: Record<string, unknown> = {},
) {
  const respuesta = await app.inject({
    method: 'POST',
    url: `/api/espacios/${casa}/movimientos`,
    headers: { cookie: cuenta.cookie },
    payload: { cuentaId, importe, fecha: hoy(), concepto, esCompartido: true, ...extra },
  })
  if (respuesta.statusCode !== 201) throw new Error(`No se creó el movimiento: ${respuesta.body}`)
  return (respuesta.json() as { movimiento: { id: string } }).movimiento.id
}

async function laCuenta(cuenta: Cuenta = ana) {
  return app.inject({ method: 'GET', url: `/api/espacios/${casa}/cuenta`, headers: { cookie: cuenta.cookie } })
}

async function crearReparto(datos: Record<string, unknown>) {
  const respuesta = await app.inject({
    method: 'POST',
    url: `/api/espacios/${casa}/repartos`,
    headers: { cookie: ana.cookie },
    payload: { nombre: 'Común', tipo: 'mitades', ...datos },
  })
  if (respuesta.statusCode !== 201) throw new Error(`No se creó el reparto: ${respuesta.body}`)
  return (respuesta.json() as { reparto: { id: string } }).reparto.id
}

beforeEach(async () => {
  await limpiarBd()
  app = await crearApp()
  ana = await registrar(app, 'ana@ejemplo.es', undefined, 'Ana')
  luis = await registrar(app, 'luis@ejemplo.es', undefined, 'Luis')
  casa = await crearEspacioDe(app, ana)
  await app.inject({
    method: 'POST',
    url: `/api/espacios/${casa}/miembros`,
    headers: { cookie: ana.cookie },
    payload: { email: luis.email, rol: 'editor' },
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('la cuenta del periodo', () => {
  it('quien pagó sale del dueño de la cuenta, no de un campo que rellenar', async () => {
    await crearReparto({ partes: [{ usuarioId: ana.usuarioId }, { usuarioId: luis.usuarioId }] })
    const deAna = await crearCuenta(ana, { nombre: 'La de Ana' })
    await gastar(ana, deAna, -90_000, 'Alquiler')

    const cuenta = (await laCuenta()).json()
    expect(cuenta.gastos[0].pagadoPor).toBe(ana.usuarioId)
    expect(cuenta.gastos[0].pagadoPorNombre).toBe('Ana')
    expect(cuenta.pagos).toEqual([
      expect.objectContaining({
        deUsuarioId: luis.usuarioId,
        aUsuarioId: ana.usuarioId,
        importe: 45_000,
        deNombre: 'Luis',
        aNombre: 'Ana',
      }),
    ])
  })

  it('un gasto sin reparto no se parte a medias por su cuenta: se aparta y se dice', async () => {
    await crearReparto({ nombre: 'Uno', partes: [{ usuarioId: ana.usuarioId }] })
    await crearReparto({ nombre: 'Otro', partes: [{ usuarioId: luis.usuarioId }] })
    const deAna = await crearCuenta(ana)
    await gastar(ana, deAna, -50_000, 'Sin regla')

    const cuenta = (await laCuenta()).json()
    expect(cuenta.gastos).toHaveLength(0)
    expect(cuenta.sinReparto).toEqual([expect.objectContaining({ concepto: 'Sin regla', importe: 50_000 })])
    expect(cuenta.pagos).toEqual([])
  })

  it('lo que NO está marcado como compartido no entra', async () => {
    await crearReparto({ partes: [{ usuarioId: ana.usuarioId }, { usuarioId: luis.usuarioId }] })
    const deAna = await crearCuenta(ana)
    await gastar(ana, deAna, -30_000, 'Mío', { esCompartido: false })

    expect((await laCuenta()).json().total).toBe(0)
  })

  it('un gasto compartido de una cuenta privada entra, pero SIN decir de qué cuenta salió', async () => {
    await crearReparto({ partes: [{ usuarioId: ana.usuarioId }, { usuarioId: luis.usuarioId }] })
    const privada = await crearCuenta(ana, { nombre: 'La secreta de Ana', visibleEnEspacio: false })
    await gastar(ana, privada, -20_000, 'Regalo común')

    // Luis no ve el movimiento en la lista —la cuenta es privada—…
    const movimientos = await app.inject({
      method: 'GET',
      url: `/api/espacios/${casa}/movimientos`,
      headers: { cookie: luis.cookie },
    })
    expect(movimientos.json().movimientos).toHaveLength(0)

    // …pero sí ve que le deben 100 €, porque si no no podría estar de acuerdo.
    const cuenta = (await laCuenta(luis)).json()
    expect(cuenta.gastos).toEqual([
      expect.objectContaining({ concepto: 'Regalo común', importe: 20_000 }),
    ])
    expect(JSON.stringify(cuenta)).not.toContain('La secreta de Ana')
    expect(cuenta.gastos[0]).not.toHaveProperty('cuentaId')
  })

  it('reparte en proporción a lo que cada uno ha ingresado ese mes', async () => {
    const categoria = await prisma.categoria.findFirst({
      where: { espacioId: casa, flujo: 'ingreso' },
    })
    const deAna = await crearCuenta(ana, { nombre: 'Ana' })
    const deLuis = await crearCuenta(luis, { nombre: 'Luis' })

    for (const [cuenta, cuentaId, importe] of [
      [ana, deAna, 240_000],
      [luis, deLuis, 160_000],
    ] as const) {
      await app.inject({
        method: 'POST',
        url: `/api/espacios/${casa}/movimientos`,
        headers: { cookie: cuenta.cookie },
        payload: { cuentaId, importe, fecha: hoy(), concepto: 'Nómina', categoriaId: categoria!.id },
      })
    }

    await crearReparto({
      tipo: 'proporcional_ingresos',
      partes: [{ usuarioId: ana.usuarioId }, { usuarioId: luis.usuarioId }],
    })
    await gastar(ana, deAna, -100_000, 'Alquiler')

    const cuenta = (await laCuenta()).json()
    // Ana debía 60.000 de 100.000 y puso los 100.000 → le deben 40.000.
    expect(cuenta.saldos.find((s: { usuarioId: string }) => s.usuarioId === ana.usuarioId).saldo).toBe(40_000)
  })
})

describe('cerrar el periodo', () => {
  it('congela los pagos y deja de contar lo anterior', async () => {
    await crearReparto({ partes: [{ usuarioId: ana.usuarioId }, { usuarioId: luis.usuarioId }] })
    const deAna = await crearCuenta(ana)
    await gastar(ana, deAna, -90_000, 'Alquiler')

    const cierre = await app.inject({
      method: 'POST',
      url: `/api/espacios/${casa}/liquidaciones`,
      headers: { cookie: ana.cookie },
      payload: {},
    })
    expect(cierre.statusCode).toBe(201)

    // Cerrado: la cuenta en curso vuelve a cero, sin haber tocado el gasto.
    await app.inject({
      method: 'POST',
      url: `/api/espacios/${casa}/liquidaciones/${cierre.json().liquidacion.id}/saldar`,
      headers: { cookie: ana.cookie },
    })
    // Lo recién liquidado desaparece en silencio: enseñarlo bajo un aviso de
    // «no entra en esta cuenta» asustaba justo después de haberlo pagado.
    const despues = (await laCuenta()).json()
    expect(despues.pagos).toEqual([])
    expect(despues.gastos).toHaveLength(0)
    expect(despues.tardios).toHaveLength(0)

    const historial = (await app.inject({
      method: 'GET',
      url: `/api/espacios/${casa}/liquidaciones`,
      headers: { cookie: luis.cookie },
    })).json()
    expect(historial.liquidaciones[0].estado).toBe('saldada')
    expect(historial.liquidaciones[0].pagos[0].importe).toBe(45_000)
  })

  it('un gasto apuntado DESPUÉS del cierre, con fecha de antes, sí se avisa', async () => {
    await crearReparto({ partes: [{ usuarioId: ana.usuarioId }, { usuarioId: luis.usuarioId }] })
    const deAna = await crearCuenta(ana)
    await gastar(ana, deAna, -90_000, 'Alquiler')

    const cierre = await app.inject({
      method: 'POST', url: `/api/espacios/${casa}/liquidaciones`,
      headers: { cookie: ana.cookie }, payload: {},
    })
    await app.inject({
      method: 'POST',
      url: `/api/espacios/${casa}/liquidaciones/${cierre.json().liquidacion.id}/saldar`,
      headers: { cookie: ana.cookie },
    })

    // El ticket que aparece en el bolsillo una semana después.
    const ayer = new Date()
    ayer.setDate(ayer.getDate() - 1)
    await gastar(ana, deAna, -3_000, 'Ticket olvidado', { fecha: ayer.toISOString().slice(0, 10) })

    const despues = (await laCuenta()).json()
    expect(despues.tardios).toEqual([expect.objectContaining({ concepto: 'Ticket olvidado' })])
    expect(despues.gastos).toHaveLength(0)
  })

  it('no se cierra dos veces sin haber saldado el anterior', async () => {
    await crearReparto({ partes: [{ usuarioId: ana.usuarioId }, { usuarioId: luis.usuarioId }] })
    const deAna = await crearCuenta(ana)
    await gastar(ana, deAna, -90_000, 'Alquiler')

    const uno = await app.inject({
      method: 'POST', url: `/api/espacios/${casa}/liquidaciones`,
      headers: { cookie: ana.cookie }, payload: {},
    })
    expect(uno.statusCode).toBe(201)

    const dos = await app.inject({
      method: 'POST', url: `/api/espacios/${casa}/liquidaciones`,
      headers: { cookie: ana.cookie }, payload: {},
    })
    expect(dos.statusCode).toBe(409)
  })

  it('no cierra cuando no hay nada que liquidar', async () => {
    const respuesta = await app.inject({
      method: 'POST', url: `/api/espacios/${casa}/liquidaciones`,
      headers: { cookie: ana.cookie }, payload: {},
    })
    expect(respuesta.statusCode).toBe(409)
    expect(respuesta.json().error.mensaje).toMatch(/ya están a cero/i)
  })
})

describe('quién puede tocar qué', () => {
  it('un extraño no ve la cuenta del espacio, y se le dice que no existe', async () => {
    const extrana = await registrar(app, 'extrana@ejemplo.es')
    const respuesta = await app.inject({
      method: 'GET', url: `/api/espacios/${casa}/cuenta`, headers: { cookie: extrana.cookie },
    })
    expect(respuesta.statusCode).toBe(404)
  })

  it('un lector no crea repartos ni cierra periodos', async () => {
    const sara = await registrar(app, 'sara@ejemplo.es')
    await app.inject({
      method: 'POST', url: `/api/espacios/${casa}/miembros`,
      headers: { cookie: ana.cookie }, payload: { email: sara.email, rol: 'lector' },
    })

    const reparto = await app.inject({
      method: 'POST', url: `/api/espacios/${casa}/repartos`,
      headers: { cookie: sara.cookie },
      payload: { nombre: 'Mío', tipo: 'mitades', partes: [{ usuarioId: sara.usuarioId }] },
    })
    expect(reparto.statusCode).toBe(403)
  })

  it('un reparto no puede nombrar a alguien de fuera del espacio', async () => {
    const fuera = await registrar(app, 'fuera@ejemplo.es')
    const respuesta = await app.inject({
      method: 'POST', url: `/api/espacios/${casa}/repartos`,
      headers: { cookie: ana.cookie },
      payload: { nombre: 'Colado', tipo: 'mitades', partes: [{ usuarioId: fuera.usuarioId }] },
    })
    expect(respuesta.statusCode).toBe(400)
  })
})

describe('modo negocio', () => {
  let negocio: string

  beforeEach(async () => {
    negocio = await crearEspacioDe(app, ana, 'La empresa', 'negocio')
    await app.inject({
      method: 'POST', url: `/api/espacios/${negocio}/miembros`,
      headers: { cookie: ana.cookie }, payload: { email: luis.email, rol: 'editor' },
    })
  })

  it('las participaciones tienen que sumar 100', async () => {
    const mal = await app.inject({
      method: 'PATCH', url: `/api/espacios/${negocio}/participaciones`,
      headers: { cookie: ana.cookie },
      payload: {
        participaciones: [
          { usuarioId: ana.usuarioId, participacion: 60 },
          { usuarioId: luis.usuarioId, participacion: 30 },
        ],
      },
    })
    expect(mal.statusCode).toBe(400)
    expect(mal.json().error.mensaje).toMatch(/100 %/)
  })

  it('lleva la cuenta corriente de cada socio', async () => {
    await app.inject({
      method: 'PATCH', url: `/api/espacios/${negocio}/participaciones`,
      headers: { cookie: ana.cookie },
      payload: {
        participaciones: [
          { usuarioId: ana.usuarioId, participacion: 60 },
          { usuarioId: luis.usuarioId, participacion: 40 },
        ],
      },
    })
    await app.inject({
      method: 'POST', url: `/api/espacios/${negocio}/negocio/capital`,
      headers: { cookie: ana.cookie },
      payload: { usuarioId: ana.usuarioId, tipo: 'aportacion', importe: 3_000_000, fecha: hoy() },
    })

    const negocioJson = (await app.inject({
      method: 'GET', url: `/api/espacios/${negocio}/negocio`, headers: { cookie: luis.cookie },
    })).json()

    const deAna = negocioJson.socios.find((s: { usuarioId: string }) => s.usuarioId === ana.usuarioId)
    expect(deAna.aportado).toBe(3_000_000)
    expect(deAna.participacion).toBe(60)
    expect(negocioJson.aviso).toBeNull()
  })

  it('un espacio que no es un negocio no tiene pantalla de negocio', async () => {
    const respuesta = await app.inject({
      method: 'GET', url: `/api/espacios/${casa}/negocio`, headers: { cookie: ana.cookie },
    })
    expect(respuesta.statusCode).toBe(404)
  })

  it('cambiar participaciones no es cosa de un editor', async () => {
    const respuesta = await app.inject({
      method: 'PATCH', url: `/api/espacios/${negocio}/participaciones`,
      headers: { cookie: luis.cookie },
      payload: {
        participaciones: [
          { usuarioId: ana.usuarioId, participacion: 50 },
          { usuarioId: luis.usuarioId, participacion: 50 },
        ],
      },
    })
    expect(respuesta.statusCode).toBe(403)
  })
})
