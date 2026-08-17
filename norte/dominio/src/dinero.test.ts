import { describe, expect, it } from 'vitest'
import {
  ErrorDinero,
  aCentimos,
  aEuros,
  comprobarCentimos,
  formatearDinero,
  negar,
  parsearImporte,
  porcentaje,
  repartir,
  restar,
  sumar,
} from './dinero.js'

// Los espacios que mete Intl entre la cifra y el símbolo son finos y no se ven;
// compararlos tal cual convierte un test en una trampa.
const normalizar = (s: string) => s.replace(/[\s  ]/g, ' ')

describe('céntimos', () => {
  it('rechaza importes con decimales: en céntimos no existen', () => {
    expect(() => comprobarCentimos(10.5)).toThrow(ErrorDinero)
    expect(() => comprobarCentimos(Number.NaN)).toThrow(ErrorDinero)
  })

  it('convierte euros a céntimos sin el error del binario', () => {
    expect(aCentimos(3.4)).toBe(340)
    expect(aCentimos(0.1) + aCentimos(0.2)).toBe(30) // el 0,30000000000000004 clásico
    expect(aCentimos(1.005)).toBe(101)
    expect(aCentimos(-12.34)).toBe(-1234)
    expect(aEuros(123456)).toBe(1234.56)
  })

  it('suma y resta sin salirse de los enteros', () => {
    expect(sumar(340, 1234, -100)).toBe(1474)
    expect(restar(1000, 1234)).toBe(-234)
    expect(negar(500)).toBe(-500)
    expect(sumar()).toBe(0)
  })

  it('calcula porcentajes redondeando al céntimo', () => {
    expect(porcentaje(10000, 21)).toBe(2100)
    expect(porcentaje(333, 50)).toBe(167) // 1,665 € → 1,67 €
  })
})

describe('repartir', () => {
  it('no pierde ni inventa un céntimo (10 € entre 3)', () => {
    const partes = repartir(1000, [1, 1, 1])
    expect(sumar(...partes)).toBe(1000)
    expect(partes).toEqual([334, 333, 333])
  })

  it('reparte proporcional a los ingresos, que es el caso de la pareja', () => {
    // 1.000 € de gasto común, ingresos de 2.400 € y 1.600 €.
    const partes = repartir(100000, [240000, 160000])
    expect(partes).toEqual([60000, 40000])
    expect(sumar(...partes)).toBe(100000)
  })

  it('reparte también importes negativos sin descuadrar', () => {
    const partes = repartir(-1000, [1, 1, 1])
    expect(sumar(...partes)).toBe(-1000)
    expect(partes).toEqual([-334, -333, -333])
  })

  it('da siempre el mismo resultado con las mismas entradas', () => {
    expect(repartir(1000, [1, 1, 1])).toEqual(repartir(1000, [1, 1, 1]))
  })

  it('protesta si no hay entre quién repartir', () => {
    expect(() => repartir(1000, [])).toThrow(ErrorDinero)
    expect(() => repartir(1000, [0, 0])).toThrow(ErrorDinero)
    expect(() => repartir(1000, [1, -1])).toThrow(ErrorDinero)
  })
})

describe('formatearDinero', () => {
  it('formatea en español con dos decimales', () => {
    expect(normalizar(formatearDinero(123456))).toBe('1.234,56 €')
    expect(normalizar(formatearDinero(-34000))).toBe('-340,00 €')
    expect(normalizar(formatearDinero(0))).toBe('0,00 €')
  })

  it('pone el signo + solo cuando se pide', () => {
    expect(normalizar(formatearDinero(34000, { conSigno: true }))).toBe('+340,00 €')
    expect(normalizar(formatearDinero(34000))).toBe('340,00 €')
  })

  it('admite otra divisa y el modo sin decimales', () => {
    expect(normalizar(formatearDinero(123456, { divisa: 'USD' }))).toContain('1.234,56')
    expect(normalizar(formatearDinero(123456, { sinDecimales: true }))).toBe('1.235 €')
  })
})

describe('parsearImporte', () => {
  it('lee lo que escribe una persona', () => {
    expect(parsearImporte('3,40')).toBe(340)
    expect(parsearImporte('3,40 €')).toBe(340)
    expect(parsearImporte('1.234,56')).toBe(123456)
    expect(parsearImporte('1234.56')).toBe(123456)
    expect(parsearImporte('12')).toBe(1200)
  })

  it('sabe que 180.000 son ciento ochenta mil, no ciento ochenta', () => {
    expect(parsearImporte('180.000')).toBe(18000000)
    expect(parsearImporte('1.234.567,89')).toBe(123456789)
    expect(parsearImporte('3.40')).toBe(340) // dos decimales: aquí sí es decimal
  })

  it('entiende los negativos como los escriben los bancos', () => {
    expect(parsearImporte('-45,00')).toBe(-4500)
    expect(parsearImporte('45,00-')).toBe(-4500)
    expect(parsearImporte('(45,00)')).toBe(-4500)
  })

  it('devuelve null antes que inventarse un número', () => {
    expect(parsearImporte('')).toBeNull()
    expect(parsearImporte('sin importe')).toBeNull()
    expect(parsearImporte('12,34,56 €uros y pico')).toBeNull()
    expect(parsearImporte(undefined as unknown as string)).toBeNull()
  })
})
