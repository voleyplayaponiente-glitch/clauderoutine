import { describe, it, expect } from 'vitest'
import { cuadroDeuda, pendienteDeuda, resumenFinanciacion } from './financiacion'
import { esAplazamiento, leerAplazamiento } from './aplazamiento-aeat'
import { avisosTarjeta, costeAnualTarjeta, gastoDelMes, situacionTarjeta } from './tarjeta-credito'
import type { Deuda, Poliza, Renting, TarjetaCredito } from './tipos'

const meta = { creadoEn: '2026-01-01T00:00:00.000Z', creadoPor: 'test', origen: 'MANUAL' as const }

const prestamo: Deuda = {
  id: 'd1', ...meta, tipo: 'PRESTAMO', acreedor: 'BBVA', importeOriginal: 12000, tipoInteres: 0,
  periodicidad: 'MENSUAL', nPeriodos: 12, sistema: 'LINEAL', fechaInicio: '2026-01-01', esVinculada: false,
}
const poliza: Poliza = {
  id: 'p1', ...meta, entidad: 'CaixaBank', limiteConcedido: 28000, limiteActual: 28000, dispuesto: 17888.98,
  tipoInteresDispuesto: 6.5, comisionDisponibilidad: 1, periodicidadLiquidacion: 'MENSUAL',
  fechaConstitucion: '2025-05-21', seRenueva: true,
}
const renting: Renting = {
  id: 'r1', ...meta, arrendador: 'CaixaBank', descripcion: 'Clio', cuotaBase: 319, tipoIva: 21,
  periodicidad: 'MENSUAL', nCuotas: 48, fechaInicio: '2025-11-26',
}
const tarjeta: TarjetaCredito = {
  id: 't1', ...meta, entidad: 'Bankinter', alias: 'Bankinter empresa', limite: 6000, dispuesto: 1500,
  modalidad: 'FIN_DE_MES',
}

describe('resumen de toda la financiación', () => {
  const r = resumenFinanciacion({ deudas: [prestamo], polizas: [poliza], rentings: [renting], tarjetasCredito: [tarjeta] }, '2026-08-09')

  it('da un total por bloque', () => {
    const de = (b: string) => r.bloques.find((x) => x.bloque === b)!
    expect(de('PRESTAMOS').importe).toBe(5000) // 12.000 en 12 meses, 7 pagadas
    expect(de('POLIZAS').importe).toBe(17888.98)
    expect(de('TARJETAS').importe).toBe(1500)
    expect(de('RENTING').importe).toBe(12760) // 40 cuotas × 319, sin IVA
  })

  it('suma préstamos, pólizas, tarjetas y renting en la deuda bancaria', () => {
    expect(r.totalBancaria).toBe(37148.98)
  })

  it('marca el renting como compromiso, no como deuda del balance', () => {
    expect(r.bloques.find((b) => b.bloque === 'RENTING')!.esCompromiso).toBe(true)
    expect(r.bloques.find((b) => b.bloque === 'POLIZAS')!.esCompromiso).toBeUndefined()
  })

  it('separa la deuda no bancaria y la suma aparte en el total', () => {
    const hacienda: Deuda = { ...prestamo, id: 'd2', tipo: 'HACIENDA', acreedor: 'AEAT', importeOriginal: 6000, nPeriodos: 12 }
    const r2 = resumenFinanciacion({ deudas: [prestamo, hacienda] }, '2026-08-09')
    expect(r2.totalNoBancaria).toBe(2500) // 6.000 en 12 meses, 7 pagadas
    expect(r2.totalBancaria).toBe(5000)
    expect(r2.total).toBe(7500)
  })

  it('cada bloque dice con qué está medido', () => {
    expect(r.bloques.every((b) => b.criterio !== '')).toBe(true)
  })

  it('lo anulado no suma', () => {
    const r2 = resumenFinanciacion({ deudas: [{ ...prestamo, anuladoEn: '2026-02-01' }], polizas: [{ ...poliza, anuladoEn: '2026-02-01' }] }, '2026-08-09')
    expect(r2.total).toBe(0)
  })
})

describe('cuadro leído de un documento', () => {
  const conCalendario: Deuda = {
    ...prestamo,
    id: 'd3',
    tipo: 'HACIENDA',
    acreedor: 'AEAT',
    cuadroFijo: [
      { fecha: '2026-09-20', cuota: 1050, intereses: 50, capital: 1000 },
      { fecha: '2026-10-20', cuota: 1040, intereses: 40, capital: 1000 },
      { fecha: '2026-11-20', cuota: 1030, intereses: 30, capital: 1000 },
    ],
  }

  it('manda sobre la fórmula: los plazos son los que dice el documento', () => {
    const cuadro = cuadroDeuda(conCalendario)
    expect(cuadro.length).toBe(3)
    expect(cuadro.map((c) => c.cuota)).toEqual([1050, 1040, 1030])
  })

  it('el capital vivo baja plazo a plazo hasta cero', () => {
    const cuadro = cuadroDeuda(conCalendario)
    expect(cuadro[0].pendiente).toBe(2000)
    expect(cuadro[2].pendiente).toBe(0)
    expect(pendienteDeuda(conCalendario, '2026-08-09')).toBe(3000)
  })
})

/**
 * Calendario de un acuerdo de aplazamiento de la AEAT. La disposición
 * (fecha · principal · intereses · total por fila) es la habitual del acuerdo
 * de concesión. **Pendiente de validar con un documento real del usuario.**
 */
