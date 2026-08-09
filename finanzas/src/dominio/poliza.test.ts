import { describe, it, expect } from 'vitest'
import {
  avisosPoliza,
  consumoMedio,
  costePolizasPorMes,
  dispuestoDeCuenta,
  estimarLiquidacion,
  fechasLiquidacion,
  polizaConCuenta,
  situacionPoliza,
} from './poliza'
import { esFichaPoliza, leerPoliza } from './poliza-archivo'
import type { Poliza } from './tipos'

/**
 * Ficha «Cta.créd. bonif. - Datos generales» de CaixaBankNow, con los datos
 * REALES de la póliza que enseñó el usuario. La disposición (rótulo y valor en
 * la misma fila, dos pares por fila) es la de la pantalla del banco.
 */
const FICHA_POLIZA = [
  ['Cta.créd. bonif.- Datos generales'],
  ['Número de contrato:', '9300.02-1897674-50', 'Cuenta relacionada:', '3985 0200365748'],
  ['Capital concedido:', '28.000,00 euros', 'Fecha de constitución:', '21/05/2025'],
  ['1', 'Datos de la cuenta de crédito', 'Importes expresados en euros'],
  ['Capital límite actual:', '28.000,00', 'Saldo disponible:', '11.216,86'],
  ['Saldo del capital dispuesto:', '17.888,98', 'Saldo contable:', '16.783,14'],
  ['Fecha cancelación prevista:', '31/03/2027', 'Importe excedido:', '0,00'],
  ['Interés vigente:', '6,500%', 'Comisión de disponibilidad:', '1,000%'],
  ['Comisión de máximo excedido:', '4,500%'],
  ['Fecha última liquidación:', '31/07/2026', 'Periodicidad de las liquidaciones:', 'MENSUAL'],
  ['Fecha próxima liquidación:', '31/08/2026'],
  ['LIQUIDACIONES'],
]

const polizaReal = (): Poliza => ({
  id: 'p1',
  creadoEn: '2026-08-09T00:00:00.000Z',
  creadoPor: 'test',
  origen: 'PDF',
  entidad: 'CaixaBank',
  numeroContrato: '9300.02-1897674-50',
  limiteConcedido: 28000,
  limiteActual: 28000,
  dispuesto: 17888.98,
  saldoContable: 16783.14,
  importeExcedido: 0,
  tipoInteresDispuesto: 6.5,
  comisionDisponibilidad: 1,
  comisionExcedido: 4.5,
  periodicidadLiquidacion: 'MENSUAL',
  fechaConstitucion: '2025-05-21',
  fechaVencimiento: '2027-03-31',
  fechaUltimaLiquidacion: '2026-07-31',
  fechaProximaLiquidacion: '2026-08-31',
  seRenueva: true,
})

describe('lectura de la ficha de la póliza', () => {
  it('reconoce la ficha', () => {
    expect(esFichaPoliza(FICHA_POLIZA)).toBe(true)
    expect(esFichaPoliza([['Cuotas contratadas:', '48'], ['Matrícula:', '7803NHK']])).toBe(false)
  })

  it('lee los datos con rótulo y valor en la misma fila', () => {
    const d = leerPoliza(FICHA_POLIZA)
    expect(d.numeroContrato).toBe('9300.02-1897674-50')
    expect(d.cuentaRelacionada).toBe('3985 0200365748')
    expect(d.limiteConcedido).toBe(28000)
    expect(d.limiteActual).toBe(28000)
    expect(d.dispuesto).toBe(17888.98)
    expect(d.saldoContable).toBe(16783.14)
    expect(d.saldoDisponible).toBe(11216.86)
    expect(d.importeExcedido).toBe(0)
    expect(d.fechaConstitucion).toBe('2025-05-21')
    expect(d.fechaVencimiento).toBe('2027-03-31')
    expect(d.fechaUltimaLiquidacion).toBe('2026-07-31')
    expect(d.fechaProximaLiquidacion).toBe('2026-08-31')
    expect(d.periodicidadLiquidacion).toBe('MENSUAL')
  })

  it('lee los tres precios de la póliza', () => {
    const d = leerPoliza(FICHA_POLIZA)
    expect(d.tipoInteresDispuesto).toBe(6.5)
    expect(d.comisionDisponibilidad).toBe(1)
    expect(d.comisionExcedido).toBe(4.5)
  })

  it('no avisa de descuadre cuando el disponible del banco cuadra', () => {
    // 28.000,00 − 16.783,14 = 11.216,86: sale de la propia ficha.
    const d = leerPoliza(FICHA_POLIZA)
    expect(d.avisos.some((a) => a.includes('no cuadra'))).toBe(false)
  })

  it('avisa si el disponible impreso no cuadra con el saldo contable', () => {
    const roto = FICHA_POLIZA.map((f) => (f[0] === 'Capital límite actual:' ? ['Capital límite actual:', '28.000,00', 'Saldo disponible:', '9.000,00'] : f))
    expect(leerPoliza(roto).avisos.some((a) => a.includes('no cuadra'))).toBe(true)
  })
})

