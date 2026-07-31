import { describe, it, expect } from 'vitest'
import { construirBackup, verificarIntegridad, calcularChecksum, stableStringify, parseJsonSeguro, redactarCredenciales } from './backup'
import { configuracionInicial } from './defaults'
import type { DatosOperativos } from './tipos'

function datosVacios(): DatosOperativos {
  return { terceros: [], ventas: [], compras: [], recurrentes: [], cuentasTesoreria: [], movimientos: [], arqueos: [], almacenes: [], articulos: [], movimientosStock: [], importaciones: [], deudas: [], deudores: [], presupuestos: [], logsSync: [] }
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

describe('seguridad del backup', () => {
  it('nunca exporta las credenciales de los conectores', () => {
    const config = {
      ...configuracionInicial(),
      conectores: [
        { id: 'c1', tipo: 'SQUARE', nombre: 'Square', modo: 'SERVIDOR', activo: true, token: 'sq0atp-SECRETO', secretoServidor: 'secreto-umbrel', urlServidor: 'https://umbrel.local' },
      ],
    } as any
    const b = construirBackup(config, datosVacios(), '2026-07-31')
    const texto = JSON.stringify(b)
    expect(texto).not.toContain('sq0atp-SECRETO')
    expect(texto).not.toContain('secreto-umbrel')
    // el resto del conector se conserva para poder restaurarlo
    expect(b.config.conectores[0].urlServidor).toBe('https://umbrel.local')
    expect(verificarIntegridad(b).valido).toBe(true)
  })

  it('redactarCredenciales no muta la configuración original', () => {
    const config = { ...configuracionInicial(), conectores: [{ id: 'c1', tipo: 'SQUARE', nombre: 'Square', modo: 'DISPOSITIVO', activo: true, token: 'tok' }] } as any
    redactarCredenciales(config)
    expect(config.conectores[0].token).toBe('tok')
  })

  it('parseJsonSeguro descarta las claves que contaminan el prototipo', () => {
    const malicioso = '{"a":1,"__proto__":{"pwned":true},"anidado":{"constructor":{"prototype":{"x":1}}}}'
    const obj = parseJsonSeguro(malicioso) as any
    expect(obj.a).toBe(1)
    expect(({} as any).pwned).toBeUndefined()
    expect(Object.prototype.hasOwnProperty.call(obj, '__proto__')).toBe(false)
    expect(obj.anidado.constructor).toBe(Object)
  })

  it('parseJsonSeguro sigue leyendo un backup normal', () => {
    const b = construirBackup(configuracionInicial(), datosVacios(), '2026-07-31')
    const leido = parseJsonSeguro(JSON.stringify(b))
    expect(verificarIntegridad(leido).valido).toBe(true)
  })
})
