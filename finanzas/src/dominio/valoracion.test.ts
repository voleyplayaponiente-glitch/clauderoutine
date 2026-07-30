import { describe, it, expect } from 'vitest'
import { valorar, existenciaTotal } from './valoracion'
import type { MovimientoStock } from './tipos'

function mov(p: Partial<MovimientoStock>): MovimientoStock {
  return { id: Math.random().toString(), creadoEn: '2026-01-01T00:00:00Z', creadoPor: 'admin', origen: 'MANUAL', articuloId: 'a1', almacenId: 'alm1', fecha: '2026-01-01', tipo: 'COMPRA', cantidad: 0, costeUnitario: 0, esAprovisionamientoApertura: false, ...p }
}

describe('coste medio ponderado', () => {
  it('recalcula la media al entrar y no la altera al salir', () => {
    const movs = [
      mov({ fecha: '2026-01-01', creadoEn: '2026-01-01T01:00:00Z', cantidad: 10, costeUnitario: 2 }),
      mov({ fecha: '2026-01-02', creadoEn: '2026-01-02T01:00:00Z', cantidad: 10, costeUnitario: 3 }),
      mov({ fecha: '2026-01-03', creadoEn: '2026-01-03T01:00:00Z', tipo: 'VENTA', cantidad: -5, costeUnitario: 0 }),
    ]
    const e = valorar(movs)
    expect(e.cantidad).toBe(15)
    expect(e.costeMedio).toBe(2.5)
    expect(e.valor).toBe(37.5)
  })
  it('ignora movimientos anulados', () => {
    const movs = [
      mov({ cantidad: 10, costeUnitario: 2 }),
      mov({ cantidad: 100, costeUnitario: 9, anuladoEn: '2026-02-01' }),
    ]
    expect(valorar(movs).cantidad).toBe(10)
  })
  it('procesa por fecha aunque lleguen desordenados', () => {
    const movs = [
      mov({ fecha: '2026-01-05', creadoEn: 'z', cantidad: -4, tipo: 'VENTA' }),
      mov({ fecha: '2026-01-01', creadoEn: 'a', cantidad: 10, costeUnitario: 5 }),
    ]
    expect(valorar(movs).cantidad).toBe(6)
    expect(valorar(movs).costeMedio).toBe(5)
  })
  it('suma existencias de varios almacenes', () => {
    const movs = [
      mov({ almacenId: 'alm1', cantidad: 10, costeUnitario: 2 }),
      mov({ almacenId: 'alm2', cantidad: 5, costeUnitario: 4 }),
    ]
    const e = existenciaTotal('a1', movs, ['alm1', 'alm2'])
    expect(e.cantidad).toBe(15)
    expect(e.valor).toBe(40) // 20 + 20
  })
})
