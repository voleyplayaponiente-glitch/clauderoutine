import { describe, it, expect } from 'vitest'
import {
  redondear2,
  aCentimos,
  aEuros,
  sumar,
  restar,
  formatearEuro,
  formatearPorcentaje,
} from './dinero'

describe('redondeo y céntimos', () => {
  it('redondea a 2 decimales (mitad hacia arriba)', () => {
    expect(redondear2(1.005)).toBe(1.01)
    expect(redondear2(2.675)).toBe(2.68)
    expect(redondear2(-1.005)).toBe(-1.01)
  })
  it('convierte euros ↔ céntimos sin perder precisión', () => {
    expect(aCentimos(19.99)).toBe(1999)
    expect(aCentimos(0.1)).toBe(10)
    expect(aEuros(1999)).toBe(19.99)
  })
  it('suma sin errores de coma flotante', () => {
    expect(sumar(0.1, 0.2)).toBe(0.3)
    expect(sumar(19.99, 0.01, 100)).toBe(120)
    expect(restar(0.3, 0.1)).toBe(0.2)
  })
})

describe('formato español', () => {
  it('usa punto de millar, coma decimal y € detrás', () => {
    expect(formatearEuro(1234.5)).toBe('1.234,50 €')
    expect(formatearEuro(180000)).toBe('180.000,00 €')
    expect(formatearEuro(-42)).toBe('-42,00 €')
    expect(formatearEuro(0)).toBe('0,00 €')
  })
  it('respeta opciones de símbolo y signo', () => {
    expect(formatearEuro(50, { conSimbolo: false })).toBe('50,00')
    expect(formatearEuro(50, { signoMas: true })).toBe('+50,00 €')
  })
  it('formatea porcentajes', () => {
    expect(formatearPorcentaje(21)).toBe('21 %')
    expect(formatearPorcentaje(12.5, 1)).toBe('12,5 %')
  })
})
