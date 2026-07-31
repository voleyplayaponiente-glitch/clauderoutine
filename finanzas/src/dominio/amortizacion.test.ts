import { describe, it, expect } from 'vitest'
import { generarCuadro, resumenCuadro } from './amortizacion'
import { aCentimos } from './dinero'

describe('cuadro de amortización francés', () => {
  const cuadro = generarCuadro({ principal: 12000, tipoAnual: 6, nPeriodos: 12, periodicidad: 'MENSUAL', fechaInicio: '2026-01-01', sistema: 'FRANCES' })

  it('genera una cuota por periodo', () => {
    expect(cuadro).toHaveLength(12)
  })
  it('la suma del capital iguala el principal (cierra a cero)', () => {
    const totalCapital = cuadro.reduce((s, c) => s + aCentimos(c.capital), 0)
    expect(totalCapital).toBe(aCentimos(12000))
    expect(cuadro[cuadro.length - 1].pendiente).toBe(0)
  })
  it('la cuota mensual es la esperada (~1032,80)', () => {
    // C = 12000·0,005 / (1 − 1,005^−12) ≈ 1032,80
    expect(cuadro[0].cuota).toBeCloseTo(1032.8, 1)
  })
  it('el interés decrece y el capital crece', () => {
    expect(cuadro[0].interes).toBeGreaterThan(cuadro[11].interes)
    expect(cuadro[0].capital).toBeLessThan(cuadro[11].capital)
  })
  it('las fechas avanzan por periodo', () => {
    expect(cuadro[0].fecha).toBe('2026-02-01')
    expect(cuadro[11].fecha).toBe('2027-01-01')
  })
})

describe('cuadro lineal', () => {
  const cuadro = generarCuadro({ principal: 10000, tipoAnual: 0, nPeriodos: 10, periodicidad: 'MENSUAL', fechaInicio: '2026-01-01', sistema: 'LINEAL' })
  it('capital constante y sin intereses al 0 %', () => {
    expect(cuadro[0].capital).toBe(1000)
    expect(cuadro[0].interes).toBe(0)
    expect(cuadro.reduce((s, c) => s + aCentimos(c.capital), 0)).toBe(aCentimos(10000))
  })
})

describe('resumen del cuadro', () => {
  it('capital pendiente = cuotas futuras', () => {
    const cuadro = generarCuadro({ principal: 1200, tipoAnual: 0, nPeriodos: 12, periodicidad: 'MENSUAL', fechaInicio: '2026-01-01', sistema: 'LINEAL' })
    const r = resumenCuadro(cuadro)
    expect(r.totalCapital).toBe(1200)
    // A fecha 2026-06-15 quedan las cuotas de julio..enero (7 cuotas de 100).
    expect(r.pendienteA('2026-06-15')).toBe(700)
  })
})
