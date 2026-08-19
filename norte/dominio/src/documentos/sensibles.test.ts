import { describe, expect, it } from 'vitest'
import { buscarIban, enmascararSensibles, pareceTarjeta } from './sensibles.js'

describe('enmascarar datos sensibles', () => {
  it('tapa una tarjeta escrita del tirón dentro del concepto', () => {
    // La forma exacta en la que un extracto real trae la recarga: número
    // completo, un contrato y un secuencial detrás, todo en la misma celda.
    const { texto, tarjetas } = enmascararSensibles('Recarga de tarjetas prepago 4532015112830366 01827013 716')
    expect(texto).toBe('Recarga de tarjetas prepago **** 0366 01827013 716')
    expect(tarjetas).toEqual(['0366'])
  })

  it('tapa una tarjeta escrita en grupos de cuatro', () => {
    const { texto } = enmascararSensibles('Compra 4532 0151 1283 0366 en un comercio')
    expect(texto).toBe('Compra **** 0366 en un comercio')
  })

  it('no toca un número largo que no es una tarjeta', () => {
    // «Adeudo nº 2026215000596874» tiene 16 dígitos y no es una tarjeta. Si el
    // lector lo censurase, el concepto perdería la única referencia útil.
    const { texto, tarjetas } = enmascararSensibles('Adeudo iberia cards · Adeudo nº 2026215000596874')
    expect(texto).toBe('Adeudo iberia cards · Adeudo nº 2026215000596874')
    expect(tarjetas).toEqual([])
  })

  it('deja el IBAN en cuatro cifras', () => {
    const { texto, ibanes } = enmascararSensibles('Traspaso a ES9121000418450200051332')
    expect(texto).toBe('Traspaso a ES** **** 1332')
    expect(ibanes).toEqual(['1332'])
  })

  it('encuentra el IBAN de la cabecera aunque venga con espacios', () => {
    expect(buscarIban('IBAN: ES91 2100 0418 4502 0005 1332')).toBe('ES9121000418450200051332')
  })

  it('reconoce una tarjeta por Luhn y no por longitud', () => {
    expect(pareceTarjeta('4532015112830366')).toBe(true)
    expect(pareceTarjeta('4532015112830367')).toBe(false)
    // Empieza por 0: no hay ninguna red de tarjetas ahí.
    expect(pareceTarjeta('0182445301083013')).toBe(false)
  })
})
