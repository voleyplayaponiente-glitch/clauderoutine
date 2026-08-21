import { describe, it, expect } from 'vitest'
import { listadoDeudas } from './listado-deudas'
import type { Deuda, Poliza, Renting, TarjetaCredito } from './tipos'

/**
 * Cifras tomadas de la pantalla real del usuario (BESPAIN 7777 SLU): tres
 * préstamos, una póliza, el renting del Clio y las tarjetas.
 */
const base = { id: 'x', creadoEn: '2026-01-01', creadoPor: 'test' }

const prestamo = (over: Partial<Deuda>): Deuda => ({
  ...base,
  tipo: 'PRESTAMO',
  acreedor: 'BBVA',
  importeOriginal: 60000,
  tipoInteres: 3.9,
  periodicidad: 'MENSUAL',
  nPeriodos: 96,
  sistema: 'FRANCES',
  fechaInicio: '2025-01-01',
  esVinculada: false,
  ...over,
}) as Deuda

const APLAZAMIENTO: Deuda = prestamo({
  tipo: 'HACIENDA',
  acreedor: 'Agencia Tributaria',
  importeOriginal: 12449.65,
  tipoInteres: 0,
  nPeriodos: 12,
  fechaInicio: '2026-09-20',
  // Los plazos REALES del acuerdo: llevan intereses crecientes, no son iguales.
  cuadroFijo: [
    { fecha: '2026-10-20', cuota: 1047.29, intereses: 9.82, capital: 1037.47 },
    { fecha: '2026-11-20', cuota: 1050.86, intereses: 13.39, capital: 1037.47 },
    { fecha: '2026-12-21', cuota: 1054.33, intereses: 16.86, capital: 1037.47 },
  ],
})

const POLIZA: Poliza = {
  ...base,
  entidad: 'CAIXABANK',
  limiteConcedido: 28000,
  limiteActual: 28000,
  dispuesto: 16562.15,
  tipoInteresDispuesto: 4.25,
  comisionDisponibilidad: 0.35,
  periodicidadLiquidacion: 'MENSUAL',
  fechaConstitucion: '2026-01-01',
  seRenueva: true,
} as Poliza

const RENTING: Renting = {
  ...base,
  arrendador: 'CAIXABANK RENTING',
  descripcion: 'RENAULT Clio / 2023',
  matricula: '7803NHK',
  cuotaBase: 263.63,
  tipoIva: 21,
  periodicidad: 'MENSUAL',
  nCuotas: 48,
  fechaInicio: '2026-01-01',
} as Renting

const TARJETA: TarjetaCredito = {
  ...base,
  entidad: 'BANKINTER',
  alias: 'Compras',
  ultimos4: '4321',
  limite: 6000,
  dispuesto: 0,
  modalidad: 'FIN_DE_MES',
} as TarjetaCredito

const HOY = '2026-08-17'

