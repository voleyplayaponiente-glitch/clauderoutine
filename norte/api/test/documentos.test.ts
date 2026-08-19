import type { FastifyInstance } from 'fastify'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { crearApp, limpiarBd, prisma, registrar, type Cuenta } from './ayuda.js'

/**
 * La bandeja de entrada, de punta a punta: subir, revisar y aplicar.
 *
 * Los ficheros se construyen aquí, en texto, porque lo que se prueba en este
 * nivel es el camino —permisos, duplicados, qué acaba en la base— y no la
 * lectura de cada formato, que tiene sus propias pruebas en el dominio.
 */

const CSV = `Fecha;Concepto;Importe;Saldo
01/08/2026;Recibo de la luz;-61,20;1.000,00
03/08/2026;Nómina;1.850,00;2.850,00
05/08/2026;Compra 4532 0151 1283 0366 en el súper;-42,35;2.807,65
`

let app: FastifyInstance
let yo: Cuenta
let cuentaId: string

async function subir(espacioId: string, cookie: string, nombre: string, contenido: string) {
  const limite = '----norte'
  const cuerpo = [
    `--${limite}`,
    `Content-Disposition: form-data; name="fichero"; filename="${nombre}"`,
    'Content-Type: text/csv',
    '',
    contenido,
    `--${limite}--`,
    '',
  ].join('\r\n')

  return app.inject({
    method: 'POST',
    url: `/api/espacios/${espacioId}/documentos`,
    headers: { cookie, 'content-type': `multipart/form-data; boundary=${limite}` },
    payload: cuerpo,
  })
}