describe('situación de la póliza', () => {
  it('calcula el disponible con el saldo CONTABLE, como el banco', () => {
    const s = situacionPoliza(polizaReal())
    expect(s.disponible).toBe(11216.86)
    // Con el dispuesto saldría 10.111,02, que no es lo que dice el banco.
    expect(s.disponible).not.toBe(10111.02)
  })

  it('sin saldo contable usa el dispuesto', () => {
    const s = situacionPoliza({ ...polizaReal(), saldoContable: undefined })
    expect(s.disponible).toBe(10111.02)
  })

  it('mide el porcentaje dispuesto sobre el límite', () => {
    expect(situacionPoliza(polizaReal()).porcentajeDispuesto).toBeCloseTo(63.89, 1)
  })
})

describe('coste estimado de la póliza', () => {
  it('cobra el dispuesto al tipo y lo NO dispuesto a la comisión de disponibilidad', () => {
    // 30 días, base 360: 17.888,98 × 6,5 % × 30/360 = 96,90
    //                    10.111,02 × 1,0 % × 30/360 =  8,43
    const l = estimarLiquidacion(polizaReal(), 30, '2026-08-31')
    expect(l.intereses).toBeCloseTo(96.9, 2)
    expect(l.comisionDisponibilidad).toBeCloseTo(8.43, 2)
    expect(l.comisionExcedido).toBe(0)
    expect(l.total).toBeCloseTo(105.33, 2)
  })

  it('cobra la comisión de excedido entera, sin prorratear por días', () => {
    const p = { ...polizaReal(), importeExcedido: 1000 }
    expect(estimarLiquidacion(p, 30, '2026-08-31').comisionExcedido).toBeCloseTo(45, 2)
    expect(estimarLiquidacion(p, 15, '2026-08-31').comisionExcedido).toBeCloseTo(45, 2)
  })

  it('una póliza sin disponer sigue costando dinero', () => {
    const p = { ...polizaReal(), dispuesto: 0, saldoContable: 0 }
    const l = estimarLiquidacion(p, 30, '2026-08-31')
    expect(l.intereses).toBe(0)
    expect(l.comisionDisponibilidad).toBeGreaterThan(0)
  })
})

describe('liquidaciones y presupuesto', () => {
  it('coloca una liquidación en cada mes del ejercicio', () => {
    const fechas = fechasLiquidacion(polizaReal(), 2026)
    expect(fechas.length).toBe(12)
    expect(fechas[0].slice(0, 7)).toBe('2026-01')
    expect(fechas[11].slice(0, 7)).toBe('2026-12')
  })

  it('sin fechas de liquidación las cuenta desde la constitución', () => {
    const sinFechas = { ...polizaReal(), fechaProximaLiquidacion: undefined, fechaUltimaLiquidacion: undefined }
    expect(fechasLiquidacion(sinFechas, 2026).length).toBe(12)
  })

  it('no pasa del vencimiento de la póliza', () => {
    const fechas = fechasLiquidacion(polizaReal(), 2027)
    // Vence el 31/03/2027: no se presupuestan liquidaciones posteriores.
    expect(fechas.every((f) => f <= '2027-03-31')).toBe(true)
    expect(fechas.length).toBe(3)
  })

  it('lleva el coste al presupuesto mes a mes', () => {
    const [linea] = costePolizasPorMes([polizaReal()], 2026)
    expect(linea.meses.filter((m) => m > 0).length).toBe(12)
    expect(linea.totalAnual).toBeGreaterThan(1200)
    expect(linea.mesesDevolucion).toBeUndefined() // se renueva
  })

  it('si NO se renueva, la devolución del dispuesto va aparte y en su mes', () => {
    const [linea] = costePolizasPorMes([{ ...polizaReal(), seRenueva: false }], 2027)
    expect(linea.mesesDevolucion?.[2]).toBe(17888.98) // marzo de 2027
    expect(linea.meses[2]).toBeGreaterThan(0)
  })

  it('una póliza anulada no entra en el presupuesto', () => {
    expect(costePolizasPorMes([{ ...polizaReal(), anuladoEn: '2026-01-01' }], 2026)).toEqual([])
  })
})

describe('avisos de la póliza', () => {
  it('avisa de que lo no dispuesto también cuesta', () => {
    expect(avisosPoliza(polizaReal(), '2026-08-09').some((a) => a.includes('disponibilidad'))).toBe(true)
  })

  it('avisa del excedido y de su comisión', () => {
    const avisos = avisosPoliza({ ...polizaReal(), importeExcedido: 500 }, '2026-08-09')
    expect(avisos.some((a) => a.includes('Excedida'))).toBe(true)
  })

  it('avisa de la renovación cuando se acerca el vencimiento', () => {
    const avisos = avisosPoliza(polizaReal(), '2027-02-01')
    expect(avisos.some((a) => a.includes('Vence en'))).toBe(true)
  })

  it('avisa de que dispuesto y contable no coinciden', () => {
    expect(avisosPoliza(polizaReal(), '2026-08-09').some((a) => a.includes('fecha valor'))).toBe(true)
  })
})