describe('listado detallado de deudas', () => {
  it('separa los tres bloques que pidió el usuario', () => {
    const l = listadoDeudas({ deudas: [prestamo({}), APLAZAMIENTO, prestamo({ tipo: 'SOCIOS', acreedor: 'Julio Nieto' })] }, HOY)
    expect(l.grupos.map((g) => g.grupo)).toEqual(['BANCARIA', 'HACIENDA', 'OTRAS'])
    expect(l.grupos[0].filas.map((f) => f.tipo)).toEqual(['Préstamo bancario'])
    expect(l.grupos[1].filas.map((f) => f.acreedor)).toEqual(['Agencia Tributaria'])
    expect(l.grupos[2].filas.map((f) => f.tipo)).toEqual(['Préstamo de socios'])
  })

  it('el renting va con la deuda bancaria, pero marcado como compromiso', () => {
    const l = listadoDeudas({ deudas: [], rentings: [RENTING] }, HOY)
    const f = l.grupos[0].filas[0]
    expect(f.tipo).toBe('Renting')
    expect(f.esCompromiso).toBe(true)
    expect(f.cuota).toBe(263.63)
    // Coste total del contrato: 48 cuotas sin IVA.
    expect(f.importeInicial).toBe(263.63 * 48)
  })

  it('NO inventa un tipo de interés donde no lo hay', () => {
    const l = listadoDeudas({ deudas: [], rentings: [RENTING], tarjetasCredito: [TARJETA] }, HOY)
    const renting = l.grupos[0].filas.find((f) => f.tipo === 'Renting')!
    const tarjeta = l.grupos[0].filas.find((f) => f.tipo === 'Tarjeta de crédito')!
    // Un 0 aquí se leería como «al 0 %», que es distinto de «no tiene tipo».
    expect(renting.tipoInteres).toBeUndefined()
    expect(tarjeta.tipoInteres).toBeUndefined()
    expect(renting.nota).toContain('sin tipo de interés')
  })

  it('la póliza no tiene cuota, y se dice por qué', () => {
    const l = listadoDeudas({ deudas: [], polizas: [POLIZA] }, HOY)
    const f = l.grupos[0].filas[0]
    expect(f.cuota).toBeUndefined()
    expect(f.cuotaMensual).toBeUndefined()
    expect(f.nota).toContain('se liquidan intereses')
    // El importe inicial de una póliza es su límite, no un capital prestado.
    expect(f.importeInicial).toBe(28000)
    expect(f.capitalPendiente).toBe(16562.15)
    expect(f.tipoInteres).toBe(4.25)
  })

  it('del aplazamiento enseña la cuota QUE TOCA, no la primera del cuadro', () => {
    // A 17/08/2026 aún no ha vencido ninguna: toca la del 20/10.
    const l = listadoDeudas({ deudas: [APLAZAMIENTO] }, HOY)
    const f = l.grupos[1].filas[0]
    expect(f.cuota).toBe(1047.29)
    expect(f.nota).toContain('no son iguales')

    // Pasado noviembre, la que toca es la de diciembre.
    const despues = listadoDeudas({ deudas: [APLAZAMIENTO] }, '2026-12-01')
    expect(despues.grupos[1].filas[0].cuota).toBe(1054.33)
  })

  it('la cuota trimestral se lleva a meses para poder sumarla', () => {
    const l = listadoDeudas({ deudas: [prestamo({ periodicidad: 'TRIMESTRAL', nPeriodos: 32 })] }, HOY)
    const f = l.grupos[0].filas[0]
    expect(f.periodicidad).toBe('TRIMESTRAL')
    expect(f.cuotaMensual).toBeCloseTo(f.cuota! / 3, 2)
  })

  it('los totales suman lo de cada bloque y el general', () => {
    const l = listadoDeudas({ deudas: [prestamo({}), APLAZAMIENTO], polizas: [POLIZA], rentings: [RENTING] }, HOY)
    const bancaria = l.grupos[0].totalPendiente
    const hacienda = l.grupos[1].totalPendiente
    expect(l.totalPendiente).toBeCloseTo(bancaria + hacienda + l.grupos[2].totalPendiente, 2)
    expect(hacienda).toBeGreaterThan(0)
  })

  it('lo anulado no aparece', () => {
    const l = listadoDeudas(
      {
        deudas: [{ ...prestamo({}), anuladoEn: '2026-05-01' } as Deuda],
        rentings: [{ ...RENTING, anuladoEn: '2026-05-01' } as Renting],
      },
      HOY,
    )
    expect(l.grupos[0].filas).toHaveLength(0)
    expect(l.totalPendiente).toBe(0)
  })

  it('si los plazos llevan intereses pero el acuerdo no dice el tipo, NO pinta 0 %', () => {
    // El acuerdo de la AEAT imprime los intereses de cada plazo pero el tipo de
    // demora va en una columna ilegible. Un «0,00 %» diría «sin intereses»,
    // que es lo contrario de lo que ocurre.
    const l = listadoDeudas({ deudas: [APLAZAMIENTO] }, HOY)
    const f = l.grupos[1].filas[0]
    expect(f.tipoInteres).toBeUndefined()
    expect(f.nota).toContain('no dice a qué tipo')
  })

  it('pero un préstamo al 0 % de verdad SÍ enseña su 0 %', () => {
    // El de Bankinter es un préstamo al 0 % real: ahí el cero es un dato.
    const l = listadoDeudas({ deudas: [prestamo({ acreedor: 'BANKINTER', tipoInteres: 0 })] }, HOY)
    expect(l.grupos[0].filas[0].tipoInteres).toBe(0)
  })
})
