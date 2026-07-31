import { describe, it, expect } from 'vitest'
import { construirBackup, verificarIntegridad, calcularChecksum, stableStringify } from './backup'
import { configuracionInicial } from './defaults'
import type { DatosOperativos } from './tipos'

function datosVacios(): DatosOperativos {
  return { terceros: [], ventas: [], compras: [], recurrentes: [], cuentasTesoreria: [], movimientos: [], arqueos: [], almacenes: [], articulos: [], movimientosStock: [], importaciones: [], deudas: [], deudores: [], presupuestos: [] }
}

describe('checksum determinista', () => {
  it('el orden de las claves no cambia el checksum', () => {
    expect(calcularChecksum({ a: 1, b: 2 })).toBe(calcularChecksum({ b: 2, a: 1 }))
  })
  it('serializa arrays y objetos anidados', () => {
    expect(stableStringify({ b: [3, 1], a: 'x' })).toBe('{"a":"x","b":[3,1]}')
  })
})

describe('integridad del backup', () => {
  const config = configuracionInicial()
  const datos = datosVacios()

  it('un backup recién construido es válido', () => {
    const b = construirBackup(config, datos, '2026-07-31')
    expect(verificarIntegridad(b).valido).toBe(true)
  })
  it('detecta manipulación del contenido', () => {
    const b = construirBackup(config, datos, '2026-07-31')
    b.datos.ventas.push({ id: 'x' } as any) // altera sin recalcular el checksum
    const r = verificarIntegridad(b)
    expect(r.valido).toBe(false)
    expect(r.motivo).toMatch(/checksum/)
  })
  it('rechaza ficheros que no son backup', () => {
    expect(verificarIntegridad({ foo: 1 }).valido).toBe(false)
    expect(verificarIntegridad(null).valido).toBe(false)
  })
})
