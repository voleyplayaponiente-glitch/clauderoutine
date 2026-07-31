import { describe, it, expect } from 'vitest'
import { desdeBase, desdeTotal, desdeCuota, agruparPorTipo } from './iva'

describe('IVA en cualquier dirección', () => {
  it('desde la base calcula cuota y total', () => {
    const r = desdeBase(100, 21)
    expect(r.cuota).toBe(21)
    expect(r.total).toBe(121)
  })
  it('desde el total despeja la base y la cuota cuadra al céntimo', () => {
    const r = desdeTotal(121, 21)
    expect(r.base).toBe(100)
    expect(r.cuota).toBe(21)
    expect(r.total).toBe(121)
  })
  it('desde el total con importe no redondo mantiene base+cuota=total', () => {
    const r = desdeTotal(100, 21)
    expect(r.base + r.cuota).toBe(100)
    expect(r.total).toBe(100)
    expect(r.base).toBe(82.64)
    expect(r.cuota).toBe(17.36)
  })
  it('desde la cuota deduce base y total', () => {
    const r = desdeCuota(21, 21)
    expect(r.base).toBe(100)
    expect(r.total).toBe(121)
  })
  it('soporta tipos reducidos', () => {
    expect(desdeBase(100, 10).cuota).toBe(10)
    expect(desdeBase(100, 4).cuota).toBe(4)
    expect(desdeBase(100, 0).cuota).toBe(0)
  })
})

describe('regímenes especiales', () => {
  it('exento y no sujeto no generan cuota', () => {
    expect(desdeBase(100, 0, 'EXENTO').cuota).toBe(0)
    expect(desdeBase(100, 21, 'NO_SUJETO').cuota).toBe(0)
    expect(desdeTotal(100, 21, 'EXENTO').base).toBe(100)
  })
  it('inversión del sujeto pasivo no repercute', () => {
    const r = desdeBase(1000, 21, 'ISP')
    expect(r.cuota).toBe(0)
    expect(r.total).toBe(1000)
  })
})

describe('agrupación por tipo', () => {
  it('suma bases y cuotas separando por tipo (libro de IVA)', () => {
    const g = agruparPorTipo([desdeBase(100, 21), desdeBase(200, 10), desdeBase(50, 21)])
    expect(g.base).toBe(350)
    expect(g.cuota).toBe(51.5) // 21+10.5+... => 21*(150)/100=31.5, +20 = 51.5
    expect(g.porTipo['21'].base).toBe(150)
    expect(g.porTipo['21'].cuota).toBe(31.5)
    expect(g.porTipo['10'].cuota).toBe(20)
  })
})
