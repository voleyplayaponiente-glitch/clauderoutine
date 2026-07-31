import { describe, it, expect } from 'vitest'
import { comprobarCuadre, validarAsiento, saldoCuenta, type Apunte } from './partida-doble'

describe('partida doble', () => {
  it('un asiento cuadrado da diferencia 0', () => {
    const apuntes: Apunte[] = [
      { cuenta: '570', debe: 121, haber: 0 },
      { cuenta: '700', debe: 0, haber: 100 },
      { cuenta: '477', debe: 0, haber: 21 },
    ]
    const r = comprobarCuadre(apuntes)
    expect(r.cuadra).toBe(true)
    expect(r.diferencia).toBe(0)
    expect(r.totalDebe).toBe(121)
  })
  it('detecta el descuadre y da la diferencia exacta', () => {
    const r = comprobarCuadre([
      { cuenta: '570', debe: 121, haber: 0 },
      { cuenta: '700', debe: 0, haber: 100 },
    ])
    expect(r.cuadra).toBe(false)
    expect(r.diferencia).toBe(21)
  })
  it('validarAsiento lanza si no cuadra', () => {
    expect(() =>
      validarAsiento({
        fecha: '2026-01-01',
        concepto: 'Venta',
        apuntes: [
          { cuenta: '570', debe: 121, haber: 0 },
          { cuenta: '700', debe: 0, haber: 120 },
        ],
      }),
    ).toThrow(/descuadrado/)
  })
  it('rechaza importes negativos y debe+haber a la vez', () => {
    expect(() => comprobarCuadre([{ cuenta: '570', debe: -1, haber: 0 }])).toThrow()
    expect(() => comprobarCuadre([{ cuenta: '570', debe: 5, haber: 5 }])).toThrow()
  })
  it('calcula el saldo deudor de una cuenta', () => {
    const apuntes: Apunte[] = [
      { cuenta: '570', debe: 121, haber: 0 },
      { cuenta: '570', debe: 0, haber: 21 },
    ]
    expect(saldoCuenta('570', apuntes)).toBe(100)
  })
})
