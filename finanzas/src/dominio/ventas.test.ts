import { describe, it, expect } from 'vitest'
import { brutoVenta, ticketMedio, cuadreVenta } from './ventas'
import type { Venta } from './tipos'

function venta(parcial: Partial<Venta>): Venta {
  return {
    id: 'v1', creadoEn: '', creadoPor: 'admin', origen: 'MANUAL',
    centroCosteId: 'c1', fecha: '2026-07-30',
    lineasIva: [], cobros: [], numTickets: 0, unidades: 0, cerrado: false,
    ...parcial,
  }
}

describe('ventas diarias', () => {
  const v = venta({
    lineasIva: [
      { base: 100, tipoIvaId: 'iva-21', tipo: 21, regimen: 'GENERAL', cuota: 21 },
      { base: 50, tipoIvaId: 'iva-10', tipo: 10, regimen: 'GENERAL', cuota: 5 },
    ],
    cobros: [
      { forma: 'EFECTIVO', importe: 76 },
      { forma: 'TARJETA', importe: 100 },
    ],
    numTickets: 8,
  })

  it('calcula el bruto (base + IVA)', () => {
    expect(brutoVenta(v)).toBe(176)
  })
  it('calcula el ticket medio', () => {
    expect(ticketMedio(v)).toBe(22)
    expect(ticketMedio(venta({ numTickets: 0 }))).toBe(0)
  })
  it('cuadra cuando los cobros igualan el bruto', () => {
    const c = cuadreVenta(v)
    expect(c.cuadra).toBe(true)
    expect(c.diferencia).toBe(0)
  })
  it('detecta el descuadre de cobros', () => {
    const c = cuadreVenta(venta({ ...v, cobros: [{ forma: 'EFECTIVO', importe: 170 }] }))
    expect(c.cuadra).toBe(false)
    expect(c.diferencia).toBe(6)
  })
})
