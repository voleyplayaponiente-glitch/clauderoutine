import { describe, it, expect } from 'vitest'
import { asientoVenta, asientoCompra, cuentaCobro } from './asientos'
import { comprobarCuadre, saldoCuenta } from './partida-doble'
import { totalesCompra } from './compras'
import type { Venta, Compra } from './tipos'

const ventaBase: Venta = {
  id: 'v1', creadoEn: '', creadoPor: 'admin', origen: 'MANUAL',
  centroCosteId: 'c1', fecha: '2026-07-30',
  lineasIva: [{ base: 100, tipoIvaId: 'iva-21', tipo: 21, regimen: 'GENERAL', cuota: 21 }],
  cobros: [{ forma: 'EFECTIVO', importe: 61 }, { forma: 'TARJETA', importe: 60 }],
  numTickets: 5, unidades: 5, cerrado: false,
}

describe('asiento de venta', () => {
  it('genera un asiento cuadrado', () => {
    const a = asientoVenta(ventaBase)
    expect(comprobarCuadre(a.apuntes).cuadra).toBe(true)
  })
  it('imputa cobros a caja/banco y abona ventas e IVA repercutido', () => {
    const a = asientoVenta(ventaBase)
    expect(saldoCuenta('570', a.apuntes)).toBe(61) // efectivo
    expect(saldoCuenta('572', a.apuntes)).toBe(60) // tarjeta → banco
    expect(saldoCuenta('700', a.apuntes)).toBe(-100) // ventas (haber)
    expect(saldoCuenta('477', a.apuntes)).toBe(-21) // IVA repercutido (haber)
  })
  it('lanza si la venta no cuadra', () => {
    expect(() => asientoVenta({ ...ventaBase, cobros: [{ forma: 'EFECTIVO', importe: 100 }] })).toThrow(/no cuadra/)
  })
  it('mapea cada forma de cobro a su cuenta', () => {
    expect(cuentaCobro('EFECTIVO')).toBe('570')
    expect(cuentaCobro('APLAZADO')).toBe('430')
    expect(cuentaCobro('BIZUM')).toBe('572')
  })
})

const compraBase: Compra = {
  id: 'c1', creadoEn: '', creadoPor: 'admin', origen: 'MANUAL',
  naturaleza: 'MERCADERIA', terceroId: 't1', numFactura: 'F-001', fechaFactura: '2026-07-30',
  lineasIva: [{ base: 1000, tipoIvaId: 'iva-21', tipo: 21, regimen: 'GENERAL', cuota: 210 }],
  retencion: 0, formaPago: 'TRANSFERENCIA', estadoPago: 'PENDIENTE', deducible: true,
}

describe('asiento de compra', () => {
  it('mercadería: debe 600 + 472, haber 400 por el total', () => {
    const a = asientoCompra(compraBase)
    expect(comprobarCuadre(a.apuntes).cuadra).toBe(true)
    expect(saldoCuenta('600', a.apuntes)).toBe(1000)
    expect(saldoCuenta('472', a.apuntes)).toBe(210)
    expect(saldoCuenta('400', a.apuntes)).toBe(-1210)
  })
  it('con retención (servicio profesional) cuadra y usa 4751', () => {
    const compra: Compra = {
      ...compraBase, naturaleza: 'SERVICIO', cuentaGasto: '623', retencion: 150,
      lineasIva: [{ base: 1000, tipoIvaId: 'iva-21', tipo: 21, regimen: 'GENERAL', cuota: 210 }],
    }
    const t = totalesCompra(compra)
    expect(t.total).toBe(1060) // 1000 + 210 − 150
    const a = asientoCompra(compra)
    expect(comprobarCuadre(a.apuntes).cuadra).toBe(true)
    expect(saldoCuenta('623', a.apuntes)).toBe(1000)
    expect(saldoCuenta('4751', a.apuntes)).toBe(-150)
    expect(saldoCuenta('410', a.apuntes)).toBe(-1060)
  })
})
