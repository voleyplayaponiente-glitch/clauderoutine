import { describe, it, expect } from 'vitest'
import { parsearNumeroEs, exigirNumeroEs, detectarConvencionNumerica, parsearImporte } from './parseo-es'

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

describe('convención numérica de los ficheros bancarios', () => {
  it('deduce el formato anglosajón del Excel de CaixaBank', () => {
    expect(detectarConvencionNumerica(['-30.00', '3,000.00', '-8,000.00', '600.00'])).toBe('EN')
  })
  it('deduce el formato español del PDF de la misma cuenta', () => {
    expect(detectarConvencionNumerica(['- 30,00 €', '+ 3.000,00 €', '- 8.000,00 €'])).toBe('ES')
  })
  it('sin pistas devuelve AUTO', () => {
    expect(detectarConvencionNumerica(['30', '600', ''])).toBe('AUTO')
    expect(detectarConvencionNumerica([])).toBe('AUTO')
  })
})

describe('parseo de importes bancarios', () => {
  it('con los dos separadores manda el de la derecha', () => {
    expect(parsearImporte('3,000.00')).toBe(3000)
    expect(parsearImporte('3.000,00')).toBe(3000)
    expect(parsearImporte('-1,050.00')).toBe(-1050)
    expect(parsearImporte('-1.050,00')).toBe(-1050)
    expect(parsearImporte('1,234,567.89')).toBe(1234567.89)
  })

  it('el caso que rompía: el Excel de CaixaBank en anglosajón', () => {
    // Con la heurística española estos daban 3, -8 y -1,05.
    expect(parsearImporte('3,000.00', 'EN')).toBe(3000)
    expect(parsearImporte('-8,000.00', 'EN')).toBe(-8000)
    expect(parsearImporte('-1,050.00', 'EN')).toBe(-1050)
    expect(parsearImporte('-30.00', 'EN')).toBe(-30)
    expect(parsearImporte('-5.50', 'EN')).toBe(-5.5)
  })

  it('con un solo separador aplica la convención indicada', () => {
    expect(parsearImporte('1.500', 'EN')).toBe(1.5)
    expect(parsearImporte('1.500', 'ES')).toBe(1500)
    expect(parsearImporte('1,500', 'EN')).toBe(1500)
    expect(parsearImporte('1,500', 'ES')).toBe(1.5)
  })

  it('admite el signo separado y el euro, como en el PDF', () => {
    expect(parsearImporte('- 30,00 €')).toBe(-30)
    expect(parsearImporte('+ 3.908,50 €')).toBe(3908.5)
    expect(parsearImporte('+ 0,00 €')).toBe(0)
  })

  it('admite paréntesis contables', () => {
    expect(parsearImporte('(1.234,56)')).toBe(-1234.56)
  })

  it('sin convención cae en la heurística española', () => {
    expect(parsearImporte('180.000')).toBe(180000)
    expect(parsearImporte('180,5')).toBe(180.5)
  })

  it('no inventa nada con lo que no es número', () => {
    expect(parsearImporte('L0431-L0422/2026')).toBeNull()
    expect(parsearImporte('')).toBeNull()
    expect(parsearImporte(null)).toBeNull()
    expect(parsearImporte('€')).toBeNull()
  })

  it('un número ya numérico pasa tal cual', () => {
    expect(parsearImporte(-1050)).toBe(-1050)
  })
})