const ACUERDO = [
  ['AGENCIA TRIBUTARIA'],
  ['Acuerdo de concesión de aplazamiento/fraccionamiento'],
  ['NIF: B56241854', 'BESPAIN 7777 SL'],
  ['Número de expediente: 462026000123456'],
  ['Importe aplazado: 9.000,00'],
  ['Tipo de interés de demora: 4,0625 %'],
  ['Calendario de pagos'],
  ['Vencimiento', 'Principal', 'Intereses', 'Total'],
  ['20/09/2026', '3.000,00', '30,47', '3.030,47'],
  ['20/10/2026', '3.000,00', '20,31', '3.020,31'],
  ['20/11/2026', '3.000,00', '10,16', '3.010,16'],
]

describe('aplazamiento de Hacienda', () => {
  it('reconoce el documento y el organismo', () => {
    expect(esAplazamiento(ACUERDO).es).toBe(true)
    expect(esAplazamiento(ACUERDO).organismo).toBe('HACIENDA')
    expect(esAplazamiento([['Factura', 'Total 100,00']]).es).toBe(false)
  })

  it('distingue un aplazamiento de la Seguridad Social', () => {
    const tgss = [['TESORERIA GENERAL DE LA SEGURIDAD SOCIAL'], ['Acuerdo de concesión de aplazamiento'], ['Calendario de pagos']]
    expect(esAplazamiento(tgss).organismo).toBe('SEGURIDAD_SOCIAL')
  })

  it('lee los plazos uno a uno, con su principal y sus intereses', () => {
    const d = leerAplazamiento(ACUERDO)
    expect(d.plazos.length).toBe(3)
    expect(d.plazos[0]).toEqual({ fecha: '2026-09-20', cuota: 3030.47, intereses: 30.47, capital: 3000 })
    expect(d.plazos[2].fecha).toBe('2026-11-20')
  })

  it('lee la referencia, el NIF, el tipo y el importe aplazado', () => {
    const d = leerAplazamiento(ACUERDO)
    expect(d.referencia).toBe('462026000123456')
    expect(d.nif).toBe('B56241854')
    expect(d.tipoInteres).toBe(4.0625)
    expect(d.importeTotal).toBe(9000)
  })

  it('comprueba que los plazos cuadran con la deuda más los intereses', () => {
    const d = leerAplazamiento(ACUERDO)
    expect(d.avisos.some((a) => a.includes('no cuadra'))).toBe(false)
  })

  it('avisa si falta algún plazo por leer', () => {
    const roto = ACUERDO.filter((f) => f[0] !== '20/11/2026')
    expect(leerAplazamiento(roto).avisos.some((a) => a.includes('no cuadra'))).toBe(true)
  })

  it('sin plazos legibles lo dice en vez de guardar un cuadro vacío', () => {
    const d = leerAplazamiento([['Acuerdo de concesión de aplazamiento'], ['Calendario de pagos'], ['Sin tabla']])
    expect(d.plazos).toEqual([])
    expect(d.avisos[0]).toContain('No se ha reconocido ningún plazo')
  })
})

describe('tarjetas de crédito', () => {
  it('el disponible es el límite menos lo dispuesto', () => {
    const s = situacionTarjeta(tarjeta)
    expect(s.disponible).toBe(4500)
    expect(s.porcentajeDispuesto).toBe(25)
    expect(s.excedida).toBe(false)
  })

  it('detecta que se ha pasado del límite', () => {
    const s = situacionTarjeta({ ...tarjeta, dispuesto: 6500 })
    expect(s.excedida).toBe(true)
    expect(s.disponible).toBe(0)
  })

  it('pagando a fin de mes no hay intereses', () => {
    expect(costeAnualTarjeta(tarjeta)).toBe(0)
  })

  it('el saldo aplazado sí cuesta, y se dice cuánto', () => {
    const aplazada = { ...tarjeta, modalidad: 'APLAZADO' as const, tipoInteres: 18 }
    expect(costeAnualTarjeta(aplazada)).toBe(270)
    expect(avisosTarjeta(aplazada, [], '2026-08').some((a) => a.includes('más cara'))).toBe(true)
  })

  it('sin enlazar con una tarjeta de Configuración no se puede contrastar, y se avisa', () => {
    expect(avisosTarjeta(tarjeta, [], '2026-08').some((a) => a.includes('Sin enlazar'))).toBe(true)
    expect(gastoDelMes(tarjeta, [], '2026-08')).toBe(0)
  })
})

describe('la póliza en cuenta corriente cuenta en el total', () => {
  const cuenta = { id: 'c1', ...meta, nombre: 'CaixaBank', tipo: 'BANCO' as const, saldoInicial: 0 }
  const movimiento = {
    id: 'm1', ...meta, cuentaId: 'c1', fecha: '2026-01-05', concepto: 'Disposición',
    importe: -18000, clase: 'OTRO' as const, conciliado: false,
  }

  it('el dispuesto sale del saldo negativo, no del campo guardado', () => {
    // Guardada con dispuesto 0 porque lo lleva la cuenta: sin resolverla, el
    // bloque de pólizas sumaba cero y el total salía corto.
    const enCuenta: Poliza = { ...poliza, dispuesto: 0, origenDispuesto: 'CUENTA', cuentaTesoreriaId: 'c1' }
    const r = resumenFinanciacion(
      { deudas: [], polizas: [enCuenta], cuentasTesoreria: [cuenta], movimientos: [movimiento] },
      '2026-08-09',
    )
    expect(r.bloques.find((b) => b.bloque === 'POLIZAS')!.importe).toBe(18000)
    expect(r.total).toBe(18000)
  })
})
