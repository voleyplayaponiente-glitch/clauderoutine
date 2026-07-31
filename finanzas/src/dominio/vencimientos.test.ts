import { describe, it, expect } from 'vitest'
import { clasificarTramo, agruparPorTramo, diasVencido, provisionSugerida } from './vencimientos'

const HOY = '2026-07-30'

describe('clasificación por tramos', () => {
  it('distingue vencido, corto y largo plazo', () => {
    expect(clasificarTramo('2026-07-01', HOY)).toBe('VENCIDO')
    expect(clasificarTramo('2026-08-10', HOY)).toBe('D0_30')
    expect(clasificarTramo('2026-09-15', HOY)).toBe('D31_60')
    expect(clasificarTramo('2026-10-20', HOY)).toBe('D61_90')
    expect(clasificarTramo('2026-12-01', HOY)).toBe('D90_MAS')
    expect(clasificarTramo('2028-01-01', HOY)).toBe('LARGO_PLAZO')
    expect(clasificarTramo(undefined, HOY)).toBe('LARGO_PLAZO')
  })
  it('agrupa importes por tramo', () => {
    const g = agruparPorTramo([
      { importe: 100, fechaVencimiento: '2026-07-01' },
      { importe: 50, fechaVencimiento: '2026-07-10' },
      { importe: 200, fechaVencimiento: '2026-08-10' },
    ], HOY)
    expect(g.VENCIDO).toBe(150)
    expect(g.D0_30).toBe(200)
  })
})

describe('antigüedad y provisión', () => {
  it('calcula los días vencido', () => {
    expect(diasVencido('2026-07-20', HOY)).toBe(10)
    expect(diasVencido('2026-08-30', HOY)).toBe(0)
  })
  it('propone provisión escalonada por antigüedad', () => {
    expect(provisionSugerida(1000, 200, 30)).toBe(1000) // >180 → 100 %
    expect(provisionSugerida(1000, 120, 30)).toBe(500) // >90 → 50 %
    expect(provisionSugerida(1000, 45, 30)).toBe(250) // >umbral → 25 %
    expect(provisionSugerida(1000, 10, 30)).toBe(0)
  })
})
