import { describe, it, expect } from 'vitest'
// El servidor vive fuera de src y sin TypeScript, pero su lógica es pura y hay
// que probarla igual: se importa desde aquí con el tipo declarado a mano.
// @ts-expect-error — módulo .mjs del servidor, sin declaración de tipos
import * as agregacion from '../../servidor/agregar.mjs'

const { agregarVentasSquare, diaDelPedido, FORMA_POR_TENDER } = agregacion as {
  agregarVentasSquare: (pedidos: unknown, desfaseHoras?: number) => any[]
  diaDelPedido: (pedido: unknown, desfaseHoras?: number) => string | undefined
  FORMA_POR_TENDER: Record<string, string>
}

const pedido = (p: Record<string, unknown>) => ({
  location_id: 'L1',
  closed_at: '2026-08-01T12:00:00Z',
  total_money: { amount: 1210, currency: 'EUR' },
  total_tax_money: { amount: 210, currency: 'EUR' },
  tenders: [{ type: 'CARD', amount_money: { amount: 1210 } }],
  ...p,
})

describe('agregar pedidos de Square a ventas diarias', () => {
  it('suma los tickets del mismo día y tienda', () => {
    const r = agregarVentasSquare([pedido({}), pedido({}), pedido({ location_id: 'L2' })])
    expect(r).toHaveLength(2)
    const l1 = r.find((d: any) => d.locationId === 'L1')
    expect(l1).toMatchObject({ fecha: '2026-08-01', total: 24.2, cuota: 4.2, base: 20, numTickets: 2 })
  })

  it('la base es el total menos el IVA, así siempre cuadra', () => {
    const r = agregarVentasSquare([pedido({})])
    expect(r[0].base + r[0].cuota).toBeCloseTo(r[0].total, 2)
  })

  it('reparte el cobro por forma de pago', () => {
    const r = agregarVentasSquare([
      pedido({ tenders: [{ type: 'CASH', amount_money: { amount: 500 } }, { type: 'CARD', amount_money: { amount: 710 } }] }),
    ])
    expect(r[0].cobros).toEqual([
      { forma: 'EFECTIVO', importe: 5 },
      { forma: 'TARJETA', importe: 7.1 },
    ])
  })

  it('un datáfono ajeno a Square es cobro con tarjeta', () => {
    // Es lo que en los informes sale como «Otros / origen del pago desconocido».
    expect(FORMA_POR_TENDER.EXTERNAL).toBe('TARJETA')
    expect(FORMA_POR_TENDER.THIRD_PARTY_CARD).toBe('TARJETA')
    const r = agregarVentasSquare([pedido({ tenders: [{ type: 'EXTERNAL', amount_money: { amount: 1210 } }] })])
    expect(r[0].cobros).toEqual([{ forma: 'TARJETA', importe: 12.1 }])
  })

  it('la fecha es la del cierre, no la de creación', () => {
    // Ticket abierto a las 23:55 y cobrado pasada la medianoche: es del día 2.
    const p = pedido({ created_at: '2026-08-01T23:55:00Z', closed_at: '2026-08-02T00:05:00Z' })
    expect(diaDelPedido(p)).toBe('2026-08-02')
    expect(agregarVentasSquare([p])[0].fecha).toBe('2026-08-02')
  })

  it('sin cierre se usa la creación, que es lo único que hay', () => {
    expect(diaDelPedido({ created_at: '2026-08-03T10:00:00Z' })).toBe('2026-08-03')
    expect(diaDelPedido({})).toBeUndefined()
  })

  it('el desfase horario mueve el corte del día', () => {
    // 23:30 UTC del día 1 es ya el día 2 en España en verano (UTC+2).
    const p = pedido({ closed_at: '2026-08-01T23:30:00Z' })
    expect(diaDelPedido(p, 0)).toBe('2026-08-01')
    expect(diaDelPedido(p, 2)).toBe('2026-08-02')
  })

  it('no se pierden céntimos al sumar muchos tickets', () => {
    // 3 tickets de 0,10 € deben dar 0,30 €, no 0,30000000000000004.
    const p = pedido({ total_money: { amount: 10 }, total_tax_money: { amount: 0 }, tenders: [] })
    expect(agregarVentasSquare([p, p, p])[0].total).toBe(0.3)
  })

  it('los pedidos sin fecha utilizable se ignoran, no rompen', () => {
    expect(agregarVentasSquare([{ location_id: 'L1' }])).toEqual([])
    expect(agregarVentasSquare([])).toEqual([])
    expect(agregarVentasSquare(undefined)).toEqual([])
  })
})
