import { describe, it, expect } from 'vitest'
import { parsearCSV, detectarSeparador } from './csv'

describe('parser CSV', () => {
  it('detecta punto y coma (habitual en España)', () => {
    expect(detectarSeparador('a;b;c\n1;2;3')).toBe(';')
    expect(detectarSeparador('a,b,c\n1,2,3')).toBe(',')
    expect(detectarSeparador('a\tb\tc')).toBe('\t')
  })
  it('parsea filas y columnas', () => {
    const m = parsearCSV('ref;nombre;pvp\nA1;Camiseta;9,99\nA2;Gorra;5,00')
    expect(m).toHaveLength(3)
    expect(m[1]).toEqual(['A1', 'Camiseta', '9,99'])
  })
  it('respeta comillas y comas internas', () => {
    const m = parsearCSV('a,b\n"Hola, mundo","dice ""hola"""')
    expect(m[1]).toEqual(['Hola, mundo', 'dice "hola"'])
  })
  it('ignora filas vacías', () => {
    expect(parsearCSV('a;b\n\n1;2\n\n')).toHaveLength(2)
  })
})