// ─────────── La póliza en cuenta: lo dispuesto sale del saldo negativo ───────────

const cuenta = {
  id: 'c1',
  creadoEn: '2026-01-01T00:00:00.000Z',
  creadoPor: 'test',
  origen: 'MANUAL' as const,
  nombre: 'CaixaBank póliza',
  tipo: 'BANCO' as const,
  saldoInicial: 0,
}

const mov = (fecha: string, importe: number, id = fecha + importe) => ({
  id,
  creadoEn: '2026-01-01T00:00:00.000Z',
  creadoPor: 'test',
  origen: 'MANUAL' as const,
  cuentaId: 'c1',
  fecha,
  concepto: 'x',
  importe,
  clase: 'OTRO' as const,
  conciliado: false,
})

describe('póliza instrumentada en cuenta corriente', () => {
  it('lo dispuesto es el saldo NEGATIVO de la cuenta', () => {
    const movs = [mov('2026-01-10', -10000), mov('2026-03-01', -7888.98)]
    expect(dispuestoDeCuenta(cuenta, movs, '2026-08-09')).toBe(17888.98)
  })

  it('con la cuenta en positivo la póliza no está dispuesta', () => {
    expect(dispuestoDeCuenta(cuenta, [mov('2026-01-10', 5000)], '2026-08-09')).toBe(0)
  })

  it('no cuenta los movimientos posteriores a la fecha', () => {
    const movs = [mov('2026-01-10', -10000), mov('2026-12-01', -5000)]
    expect(dispuestoDeCuenta(cuenta, movs, '2026-06-30')).toBe(10000)
  })

  it('la póliza toma el dispuesto de su cuenta cuando así se configura', () => {
    const p = { ...polizaReal(), origenDispuesto: 'CUENTA' as const, cuentaTesoreriaId: 'c1', dispuesto: 0, saldoContable: undefined }
    const r = polizaConCuenta(p, [cuenta], [mov('2026-01-10', -21000)], '2026-08-09')
    expect(r.dispuesto).toBe(21000)
    expect(situacionPoliza(r).disponible).toBe(7000)
  })

  it('si la cuenta no existe no se pone un 0: se deja lo que hubiera', () => {
    const p = { ...polizaReal(), origenDispuesto: 'CUENTA' as const, cuentaTesoreriaId: 'no-existe' }
    expect(polizaConCuenta(p, [cuenta], [], '2026-08-09').dispuesto).toBe(17888.98)
  })
})

describe('consumo medio del año y renovación', () => {
  it('pondera por días, no por número de movimientos', () => {
    // Todo el año a 14.000 salvo el último día, que sube a 28.000.
    const movs = [mov('2026-01-01', -14000), mov('2026-12-31', -14000, 'b')]
    const c = consumoMedio(cuenta, movs, '2026-01-01', '2026-12-31', 28000)
    expect(c.maximo).toBe(28000)
    // La media apenas se mueve del 50 %: un pico de un día no la dispara.
    expect(c.porcentajeMedio).toBeGreaterThan(49)
    expect(c.porcentajeMedio).toBeLessThan(51)
  })

  it('avisa cuando el consumo MEDIO del año pasa del umbral', () => {
    const p = { ...polizaReal(), dispuesto: 5000, saldoContable: 5000 }
    const consumo = consumoMedio(cuenta, [mov('2026-01-01', -25000)], '2026-01-01', '2026-12-31', 28000)
    const avisos = avisosPoliza(p, '2026-08-09', consumo)
    expect(avisos.some((a) => a.includes('MEDIO'))).toBe(true)
  })

  it('no avisa si la media queda por debajo del umbral, aunque hoy esté alta', () => {
    const consumo = consumoMedio(cuenta, [mov('2026-01-01', -5000)], '2026-01-01', '2026-12-31', 28000)
    expect(avisosPoliza(polizaReal(), '2026-08-09', consumo).some((a) => a.includes('MEDIO'))).toBe(false)
  })

  it('el umbral de aviso es configurable', () => {
    // Al 63,9 % de consumo, con umbral 60 avisa y con el 75 por defecto no.
    expect(avisosPoliza({ ...polizaReal(), umbralAviso: 60 }, '2026-08-09').some((a) => a.includes('Consumida'))).toBe(true)
    expect(avisosPoliza(polizaReal(), '2026-08-09').some((a) => a.includes('Consumida'))).toBe(false)
  })
})
