/**
 * Regresión con extractos REALES de CaixaBank de la misma cuenta. Los dos
 * ficheros del banco usan convenciones distintas y ambos se leían mal:
 *  · El Excel viene en formato anglosajón (3,000.00) → daba 3 € en vez de 3.000 €.
 *  · El PDF trae el mes en letra (1 Jul 2026), el signo separado (- 30,00 €)
 *    y cada celda dibujada dos veces.
 */
import { describe, it, expect } from 'vitest'
import { leerHoja, lineasAMovimientos, totalExtracto } from './extracto'

const HOJA: string[][] = [
  ['Movimientos de la cuenta ES52 2100 3985 5402 0041 5958 (CCC: 2100 3985 54 02 00415958)', '', '', '', '', ''],
  ['Importes expresados en euros', '', '', '', '', ''],
  ['Fecha', 'Fecha valor', 'Movimiento', 'Más datos', 'Importe', 'Saldo'],
  ['01/07/2026', '01/07/2026', 'MANTENIMIENTO', '', '-30.00', '3,908.50'],
  ['24/04/2026', '24/04/2026', 'MANTENIMIENTO', '', '30.00', '3,938.50'],
  ['08/04/2026', '08/04/2026', 'prestamo', 'andrew nieto lopez', '-1,050.00', '3,908.50'],
  ['30/12/2025', '30/12/2025', 'TRASPASO', '', '3,000.00', '5,000.00'],
  ['15/12/2025', '15/12/2025', 'COMPRA CBRFCPES', '', '-8,000.00', '0.00'],
]

const LINEAS = [
  '1 Jul 2026 MANTENIMIENTO - 30,00 € + 3.908,50 €',
  '8 Abr 2026 prestamo andrew nieto lopez - 1.050,00 € + 3.908,50 €',
  '30 Dic 2025 TRASPASO + 3.000,00 € + 5.000,00 €',
  '15 Dic 2025 COMPRA CBRFCPES - 8.000,00 € + 0,00 €',
]

describe('EXCEL real de CaixaBank (formato anglosajón)', () => {
  const r = leerHoja(HOJA)!.resultado
  it('lee los importes de miles correctamente', () => {
    expect(r.movimientos.map((m) => m.importe)).toEqual([-30, 30, -1050, 3000, -8000])
  })
  it('lee las fechas', () => {
    expect(r.movimientos[0].fecha).toBe('2026-07-01')
    expect(r.movimientos[4].fecha).toBe('2025-12-15')
  })
  it('añade «Más datos» al concepto', () => {
    expect(r.movimientos[2].concepto).toBe('prestamo · andrew nieto lopez')
  })
  it('no descarta ninguna fila', () => {
    expect(r.descartadas).toEqual([])
  })
})

describe('PDF real de CaixaBank (formato español, signo separado, mes en letra)', () => {
  const r = lineasAMovimientos(LINEAS)
  it('lee los cuatro movimientos', () => {
    expect(r.movimientos).toHaveLength(4)
    expect(r.descartadas).toEqual([])
  })
  it('lee importe y no el saldo', () => {
    expect(r.movimientos.map((m) => m.importe)).toEqual([-30, -1050, 3000, -8000])
  })
  it('lee las fechas con el mes en letra', () => {
    expect(r.movimientos.map((m) => m.fecha)).toEqual(['2026-07-01', '2026-04-08', '2025-12-30', '2025-12-15'])
  })
  it('lee el concepto completo', () => {
    expect(r.movimientos[1].concepto).toBe('prestamo andrew nieto lopez')
  })
})

describe('Excel y PDF de la misma cuenta coinciden', () => {
  it('los movimientos comunes dan el mismo importe pese al formato distinto', () => {
    const excel = leerHoja(HOJA)!.resultado.movimientos
    const pdf = lineasAMovimientos(LINEAS).movimientos
    for (const m of pdf) {
      const igual = excel.find((e) => e.fecha === m.fecha)
      expect(igual?.importe).toBe(m.importe)
    }
    expect(totalExtracto(pdf)).toBe(-6080)
  })
})
