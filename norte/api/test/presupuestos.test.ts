import type { FastifyInstance } from 'fastify'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { crearApp, crearEspacioDe, limpiarBd, prisma, registrar, type Cuenta } from './ayuda.js'

/**
 * El presupuesto por sobres de punta a punta.
 *
 * Lo que se prueba aquí y no en el dominio: que las cuentas salen de los
 * movimientos de verdad, que el ingreso no se infla con traspasos, y que en un
 * espacio compartido el presupuesto no enseña el gasto de una cuenta privada
 * ajena.
 */

const MES = '2026-08'

let app: FastifyInstance
let yo: Cuenta
let espacioId: string
let cuentaId: string
let categorias: Record<string, string>

async function crearCuenta(espacio: string, cookie: string, nombre = 'Corriente', visible = true) {
  const respuesta = await app.inject({
    method: 'POST',
    url: `/api/espacios/${espacio}/cuentas`,
    headers: { cookie },
    payload: { nombre, tipo: 'corriente', saldoInicial: 0, visibleEnEspacio: visible },
  })
  return (respuesta.json() as { cuenta: { id: string } }).cuenta.id
}

async function apuntar(
  espacio: string,
  cookie: string,
  datos: { cuentaId: string; importe: number; fecha: string; concepto: string; categoriaId?: string; estado?: string },
) {
  return app.inject({
    method: 'POST',
    url: `/api/espacios/${espacio}/movimientos`,
    headers: { cookie },
    payload: datos,
  })
}

async function presupuesto(espacio: string, cookie: string, mes = MES) {
  const respuesta = await app.inject({
    method: 'GET',
    url: `/api/espacios/${espacio}/presupuesto?mes=${mes}`,
    headers: { cookie },
  })
  return respuesta.json()
}

function sobreDe(cuerpo: { sobres: { categoria: string }[] }, nombre: string) {
  return cuerpo.sobres.find((s) => s.categoria === nombre)
}

