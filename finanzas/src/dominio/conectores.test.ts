import { describe, it, expect } from 'vitest'
import { generarDemoSquare, definicionConector } from './conectores'

describe('conector de demostración (Square)', () => {
  it('genera liquidaciones y comisiones deterministas', () => {
    const a = generarDemoSquare('2026-07-30', 3)
    const b = generarDemoSquare('2026-07-30', 3)
    expect(a.movimientos).toEqual(b.movimientos) // determinista
    expect(a.movimientos).toHaveLength(6) // 3 días × (liquidación + comisión)
  })
  it('los externalId son estables para la idempotencia', () => {
    const r = generarDemoSquare('2026-07-30', 1)
    expect(r.movimientos[0].externalId).toBe('SQ-LIQ-2026-07-30')
    expect(r.movimientos[1].externalId).toBe('SQ-COM-2026-07-30')
  })
  it('la comisión es una salida (importe negativo)', () => {
    const r = generarDemoSquare('2026-07-30', 1)
    expect(r.movimientos[0].importe).toBeGreaterThan(0)
    expect(r.movimientos[1].importe).toBeLessThan(0)
  })
  it('el catálogo describe cada conector', () => {
    expect(definicionConector('SQUARE').nombre).toBe('Square')
    expect(definicionConector('BANCO_PSD2').soloLectura).toBe(true)
  })
})
