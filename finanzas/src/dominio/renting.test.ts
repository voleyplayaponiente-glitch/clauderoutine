import { describe, it, expect } from 'vitest'
import { avisosRenting, cuadroRenting, cuotasRentingPorMes, resumenRenting } from './renting'
import type { Renting } from './tipos'

/** El renting real del usuario: RENAULT Clio, 319 €/mes, 48 meses, IVA 21 %. */
const clio = (): Renting => ({
  id: 'r1',
  creadoEn: '2026-08-09T00:00:00.000Z',
  creadoPor: 'test',
  origen: 'PDF',
  arrendador: 'CaixaBank',
  numeroContrato: '6800.71.0338566-83',
  descripcion: 'RENAULT Clio / 2023',
  matricula: '7803NHK',
  cuotaBase: 319,
  tipoIva: 21,
  periodicidad: 'MENSUAL',
  nCuotas: 48,
  fechaInicio: '2025-11-26',
  fechaFin: '2029-11-25',
  cuotasFacturadas: 10,
})

describe('cuadro de cuotas del renting', () => {
  it('todas las cuotas son iguales: no hay intereses ni amortización', () => {
    const cuadro = cuadroRenting(clio())
    expect(cuadro.length).toBe(48)
    expect(new Set(cuadro.map((c) => c.base)).size).toBe(1)
    expect(cuadro[0].base).toBe(319)
    expect(cuadro[47].base).toBe(319)
  })

  it('añade el IVA de la cuota', () => {
    const [primera] = cuadroRenting(clio())
    expect(primera.iva).toBe(66.99)
    expect(primera.total).toBe(385.99)
  })

  it('respeta un tipo de IVA distinto sin dar por supuesto el 21 %', () => {
    const [primera] = cuadroRenting({ ...clio(), tipoIva: 10 })
    expect(primera.iva).toBe(31.9)
    expect(primera.total).toBe(350.9)
  })

  it('la primera cuota vence un mes después de la contratación', () => {
    const cuadro = cuadroRenting(clio())
    expect(cuadro[0].fecha).toBe('2025-12-26')
    expect(cuadro[47].fecha).toBe('2029-11-26')
  })

  it('sin cuota o sin plazo no inventa un cuadro', () => {
    expect(cuadroRenting({ ...clio(), cuotaBase: 0 })).toEqual([])
    expect(cuadroRenting({ ...clio(), nCuotas: 0 })).toEqual([])
  })
})

describe('resumen del renting', () => {
  it('separa lo devengado de lo comprometido, y la caja del gasto', () => {
    const r = resumenRenting(clio(), '2026-08-09')
    // Cuotas del 26/12/2025 al 26/07/2026: ocho vencidas.
    expect(r.pagadas).toBe(8)
    expect(r.pendientes).toBe(40)
    expect(r.gastoPagado).toBe(2552) // 8 × 319
    expect(r.compromisoPendiente).toBe(12760) // 40 × 319, sin IVA
    expect(r.cajaPendiente).toBe(15439.6) // 40 × 385,99, con IVA
    expect(r.costeTotal).toBe(15312) // 48 × 319
  })
})

describe('avisos del renting', () => {
  it('avisa si las cuotas facturadas por el banco no cuadran con las fechas', () => {
    // Caso REAL: el banco dice 10 facturadas y por fechas salen 8, porque cobra
    // el día 1 y no el día de la firma. Merece un aviso, no un apaño silencioso.
    const avisos = avisosRenting(clio(), '2026-08-09')
    expect(avisos.some((a) => a.includes('facturadas'))).toBe(true)
  })

  it('no molesta cuando la diferencia es de una cuota (el recibo en curso)', () => {
    const avisos = avisosRenting({ ...clio(), cuotasFacturadas: 9 }, '2026-08-09')
    expect(avisos.some((a) => a.includes('facturadas'))).toBe(false)
  })

  it('avisa cuando se acerca la devolución del vehículo', () => {
    const avisos = avisosRenting(clio(), '2029-09-30')
    expect(avisos.some((a) => a.includes('devolución'))).toBe(true)
  })

  it('recuerda el kilometraje contratado', () => {
    const avisos = avisosRenting({ ...clio(), kmContratados: 40000 }, '2026-08-09')
    expect(avisos.some((a) => a.includes('40.000 km'))).toBe(true)
  })
})

describe('renting → presupuesto', () => {
  it('reparte la cuota por meses, con y sin IVA', () => {
    const [linea] = cuotasRentingPorMes([clio()], 2026)
    expect(linea.meses.every((m) => m === 319)).toBe(true)
    expect(linea.totalAnual).toBe(3828) // 12 × 319
    expect(linea.totalAnualConIva).toBe(4631.88) // 12 × 385,99
  })

  it('solo cuenta los meses del ejercicio en que hay cuota', () => {
    const [linea] = cuotasRentingPorMes([clio()], 2025)
    expect(linea.meses.filter((m) => m > 0).length).toBe(1) // solo diciembre
    expect(linea.meses[11]).toBe(319)
  })

  it('un renting anulado no entra en el presupuesto', () => {
    expect(cuotasRentingPorMes([{ ...clio(), anuladoEn: '2026-01-01' }], 2026)).toEqual([])
  })

  it('no agrupa: cada contrato es una línea', () => {
    const lineas = cuotasRentingPorMes([clio(), { ...clio(), id: 'r2', matricula: '1234ABC' }], 2026)
    expect(lineas.length).toBe(2)
  })
})
