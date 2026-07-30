import { describe, it, expect } from 'vitest'
import { fondoManiobra, ratioLiquidez, periodoMedioCobro, periodoMedioPago } from './ratios'

describe('ratios financieros', () => {
  it('fondo de maniobra y liquidez', () => {
    expect(fondoManiobra(10000, 6000)).toBe(4000)
    expect(ratioLiquidez(10000, 5000)).toBe(2)
    expect(ratioLiquidez(10000, 0)).toBe(0)
  })
  it('periodo medio de cobro', () => {
    // 3000 de clientes sobre 36500 de ventas anuales → 30 días.
    expect(periodoMedioCobro(3000, 36500, 365)).toBe(30)
  })
  it('periodo medio de pago (solo comercial)', () => {
    expect(periodoMedioPago(2000, 24333, 365)).toBe(30)
    expect(periodoMedioPago(2000, 0, 365)).toBe(0)
  })
})
