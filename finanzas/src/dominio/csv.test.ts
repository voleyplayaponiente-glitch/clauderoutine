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

describe('separador: el principio del fichero puede engañar', () => {
  it('no se deja engañar por un título entrecomillado de varias líneas', () => {
    // Caso real de Square: la primera línea es el principio de un campo
    // entrecomillado y no lleva ningún separador. Mirando solo esa línea
    // ganaba el «;» por descarte y todo el CSV quedaba en una sola columna.
    const square = '"Resumen de ventas\nTodo el día",domingo,lunes\nVentas netas,"541,68 €","773,08 €"\n'
    expect(detectarSeparador(square)).toBe(',')
    expect(parsearCSV(square)[1]).toEqual(['Ventas netas', '541,68 €', '773,08 €'])
  })

  it('las comas decimales de dentro de las comillas no cuentan como separador', () => {
    const es = 'Fecha;Importe\n01/08/2026;"1.234,56"\n02/08/2026;"2.000,00"\n'
    expect(detectarSeparador(es)).toBe(';')
  })
})
