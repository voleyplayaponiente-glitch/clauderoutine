import { describe, it, expect } from 'vitest'
import { parsearNumeroEs, exigirNumeroEs } from './parseo-es'

describe('parseo de números en formato español', () => {
  it('EL CASO CRÍTICO: "180.000" es ciento ochenta mil, no 180', () => {
    expect(parsearNumeroEs('180.000')).toBe(180000)
    expect(parsearNumeroEs('1.234.567')).toBe(1234567)
  })
  it('la coma es siempre el decimal y el punto el millar', () => {
    expect(parsearNumeroEs('1.234,56')).toBe(1234.56)
    expect(parsearNumeroEs('0,5')).toBe(0.5)
    expect(parsearNumeroEs('1.000.000,99')).toBe(1000000.99)
  })
  it('un punto con 1, 2 o 4+ decimales se interpreta como decimal', () => {
    expect(parsearNumeroEs('180.5')).toBe(180.5)
    expect(parsearNumeroEs('180.50')).toBe(180.5)
    expect(parsearNumeroEs('1.2345')).toBe(1.2345)
  })
  it('ignora € y espacios, admite signo y paréntesis contable', () => {
    expect(parsearNumeroEs(' 1.234,56 € ')).toBe(1234.56)
    expect(parsearNumeroEs('-42,00')).toBe(-42)
    expect(parsearNumeroEs('(1.234,56)')).toBe(-1234.56)
  })
  it('no inventa: devuelve null ante lo que no es número', () => {
    expect(parsearNumeroEs('')).toBeNull()
    expect(parsearNumeroEs('   ')).toBeNull()
    expect(parsearNumeroEs('N/D')).toBeNull()
    expect(parsearNumeroEs(null)).toBeNull()
    expect(parsearNumeroEs(undefined)).toBeNull()
  })
  it('pasa números tal cual', () => {
    expect(parsearNumeroEs(42.5)).toBe(42.5)
  })
  it('exigirNumeroEs lanza si no hay número', () => {
    expect(() => exigirNumeroEs('N/D', 'base')).toThrow(/base/)
    expect(exigirNumeroEs('10,50')).toBe(10.5)
  })
})
