import { describe, it, expect } from 'vitest'
// @ts-expect-error el servidor es JS sin tipos; se prueba desde aquí igual que agregar.mjs
import { nombreSeguro, AlmacenCopias } from '../../servidor/copias.mjs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const seguro = nombreSeguro as (v: unknown) => string | undefined
const Almacen = AlmacenCopias as new (raiz: string, retencion?: number) => {
  guardar(empresaId: string, backup: unknown): Promise<{ fecha: string; bytes: number }>
  listar(empresaId: string): Promise<{ fecha: string; bytes: number }[]>
  empresas(): Promise<{ empresaId: string; copias: number; ultima: string }[]>
  leer(empresaId: string, fecha?: string): Promise<unknown>
}

const backup = (fecha: string, razonSocial = 'BESPAIN 7777 SLU') => ({
  version: 1,
  fecha,
  config: { empresa: { razonSocial, cif: 'B56241854' } },
  datos: { ventas: [{ id: 'v1' }] },
  checksum: 'abc123',
})

async function almacenTemporal(retencion = 30) {
  const raiz = await fs.mkdtemp(path.join(os.tmpdir(), 'copias-'))
  return new Almacen(raiz, retencion)
}

describe('nombres admitidos en el almacén de copias', () => {
  it('acepta un id de empresa normal', () => {
    expect(seguro('e1a2b3')).toBe('e1a2b3')
    expect(seguro('2026-08-11')).toBe('2026-08-11')
  })

  it('RECHAZA cualquier cosa que permita salir de la carpeta', () => {
    // Sin esto, el id de empresa llega de fuera y forma una ruta: un «../..»
    // dejaría escribir en cualquier sitio del servidor.
    expect(seguro('../../etc/passwd')).toBeUndefined()
    expect(seguro('..')).toBeUndefined()
    expect(seguro('a/b')).toBeUndefined()
    expect(seguro('a\\b')).toBeUndefined()
    expect(seguro('')).toBeUndefined()
  })
})

describe('almacén de copias del servidor', () => {
  it('guarda una copia y la vuelve a leer entera', async () => {
    const a = await almacenTemporal()
    await a.guardar('e1', backup('2026-08-11'))
    const leida = await a.leer('e1') as { fecha: string; datos: { ventas: unknown[] } }
    expect(leida.fecha).toBe('2026-08-11')
    expect(leida.datos.ventas.length).toBe(1)
  })

  it('una copia por día: la del mismo día se sustituye', async () => {
    const a = await almacenTemporal()
    await a.guardar('e1', backup('2026-08-11', 'Antigua'))
    await a.guardar('e1', backup('2026-08-11', 'Nueva'))
    expect((await a.listar('e1')).length).toBe(1)
    const leida = await a.leer('e1') as { config: { empresa: { razonSocial: string } } }
    expect(leida.config.empresa.razonSocial).toBe('Nueva')
  })

  it('conserva solo las últimas copias, y son las MÁS RECIENTES', async () => {
    const a = await almacenTemporal(3)
    for (const dia of ['08', '09', '10', '11', '12']) await a.guardar('e1', backup(`2026-08-${dia}`))
    const copias = await a.listar('e1')
    expect(copias.map((c) => c.fecha)).toEqual(['2026-08-12', '2026-08-11', '2026-08-10'])
  })

  it('lee una copia concreta por fecha', async () => {
    const a = await almacenTemporal()
    await a.guardar('e1', backup('2026-08-10', 'Diez'))
    await a.guardar('e1', backup('2026-08-11', 'Once'))
    const leida = await a.leer('e1', '2026-08-10') as { config: { empresa: { razonSocial: string } } }
    expect(leida.config.empresa.razonSocial).toBe('Diez')
  })

  it('separa las empresas y las lista con su última copia', async () => {
    const a = await almacenTemporal()
    await a.guardar('e1', backup('2026-08-11'))
    await a.guardar('e2', backup('2026-08-09'))
    const empresas = await a.empresas()
    expect(empresas.length).toBe(2)
    expect(empresas.find((e) => e.empresaId === 'e1')!.ultima).toBe('2026-08-11')
  })

  it('sin copias no devuelve nada, en vez de fallar', async () => {
    const a = await almacenTemporal()
    expect(await a.leer('sin-nada')).toBeUndefined()
    expect(await a.listar('sin-nada')).toEqual([])
  })

  it('no deja escribir fuera de su carpeta', async () => {
    const a = await almacenTemporal()
    await expect(a.guardar('../fuera', backup('2026-08-11'))).rejects.toThrow(/no admitido/)
  })
})

describe('recuperar tras un borrado total del navegador', () => {
  it('las empresas del servidor traen su razón social, no solo el id', async () => {
    // Al limpiarse el navegador la app arranca con un id de empresa NUEVO y las
    // copias están bajo el viejo: sin el nombre habría que elegir a ciegas.
    const a = await almacenTemporal()
    await a.guardar('id-viejo-1', backup('2026-08-11', 'BESPAIN 7777 SLU'))
    await a.guardar('id-viejo-2', backup('2026-08-10', 'BTC EMBASSY SPAIN HOLDING'))
    const empresas = (await a.empresas()) as unknown as { empresaId: string; razonSocial: string; cif: string; ultima: string }[]
    expect(empresas.map((e) => e.razonSocial)).toEqual(['BESPAIN 7777 SLU', 'BTC EMBASSY SPAIN HOLDING'])
    expect(empresas[0].cif).toBe('B56241854')
  })
})