beforeEach(async () => {
  await limpiarBd()
  app = await crearApp()
  yo = await registrar(app, 'yo@ejemplo.es')
  const respuesta = await app.inject({
    method: 'POST',
    url: `/api/espacios/${yo.espacioPersonalId}/cuentas`,
    headers: { cookie: yo.cookie },
    payload: { nombre: 'Corriente', tipo: 'corriente', saldoInicial: 0 },
  })
  cuentaId = (respuesta.json() as { cuenta: { id: string } }).cuenta.id
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('subir un documento', () => {
  it('lo guarda en revisión sin tocar ningún saldo', async () => {
    const respuesta = await subir(yo.espacioPersonalId, yo.cookie, 'extracto.csv', CSV)
    expect(respuesta.statusCode).toBe(201)
    const { documento } = respuesta.json() as { documento: { estado: string; tipo: string } }
    expect(documento.estado).toBe('revision')
    expect(documento.tipo).toBe('extracto_banco')

    // Lo importante de esta prueba: subir no crea movimientos.
    expect(await prisma.movimiento.count()).toBe(0)
  })

  it('rechaza un tipo de fichero que no sabe leer', async () => {
    const respuesta = await subir(yo.espacioPersonalId, yo.cookie, 'foto.jpg', 'no importa')
    expect(respuesta.statusCode).toBe(400)
    expect(respuesta.json().error.mensaje).toMatch(/Admito/)
  })

  it('avisa cuando es exactamente el mismo fichero que ya estaba', async () => {
    await subir(yo.espacioPersonalId, yo.cookie, 'extracto.csv', CSV)
    const segunda = await subir(yo.espacioPersonalId, yo.cookie, 'otro-nombre.csv', CSV)
    expect(segunda.statusCode).toBe(409)
    expect(segunda.json().error.mensaje).toMatch(/ya lo subiste/i)
  })

  it('no deja subir a quien solo puede leer', async () => {
    const otra = await registrar(app, 'otra@ejemplo.es')
    const respuesta = await subir(otra.espacioPersonalId, yo.cookie, 'extracto.csv', CSV)
    // 404 y no 403: confirmar que el espacio existe ya sería contar de más.
    expect(respuesta.statusCode).toBe(404)
  })
})

describe('revisar y aplicar', () => {
  async function subirYLeer() {
    const subida = await subir(yo.espacioPersonalId, yo.cookie, 'extracto.csv', CSV)
    const { documento } = subida.json() as { documento: { id: string } }
    const lectura = await app.inject({
      method: 'GET',
      url: `/api/espacios/${yo.espacioPersonalId}/documentos/${documento.id}/lectura`,
      headers: { cookie: yo.cookie },
    })
    return { documentoId: documento.id, cuerpo: lectura.json() }
  }

  it('devuelve los apuntes leídos con la tarjeta ya tapada', async () => {
    const { cuerpo } = await subirYLeer()
    expect(cuerpo.apuntes).toHaveLength(3)
    expect(cuerpo.apuntes.map((a: { importe: number }) => a.importe)).toEqual([-6120, 185000, -4235])
    expect(cuerpo.apuntes[2].concepto).toContain('**** 0366')
    expect(cuerpo.apuntes[2].concepto).not.toContain('4532')
  })

  it('crea los movimientos que se le manden y ni uno más', async () => {
    const { documentoId, cuerpo } = await subirYLeer()
    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/espacios/${yo.espacioPersonalId}/documentos/${documentoId}/aplicar`,
      headers: { cookie: yo.cookie },
      // A propósito solo dos de los tres: desmarcar en la pantalla de revisión
      // tiene que significar algo.
      payload: { cuentaId, apuntes: cuerpo.apuntes.slice(0, 2) },
    })
    expect(respuesta.statusCode).toBe(200)
    expect(respuesta.json()).toEqual({ creados: 2, omitidos: 0 })
    expect(await prisma.movimiento.count()).toBe(2)

    const documento = await prisma.documento.findUniqueOrThrow({ where: { id: documentoId } })
    expect(documento.estado).toBe('aplicado')
  })

  it('aplicar dos veces no duplica nada', async () => {
    const { documentoId, cuerpo } = await subirYLeer()
    const aplicar = () =>
      app.inject({
        method: 'POST',
        url: `/api/espacios/${yo.espacioPersonalId}/documentos/${documentoId}/aplicar`,
        headers: { cookie: yo.cookie },
        payload: { cuentaId, apuntes: cuerpo.apuntes },
      })

    await aplicar()
    const segunda = await aplicar()
    expect(segunda.json()).toEqual({ creados: 0, omitidos: 3 })
    expect(await prisma.movimiento.count()).toBe(3)
  })

  it('marca como ya importado lo que aplicó una vez', async () => {
    const primera = await subirYLeer()
    await app.inject({
      method: 'POST',
      url: `/api/espacios/${yo.espacioPersonalId}/documentos/${primera.documentoId}/aplicar`,
      headers: { cookie: yo.cookie },
      payload: { cuentaId, apuntes: primera.cuerpo.apuntes },
    })

    // Un extracto que solapa con el anterior: mismo movimiento, fichero nuevo.
    const solapado = await subir(
      yo.espacioPersonalId,
      yo.cookie,
      'agosto-completo.csv',
      `${CSV}10/08/2026;Gasolina;-70,00;2.737,65\n`,
    )
    const { documento } = solapado.json() as { documento: { id: string } }
    const lectura = await app.inject({
      method: 'GET',
      url: `/api/espacios/${yo.espacioPersonalId}/documentos/${documento.id}/lectura`,
      headers: { cookie: yo.cookie },
    })
    const apuntes = lectura.json().apuntes as { yaImportado: boolean; concepto: string }[]
    expect(apuntes).toHaveLength(4)
    expect(apuntes.filter((a) => a.yaImportado)).toHaveLength(3)
    expect(apuntes.find((a) => !a.yaImportado)!.concepto).toBe('Gasolina')
  })

  it('señala lo que se parece a un movimiento apuntado a mano', async () => {
    await app.inject({
      method: 'POST',
      url: `/api/espacios/${yo.espacioPersonalId}/movimientos`,
      headers: { cookie: yo.cookie },
      payload: { cuentaId, importe: -6120, fecha: '2026-08-02', concepto: 'Luz de agosto' },
    })
    const { cuerpo } = await subirYLeer()
    const luz = cuerpo.apuntes[0] as { parecidoA?: { concepto: string } }
    expect(luz.parecidoA?.concepto).toBe('Luz de agosto')
  })

  it('no aplica a una cuenta de otro espacio', async () => {
    const otra = await registrar(app, 'otra@ejemplo.es')
    const ajena = await app.inject({
      method: 'POST',
      url: `/api/espacios/${otra.espacioPersonalId}/cuentas`,
      headers: { cookie: otra.cookie },
      payload: { nombre: 'Suya', tipo: 'corriente', saldoInicial: 0 },
    })
    const cuentaAjena = (ajena.json() as { cuenta: { id: string } }).cuenta.id

    const { documentoId, cuerpo } = await subirYLeer()
    const respuesta = await app.inject({
      method: 'POST',
      url: `/api/espacios/${yo.espacioPersonalId}/documentos/${documentoId}/aplicar`,
      headers: { cookie: yo.cookie },
      payload: { cuentaId: cuentaAjena, apuntes: cuerpo.apuntes },
    })
    expect(respuesta.statusCode).toBe(404)
    expect(await prisma.movimiento.count()).toBe(0)
  })
})

describe('borrar un documento', () => {
  it('deja los movimientos que ya salieron de él', async () => {
    const subida = await subir(yo.espacioPersonalId, yo.cookie, 'extracto.csv', CSV)
    const { documento } = subida.json() as { documento: { id: string } }
    const lectura = await app.inject({
      method: 'GET',
      url: `/api/espacios/${yo.espacioPersonalId}/documentos/${documento.id}/lectura`,
      headers: { cookie: yo.cookie },
    })
    await app.inject({
      method: 'POST',
      url: `/api/espacios/${yo.espacioPersonalId}/documentos/${documento.id}/aplicar`,
      headers: { cookie: yo.cookie },
      payload: { cuentaId, apuntes: lectura.json().apuntes },
    })

    const borrado = await app.inject({
      method: 'DELETE',
      url: `/api/espacios/${yo.espacioPersonalId}/documentos/${documento.id}`,
      headers: { cookie: yo.cookie },
    })
    expect(borrado.statusCode).toBe(200)
    // El documento desaparece de la lista; el dinero apuntado sigue siendo tuyo.
    expect(await prisma.movimiento.count()).toBe(3)

    const lista = await app.inject({
      method: 'GET',
      url: `/api/espacios/${yo.espacioPersonalId}/documentos`,
      headers: { cookie: yo.cookie },
    })
    expect(lista.json().documentos).toHaveLength(0)
  })
})
