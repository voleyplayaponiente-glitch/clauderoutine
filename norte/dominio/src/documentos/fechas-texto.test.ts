import { describe, expect, it } from 'vitest'
import { fechaDeSerieExcel, leerFecha } from './fechas-texto.js'

describe('leer fechas de un documento', () => {
  it('entiende las tres formas que traían los extractos reales', () => {
    expect(leerFecha('18/08/2026')).toBe('2026-08-18')
    expect(leerFecha('19 Agosto 2026')).toBe('2026-08-19')
    expect(leerFecha('2026-08-18')).toBe('2026-08-18')
  })

  it('acepta las variantes de separador y de año corto', () => {
    expect(leerFecha('01-08-26')).toBe('2026-08-01')
    expect(leerFecha('01.08.1998')).toBe('1998-08-01')
    expect(leerFecha('19 de agosto de 2026')).toBe('2026-08-19')
  })

  it('convierte el número de serie de Excel, que es como llegan las hojas antiguas', () => {
    // El 1 de enero de 2026 es el día 46023 en la cuenta de Excel.
    expect(fechaDeSerieExcel(46023)).toBe('2026-01-01')
    expect(leerFecha(46023)).toBe('2026-01-01')
  })

  it('no toma un importe por una fecha', () => {
    expect(leerFecha(1234.56)).toBeNull()
    expect(leerFecha(-80)).toBeNull()
  })

  it('rechaza un día que no existe en vez de correrlo al mes siguiente', () => {
    expect(leerFecha('31/02/2026')).toBeNull()
    expect(leerFecha('00/08/2026')).toBeNull()
  })

  it('devuelve null cuando no lo sabe', () => {
    expect(leerFecha('')).toBeNull()
    expect(leerFecha('Transferencia realizada')).toBeNull()
    expect(leerFecha(null)).toBeNull()
  })
})
