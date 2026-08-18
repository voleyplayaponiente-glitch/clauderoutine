import { describe, expect, it } from 'vitest'
import { resumir, saldoDeCuenta, saldoProyectado, tasaDeAhorro, validarMovimiento } from './movimientos.js'

const HOY = new Date(2026, 7, 18)
const base = { importe: -340, fecha: '2026-08-18', concepto: 'Café', cuentaId: 'c1' }

describe('validar', () => {
  it('acepta un movimiento normal', () => {
    expect(validarMovimiento(base, HOY)).toEqual({ valido: true })
  })

  it('exige concepto y cuenta', () => {
    expect(validarMovimiento({ ...base, concepto: '   ' }, HOY)).toMatchObject({ campo: 'concepto' })
    expect(validarMovimiento({ ...base, cuentaId: '' }, HOY)).toMatchObject({ campo: 'cuentaId' })
  })

  it('rechaza el importe cero, que solo esconde un error', () => {
    expect(validarMovimiento({ ...base, importe: 0 }, HOY)).toMatchObject({
      campo: 'importe',
      mensaje: 'El importe no puede ser cero.',
    })
  })

  it('rechaza importes que no son céntimos enteros', () => {
    expect(validarMovimiento({ ...base, importe: 3.4 }, HOY)).toMatchObject({ campo: 'importe' })
  })

  it('acepta fechas futuras cercanas —lo previsto— pero no un año de dedo', () => {
    expect(validarMovimiento({ ...base, fecha: '2026-12-31' }, HOY).valido).toBe(true)
    expect(validarMovimiento({ ...base, fecha: '2206-08-18' }, HOY)).toMatchObject({ campo: 'fecha' })
    expect(validarMovimiento({ ...base, fecha: '1999-01-01' }, HOY)).toMatchObject({ campo: 'fecha' })
  })

  it('rechaza una fecha con formato raro', () => {
    expect(validarMovimiento({ ...base, fecha: '18/08/2026' }, HOY)).toMatchObject({ campo: 'fecha' })
  })
})

describe('saldo', () => {
  const movimientos = [
    { importe: -1000, estado: 'confirmado' as const },
    { importe: 250000, estado: 'confirmado' as const },
    { importe: -60000, estado: 'previsto' as const },
  ]

  it('no cuenta lo previsto: si no, no cuadraría con el banco', () => {
    expect(saldoDeCuenta(100000, movimientos)).toBe(349000)
  })

  it('la proyección sí lo cuenta, y es otra cifra distinta', () => {
    expect(saldoProyectado(100000, movimientos)).toBe(289000)
  })

  it('una cuenta sin movimientos vale su saldo inicial', () => {
    expect(saldoDeCuenta(50000, [])).toBe(50000)
  })
})

describe('resumen del periodo', () => {
  it('separa ingresos de gastos y devuelve los gastos en positivo', () => {
    const resumen = resumir([
      { importe: 240000, estado: 'confirmado' },
      { importe: -45000, estado: 'confirmado' },
      { importe: -12500, estado: 'confirmado' },
    ])
    expect(resumen).toEqual({
      ingresos: 240000,
      gastos: 57500,
      balance: 182500,
      previsto: { ingresos: 0, gastos: 0 },
    })
  })

  it('lo previsto va aparte y NO se suma a lo gastado', () => {
    // Decir «has gastado 1.703 €» cuando 1.700 son el alquiler del mes que
    // viene es mentir, y además contradice al saldo, que sí los excluye.
    const resumen = resumir([
      { importe: -340, estado: 'confirmado' },
      { importe: -85000, estado: 'previsto' },
      { importe: 240000, estado: 'confirmado' },
      { importe: 100000, estado: 'previsto' },
    ])
    expect(resumen.gastos).toBe(340)
    expect(resumen.ingresos).toBe(240000)
    expect(resumen.balance).toBe(239660)
    expect(resumen.previsto).toEqual({ ingresos: 100000, gastos: 85000 })
  })

  it('la tasa de ahorro sale del resumen', () => {
    expect(
      tasaDeAhorro({ ingresos: 240000, gastos: 180000, balance: 60000, previsto: { ingresos: 0, gastos: 0 } }),
    ).toBeCloseTo(0.25)
  })

  it('sin ingresos la tasa no es 0 %, es que no se puede calcular', () => {
    // Devolver 0 aquí pintaría un semáforo rojo sobre una división por cero.
    expect(
      tasaDeAhorro({ ingresos: 0, gastos: 50000, balance: -50000, previsto: { ingresos: 0, gastos: 0 } }),
    ).toBeNull()
  })
})