beforeEach(async () => {
  await limpiarBd()
  app = await crearApp()
  yo = await registrar(app, 'yo@ejemplo.es')
  espacioId = yo.espacioPersonalId
  cuentaId = await crearCuenta(espacioId, yo.cookie)

  const lista = await app.inject({
    method: 'GET',
    url: `/api/espacios/${espacioId}/categorias`,
    headers: { cookie: yo.cookie },
  })
  categorias = Object.fromEntries(
    (lista.json() as { categorias: { id: string; nombre: string }[] }).categorias.map((c) => [
      c.nombre,
      c.id,
    ]),
  )
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('ver el mes', () => {
  it('sin asignar nada, todos los sobres salen a cero y ninguno miente', async () => {
    const cuerpo = await presupuesto(espacioId, yo.cookie)
    expect(cuerpo.sobres.length).toBeGreaterThan(10)
    expect(cuerpo.resumen.asignado).toBe(0)
    expect(cuerpo.sobres.every((s: { asignado: number }) => s.asignado === 0)).toBe(true)
  })

  it('el gasto de cada sobre sale de los movimientos, no de una copia guardada', async () => {
    await apuntar(espacioId, yo.cookie, {
      cuentaId,
      importe: -6120,
      fecha: '2026-08-03',
      concepto: 'Súper',
      categoriaId: categorias['Alimentación'],
    })
    await app.inject({
      method: 'PUT',
      url: `/api/espacios/${espacioId}/presupuesto/lineas/${categorias['Alimentación']}?mes=${MES}`,
      headers: { cookie: yo.cookie },
      payload: { asignado: 40000 },
    })

    const sobre = sobreDe(await presupuesto(espacioId, yo.cookie), 'Alimentación')
    // El signo se le da la vuelta: gastar 61,20 € son 6.120 en el sobre.
    expect(sobre).toMatchObject({ asignado: 40000, gastado: 6120, disponible: 33880 })
  })

  it('lo previsto va aparte de lo gastado', async () => {
    await apuntar(espacioId, yo.cookie, {
      cuentaId,
      importe: -25000,
      fecha: '2026-08-28',
      concepto: 'Recibo de la luz',
      categoriaId: categorias['Suministros'],
      estado: 'previsto',
    })
    const sobre = sobreDe(await presupuesto(espacioId, yo.cookie), 'Suministros')
    expect(sobre).toMatchObject({ gastado: 0, previsto: 25000 })
  })

  it('lo que no está clasificado se enseña, no se esconde', async () => {
    await apuntar(espacioId, yo.cookie, {
      cuentaId,
      importe: -3000,
      fecha: '2026-08-05',
      concepto: 'Algo sin clasificar',
    })
    const cuerpo = await presupuesto(espacioId, yo.cookie)
    expect(cuerpo.sinClasificar.gastado).toBe(3000)
  })
})

describe('los ingresos del mes', () => {
  it('solo cuentan los clasificados como ingreso', async () => {
    await apuntar(espacioId, yo.cookie, {
      cuentaId,
      importe: 244360,
      fecha: '2026-08-01',
      concepto: 'Nómina',
      categoriaId: categorias['Nómina'] ?? categorias['Salario'] ?? categorias['Ingresos'],
    })
    const cuerpo = await presupuesto(espacioId, yo.cookie)
    expect(cuerpo.ingresos.total).toBe(244360)
  })

  it('un traspaso entre cuentas propias NO infla el presupuesto', async () => {
    // Es el caso del extracto real: 5.000 € que entran de otra cuenta suya.
    // Contarlos daría un presupuesto con miles de euros que no existen.
    await apuntar(espacioId, yo.cookie, {
      cuentaId,
      importe: 500000,
      fecha: '2026-08-05',
      concepto: 'Transferencia de mi otra cuenta',
    })
    const cuerpo = await presupuesto(espacioId, yo.cookie)
    expect(cuerpo.ingresos.total).toBe(0)
  })
})

describe('asignar', () => {
  it('rechaza asignar a una categoría de otro espacio', async () => {
    const otra = await registrar(app, 'otra@ejemplo.es')
    const suyas = await app.inject({
      method: 'GET',
      url: `/api/espacios/${otra.espacioPersonalId}/categorias`,
      headers: { cookie: otra.cookie },
    })
    const ajena = (suyas.json() as { categorias: { id: string }[] }).categorias[0]!.id

    const respuesta = await app.inject({
      method: 'PUT',
      url: `/api/espacios/${espacioId}/presupuesto/lineas/${ajena}?mes=${MES}`,
      headers: { cookie: yo.cookie },
      payload: { asignado: 1000 },
    })
    expect(respuesta.statusCode).toBe(404)
  })

  it('quien solo lee no asigna', async () => {
    const compartido = await crearEspacioDe(app, yo, 'Casa')
    const otra = await registrar(app, 'otra@ejemplo.es')
    await prisma.miembroEspacio.create({
      data: { espacioId: compartido, usuarioId: otra.usuarioId, rol: 'lector' },
    })
    const categoria = await prisma.categoria.findFirstOrThrow({
      where: { espacioId: compartido, flujo: 'gasto' },
    })
    const respuesta = await app.inject({
      method: 'PUT',
      url: `/api/espacios/${compartido}/presupuesto/lineas/${categoria.id}?mes=${MES}`,
      headers: { cookie: otra.cookie },
      payload: { asignado: 1000 },
    })
    expect(respuesta.statusCode).toBe(403)
  })

  it('aplica una tanda de asignaciones de golpe', async () => {
    const respuesta = await app.inject({
      method: 'PUT',
      url: `/api/espacios/${espacioId}/presupuesto/lineas?mes=${MES}`,
      headers: { cookie: yo.cookie },
      payload: {
        lineas: [
          { categoriaId: categorias['Alimentación'], asignado: 40000, rollover: true },
          { categoriaId: categorias['Suministros'], asignado: 15000 },
        ],
      },
    })
    expect(respuesta.statusCode).toBe(200)
    expect(respuesta.json().resumen.asignado).toBe(55000)
  })
})

describe('la propuesta del mes siguiente', () => {
  it('sale del gasto real de los meses anteriores', async () => {
    for (const [mes, importe] of [
      ['2026-05-10', -9000],
      ['2026-06-10', -9500],
      ['2026-07-10', -62000],
    ] as const) {
      await apuntar(espacioId, yo.cookie, {
        cuentaId,
        importe,
        fecha: mes,
        concepto: 'Transporte',
        categoriaId: categorias['Transporte'],
      })
    }

    const respuesta = await app.inject({
      method: 'GET',
      url: `/api/espacios/${espacioId}/presupuesto/propuesta?mes=${MES}`,
      headers: { cookie: yo.cookie },
    })
    const propuesta = (respuesta.json() as { propuestas: { categoriaId: string; propuesto: number; base: string }[] })
      .propuestas.find((p) => p.categoriaId === categorias['Transporte'])
    // Mediana de 90, 95 y 620: la revisión del coche no manda.
    expect(propuesta).toMatchObject({ propuesto: 9500, base: 'mediana' })
  })
})

describe('cerrar el mes', () => {
  it('arrastra lo que sobra al mes siguiente solo donde está activado', async () => {
    await app.inject({
      method: 'PUT',
      url: `/api/espacios/${espacioId}/presupuesto/lineas?mes=${MES}`,
      headers: { cookie: yo.cookie },
      payload: {
        lineas: [
          { categoriaId: categorias['Alimentación'], asignado: 40000, rollover: true },
          { categoriaId: categorias['Ocio'], asignado: 10000, rollover: false },
        ],
      },
    })
    await apuntar(espacioId, yo.cookie, {
      cuentaId,
      importe: -30000,
      fecha: '2026-08-10',
      concepto: 'Compra',
      categoriaId: categorias['Alimentación'],
    })

    const cierre = await app.inject({
      method: 'POST',
      url: `/api/espacios/${espacioId}/presupuesto/cerrar?mes=${MES}`,
      headers: { cookie: yo.cookie },
    })
    expect(cierre.json()).toMatchObject({ siguiente: '2026-09', arrastrados: 1 })

    const septiembre = await presupuesto(espacioId, yo.cookie, '2026-09')
    expect(sobreDe(septiembre, 'Alimentación')!.arrastrado).toBe(10000)
    expect(sobreDe(septiembre, 'Ocio')!.arrastrado).toBe(0)
    expect((await presupuesto(espacioId, yo.cookie)).cerrado).toBe(true)
  })

  it('arrastra también lo que se ha pasado', async () => {
    await app.inject({
      method: 'PUT',
      url: `/api/espacios/${espacioId}/presupuesto/lineas?mes=${MES}`,
      headers: { cookie: yo.cookie },
      payload: { lineas: [{ categoriaId: categorias['Ocio'], asignado: 10000, rollover: true }] },
    })
    await apuntar(espacioId, yo.cookie, {
      cuentaId,
      importe: -18000,
      fecha: '2026-08-12',
      concepto: 'Cenas',
      categoriaId: categorias['Ocio'],
    })
    await app.inject({
      method: 'POST',
      url: `/api/espacios/${espacioId}/presupuesto/cerrar?mes=${MES}`,
      headers: { cookie: yo.cookie },
    })

    const septiembre = await presupuesto(espacioId, yo.cookie, '2026-09')
    expect(sobreDe(septiembre, 'Ocio')!.arrastrado).toBe(-8000)
  })
})

describe('en un espacio compartido', () => {
  it('el presupuesto no enseña el gasto de la cuenta privada de otro', async () => {
    const compartido = await crearEspacioDe(app, yo, 'Casa')
    const otra = await registrar(app, 'otra@ejemplo.es')
    await prisma.miembroEspacio.create({
      data: { espacioId: compartido, usuarioId: otra.usuarioId, rol: 'editor' },
    })

    const privada = await crearCuenta(compartido, yo.cookie, 'Mi cuenta privada', false)
    const categoria = await prisma.categoria.findFirstOrThrow({
      where: { espacioId: compartido, flujo: 'gasto', nombre: 'Ocio' },
    })
    await apuntar(compartido, yo.cookie, {
      cuentaId: privada,
      importe: -5000,
      fecha: '2026-08-04',
      concepto: 'Un capricho',
      categoriaId: categoria.id,
    })

    const mio = await presupuesto(compartido, yo.cookie)
    const suyo = await presupuesto(compartido, otra.cookie)
    expect(sobreDe(mio, 'Ocio')!.gastado).toBe(5000)
    expect(sobreDe(suyo, 'Ocio')!.gastado).toBe(0)
  })
})
