import { describe, it, expect } from 'vitest'
import { libroRepercutido, libroSoportado, resumen303, modelo347 } from './registros-fiscales'
import type { Venta, Compra, Tercero } from './tipos'

const ventas: Venta[] = [{
  id: 'v1', creadoEn: '', creadoPor: 'a', origen: 'MANUAL', centroCosteId: 'c1', fecha: '2026-07-30',
  lineasIva: [{ base: 1000, tipoIvaId: 'iva-21', tipo: 21, regimen: 'GENERAL', cuota: 210 }], cobros: [], numTickets: 0, unidades: 0, cerrado: true,
}]
const compras: Compra[] = [{
  id: 'c1', creadoEn: '', creadoPor: 'a', origen: 'MANUAL', naturaleza: 'MERCADERIA', terceroId: 't1', numFactura: 'F1',
  fechaFactura: '2026-03-10', lineasIva: [{ base: 4000, tipoIvaId: 'iva-21', tipo: 21, regimen: 'GENERAL', cuota: 840 }],
  retencion: 0, formaPago: 'TRANSFERENCIA', estadoPago: 'PENDIENTE', deducible: true,
}]
const terceros: Tercero[] = [{ id: 't1', creadoEn: '', creadoPor: 'a', origen: 'MANUAL', nombre: 'Proveedor SL', cif: 'B123', esProveedor: true, esCliente: false, esVinculada: false }]

describe('libros de IVA y modelo 303', () => {
  it('libro repercutido y soportado', () => {
    expect(libroRepercutido(ventas)).toHaveLength(1)
    expect(libroSoportado(compras, () => 'Proveedor SL')[0].concepto).toContain('Proveedor SL')
  })
  it('excluye del soportado las compras no deducibles', () => {
    expect(libroSoportado([{ ...compras[0], deducible: false }], () => 'x')).toHaveLength(0)
  })
  it('resumen 303: repercutido − soportado', () => {
    const r = resumen303(libroRepercutido(ventas), libroSoportado(compras, () => 'x'))
    expect(r.ivaRepercutido).toBe(210)
    expect(r.ivaSoportado).toBe(840)
    expect(r.resultado).toBe(-630) // a compensar
  })
})

describe('modelo 347', () => {
  it('incluye terceros por encima del umbral', () => {
    const r = modelo347(compras, {}, terceros, 2026)
    expect(r).toHaveLength(1)
    expect(r[0].total).toBe(4840) // 4000 + 840
  })
  it('excluye los que no superan el umbral', () => {
    const peque: Compra = { ...compras[0], lineasIva: [{ base: 100, tipoIvaId: 'iva-21', tipo: 21, regimen: 'GENERAL', cuota: 21 }] }
    expect(modelo347([peque], {}, terceros, 2026)).toHaveLength(0)
  })
})
