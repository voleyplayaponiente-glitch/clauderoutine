import { describe, it, expect } from 'vitest'
import { sumasYSaldos, clasificar, cuentaPyG, balanceSituacion } from './libros'
import { asientoVenta, asientoCompra } from './asientos'
import type { Venta, Compra } from './tipos'

const venta: Venta = {
  id: 'v1', creadoEn: '', creadoPor: 'admin', origen: 'MANUAL', centroCosteId: 'c1', fecha: '2026-07-30',
  lineasIva: [{ base: 1000, tipoIvaId: 'iva-21', tipo: 21, regimen: 'GENERAL', cuota: 210 }],
  cobros: [{ forma: 'EFECTIVO', importe: 1210 }], numTickets: 10, unidades: 10, cerrado: true,
}
const compra: Compra = {
  id: 'c1', creadoEn: '', creadoPor: 'admin', origen: 'MANUAL', naturaleza: 'MERCADERIA', terceroId: 't1',
  numFactura: 'F1', fechaFactura: '2026-07-15', lineasIva: [{ base: 400, tipoIvaId: 'iva-21', tipo: 21, regimen: 'GENERAL', cuota: 84 }],
  retencion: 0, formaPago: 'TRANSFERENCIA', estadoPago: 'PENDIENTE', deducible: true,
}
const asientos = [asientoVenta(venta), asientoCompra(compra)]

describe('balance de sumas y saldos', () => {
  it('CUADRA por construcción (Σdebe = Σhaber)', () => {
    const r = sumasYSaldos(asientos)
    expect(r.cuadra).toBe(true)
    expect(r.totalDebe).toBe(r.totalHaber)
  })
  it('agrega el debe y el haber por cuenta', () => {
    const r = sumasYSaldos(asientos)
    const c570 = r.cuentas.find((c) => c.cuenta === '570')!
    expect(c570.saldo).toBe(1210) // cobro en efectivo
    const c700 = r.cuentas.find((c) => c.cuenta === '700')!
    expect(c700.saldo).toBe(-1000) // ventas (acreedor)
  })
})

describe('clasificación PGC', () => {
  it('asigna la naturaleza por grupo y signo', () => {
    expect(clasificar('700', -1000)).toBe('INGRESO')
    expect(clasificar('600', 400)).toBe('GASTO')
    expect(clasificar('570', 1210)).toBe('ACTIVO')
    expect(clasificar('400', -484)).toBe('PASIVO') // acreedor
    expect(clasificar('430', 500)).toBe('ACTIVO') // deudor
    expect(clasificar('129', -500)).toBe('PN')
  })
})

describe('P&G y balance de situación', () => {
  const saldos = sumasYSaldos(asientos).cuentas
  it('el resultado = ingresos − gastos', () => {
    const pyg = cuentaPyG(saldos)
    expect(pyg.ingresos).toBe(1000)
    expect(pyg.gastos).toBe(400)
    expect(pyg.resultado).toBe(600)
  })
  it('el Balance de Situación CUADRA (Activo = Pasivo + PN)', () => {
    const b = balanceSituacion(saldos)
    expect(b.cuadra).toBe(true)
    expect(b.totalActivo).toBe(b.totalPasivoPN)
    expect(b.resultado).toBe(600)
  })
})
