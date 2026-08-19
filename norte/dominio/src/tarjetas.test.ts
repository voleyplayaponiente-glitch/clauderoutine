import { describe, expect, it } from 'vitest'
import { cicloDe, ErrorTarjeta, simularAplazado, sobrecosteDeAplazar, utilizacion } from './tarjetas.js'

/**
 * Como en los préstamos, las cifras del aplazado están calculadas aparte con
 * aritmética decimal exacta. Comprobar el código contra sí mismo no prueba
 * nada.
 */

describe('el ciclo de la tarjeta', () => {
  const CONFIG = { diaCorte: 25, diaPago: 5 }

  it('con corte el 25 y pago el 5, lo de hoy se paga el 5 del mes que viene', () => {
    const { actual } = cicloDe(CONFIG, new Date(2026, 7, 19))
    expect(actual).toEqual({ desde: '2026-07-26', hasta: '2026-08-25', fechaPago: '2026-09-05' })
  })

  it('pasado el corte, el ciclo en curso ya es el del mes siguiente', () => {
    const { actual, anterior } = cicloDe(CONFIG, new Date(2026, 7, 26))
    expect(actual.hasta).toBe('2026-09-25')
    // El de agosto queda cerrado y pendiente de cobro.
    expect(anterior).toEqual({ desde: '2026-07-26', hasta: '2026-08-25', fechaPago: '2026-09-05' })
  })

  it('cuenta los días de financiación gratis de una compra de hoy', () => {
    // Comprar el 26 de julio (justo tras el corte) da el máximo: hasta el 5 de
    // septiembre son 41 días sin intereses.
    expect(cicloDe(CONFIG, new Date(2026, 6, 26)).diasGratisSiComprasHoy).toBe(41)
    // Comprar el día del corte da el mínimo.
    expect(cicloDe(CONFIG, new Date(2026, 7, 25)).diasGratisSiComprasHoy).toBe(11)
  })

  it('con el pago después del corte, el recibo es del mismo mes', () => {
    const { actual } = cicloDe({ diaCorte: 5, diaPago: 25 }, new Date(2026, 7, 3))
    expect(actual).toEqual({ desde: '2026-07-06', hasta: '2026-08-05', fechaPago: '2026-08-25' })
  })

  it('un corte el 31 cae el último día de los meses que no lo tienen', () => {
    const { actual } = cicloDe({ diaCorte: 31, diaPago: 10 }, new Date(2026, 1, 15))
    expect(actual.hasta).toBe('2026-02-28')
  })

  it('rechaza un día que no existe en vez de calcular con él', () => {
    expect(() => cicloDe({ diaCorte: 0, diaPago: 5 }, new Date())).toThrow(ErrorTarjeta)
    expect(() => cicloDe({ diaCorte: 25, diaPago: 32 }, new Date())).toThrow(ErrorTarjeta)
  })
})

describe('la utilización', () => {
  it('es lo dispuesto sobre el límite', () => {
    expect(utilizacion(90_000, 300_000)).toBe(30)
    expect(utilizacion(0, 300_000)).toBe(0)
  })

  it('sin límite no divide por cero', () => {
    expect(utilizacion(5_000, 0)).toBe(0)
  })
})

describe('el pago aplazado', () => {
  it('3.000 € al 24 % con 100 € al mes: 47 meses y 1.627,30 € de intereses', () => {
    const simulacion = simularAplazado({ saldo: 300_000, tinAnual: 24, cuotaFija: 10_000 })
    expect(simulacion.meses).toBe(47)
    expect(simulacion.interesTotal).toBe(162_730)
    expect(simulacion.pagadoTotal).toBe(462_730)
  })

  it('el mínimo del 3 % con suelo de 30 € estira la deuda a más de trece años', () => {
    // Este es EL número del revolving. 3.000 € de compras acaban costando
    // 7.436,34 €, y son trece años pagando.
    const simulacion = simularAplazado({
      saldo: 300_000,
      tinAnual: 24,
      minimoPorcentaje: 3,
      minimoSuelo: 3_000,
    })
    expect(simulacion.meses).toBe(159)
    expect(simulacion.pagadoTotal).toBe(743_634)
    expect(simulacion.porCadaEuro).toBeCloseTo(2.48, 2)
  })

  it('el interés se devenga antes de calcular el mínimo, como en el contrato', () => {
    // 3 % de 3.000 € son 90 €, pero el mínimo real del primer mes son 91,80:
    // el porcentaje se aplica sobre el saldo ya con intereses.
    const simulacion = simularAplazado({
      saldo: 300_000,
      tinAnual: 24,
      minimoPorcentaje: 3,
      minimoSuelo: 3_000,
    })
    expect(simulacion.primeraCuota).toBe(9_180)
  })

  it('cuando la cuota no supera al interés dice «nunca», no un número enorme', () => {
    const simulacion = simularAplazado({ saldo: 300_000, tinAnual: 24, cuotaFija: 6_000 })
    expect(simulacion.meses).toBeNull()
    expect(simulacion.nuncaSeLiquida).toBe(true)
    // Y dice cuánto haría falta para que empiece a bajar.
    expect(simulacion.cuotaMinimaViable).toBe(6_001)
  })

  it('1.000 € al 20 % con 50 € al mes: 25 meses y 226,63 €', () => {
    const simulacion = simularAplazado({ saldo: 100_000, tinAnual: 20, cuotaFija: 5_000 })
    expect(simulacion.meses).toBe(25)
    expect(simulacion.interesTotal).toBe(22_663)
  })

  it('sin cuota ni porcentaje se niega a simular en vez de inventarse uno', () => {
    expect(() => simularAplazado({ saldo: 100_000, tinAnual: 20 })).toThrow(ErrorTarjeta)
  })

  it('el sobrecoste es lo que cuesta de más por las mismas compras', () => {
    const { sobrecoste } = sobrecosteDeAplazar({ saldo: 300_000, tinAnual: 24, cuotaFija: 10_000 })
    expect(sobrecoste).toBe(162_730)
  })
})
