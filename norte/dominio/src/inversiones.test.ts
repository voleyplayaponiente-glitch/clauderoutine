import { describe, expect, it } from 'vitest'
import {
  calcularDesvios,
  estadoDePosicion,
  repartoPorClase,
  twr,
  valorarPosicion,
  xirr,
  type MovimientoInversion,
} from './inversiones.js'

/**
 * Las rentabilidades esperadas están calculadas aparte, con una bisección
 * independiente en Python. Comprobar una TIR contra la propia implementación
 * que la calcula no prueba absolutamente nada.
 */

describe('la TIR de flujos con fecha (XIRR)', () => {
  it('mil euros que se convierten en mil cien en un año son un 10 %', () => {
    const tasa = xirr([
      { fecha: '2025-01-01', importe: -100_000 },
      { fecha: '2026-01-01', importe: 110_000 },
    ])
    expect(tasa).toBeCloseTo(10, 3)
  })

  it('con dos aportaciones en fechas distintas sale un 8,00 %', () => {
    const tasa = xirr([
      { fecha: '2024-01-01', importe: -1_000_000 },
      { fecha: '2024-07-01', importe: -500_000 },
      { fecha: '2025-01-01', importe: 1_600_000 },
    ])
    expect(tasa).toBeCloseTo(7.9994, 3)
  })

  it('doce aportaciones mensuales de 100 € que acaban en 1.300 € dan 15,66 %', () => {
    const flujos = Array.from({ length: 12 }, (_, i) => ({
      fecha: `2024-${String(i + 1).padStart(2, '0')}-01`,
      importe: -10_000,
    }))
    expect(xirr([...flujos, { fecha: '2025-01-01', importe: 130_000 }])).toBeCloseTo(15.6552, 3)
  })

  it('una pérdida sale en negativo, y el año bisiesto se nota', () => {
    // 10.000 € que se quedan en 8.000 durante 2024 (366 días): con base 365 el
    // anualizado no es un −20 % redondo, y está bien que no lo sea.
    const tasa = xirr([
      { fecha: '2024-01-01', importe: -1_000_000 },
      { fecha: '2025-01-01', importe: 800_000 },
    ])
    expect(tasa).toBeCloseTo(-19.9512, 3)
  })

  it('sin flujos de los dos signos devuelve null en vez de inventarse un número', () => {
    // Es el caso real de una cartera a la que solo has aportado y que aún no
    // has valorado. Una rentabilidad inventada aquí la usaría alguien para
    // tomar una decisión de verdad.
    expect(
      xirr([
        { fecha: '2024-01-01', importe: -100_000 },
        { fecha: '2025-01-01', importe: -100_000 },
      ]),
    ).toBeNull()
    expect(xirr([{ fecha: '2024-01-01', importe: -100_000 }])).toBeNull()
  })
})

describe('la rentabilidad ponderada por tiempo (TWR)', () => {
  it('encadena los tramos y no la contamina cuándo se aportó', () => {
    const rentabilidad = twr([
      { valorInicial: 100_000, flujo: 0, valorFinal: 110_000 },
      { valorInicial: 110_000, flujo: 50_000, valorFinal: 168_000 },
      { valorInicial: 168_000, flujo: 0, valorFinal: 160_000 },
    ])
    expect(rentabilidad).toBeCloseTo(10, 4)
  })

  it('un tramo que empieza en cero no tiene rendimiento que medir', () => {
    expect(twr([{ valorInicial: 0, flujo: 0, valorFinal: 100 }])).toBeNull()
  })
})

describe('el estado de una posición', () => {
  const COMPRAS: MovimientoInversion[] = [
    { tipo: 'compra', fecha: '2024-01-15', participaciones: 10, importe: 100_000, comision: 500 },
    { tipo: 'compra', fecha: '2024-06-15', participaciones: 10, importe: 140_000, comision: 500 },
  ]

  it('el coste medio pondera por lo pagado, comisiones incluidas', () => {
    const estado = estadoDePosicion(COMPRAS)
    expect(estado.participaciones).toBe(20)
    expect(estado.costeTotal).toBe(241_000)
    expect(estado.costeMedio).toBe(12_050)
  })

  it('una venta parcial saca coste en proporción y deja la plusvalía realizada', () => {
    const estado = estadoDePosicion([
      ...COMPRAS,
      { tipo: 'venta', fecha: '2025-01-10', participaciones: 10, importe: 150_000, comision: 500 },
    ])
    expect(estado.participaciones).toBe(10)
    // La mitad del coste sale con la venta: 120.500 de 241.000.
    expect(estado.costeTotal).toBe(120_500)
    expect(estado.plusvaliaRealizada).toBe(150_000 - 500 - 120_500)
  })

  it('vender todo deja la posición limpia, sin coste colgando', () => {
    const estado = estadoDePosicion([
      ...COMPRAS,
      { tipo: 'venta', fecha: '2025-01-10', participaciones: 20, importe: 300_000 },
    ])
    expect(estado.participaciones).toBe(0)
    expect(estado.costeTotal).toBe(0)
    expect(estado.plusvaliaRealizada).toBe(59_000)
  })

  it('los dividendos no bajan el coste: son rentabilidad aparte', () => {
    const estado = estadoDePosicion([
      ...COMPRAS,
      { tipo: 'dividendo', fecha: '2024-12-01', participaciones: 0, importe: 4_000 },
    ])
    expect(estado.dividendos).toBe(4_000)
    expect(estado.costeTotal).toBe(241_000)
  })

  it('un split multiplica las participaciones sin tocar el dinero', () => {
    const estado = estadoDePosicion([
      ...COMPRAS,
      { tipo: 'split', fecha: '2025-02-01', participaciones: 2, importe: 0 },
    ])
    expect(estado.participaciones).toBe(40)
    expect(estado.costeTotal).toBe(241_000)
    expect(estado.costeMedio).toBe(6_025)
  })
})

describe('valorar lo que se tiene', () => {
  it('calcula la plusvalía latente y su porcentaje', () => {
    const valoracion = valorarPosicion({ participaciones: 20, costeTotal: 241_000 }, 14_000)
    expect(valoracion.valor).toBe(280_000)
    expect(valoracion.plusvaliaLatente).toBe(39_000)
    expect(valoracion.rentabilidad).toBeCloseTo(16.18, 2)
  })

  it('sin precio no inventa un valor: lo deja en null y se nota', () => {
    const valoracion = valorarPosicion({ participaciones: 20, costeTotal: 241_000 }, null)
    expect(valoracion.rentabilidad).toBeNull()
    expect(valoracion.valor).toBe(0)
  })
})

describe('el reparto de la cartera y el rebalanceo', () => {
  const CARTERA = [
    { clase: 'renta_variable' as const, valor: 8_000_000 },
    { clase: 'renta_fija' as const, valor: 1_500_000 },
    { clase: 'monetario' as const, valor: 500_000 },
  ]

  it('reparte por clase y ordena de mayor a menor', () => {
    const reparto = repartoPorClase(CARTERA)
    expect(reparto.total).toBe(10_000_000)
    expect(reparto.partes[0]).toMatchObject({ clase: 'renta_variable', porcentaje: 80 })
    expect(reparto.partes.map((p) => p.clase)).toEqual(['renta_variable', 'renta_fija', 'monetario'])
  })

  it('el umbral son puntos porcentuales, no porcentaje relativo', () => {
    // Objetivo 70 % con umbral 5: se avisa por debajo del 65 o por encima del
    // 75. Con un 80 % real, está fuera.
    const desvios = calcularDesvios(repartoPorClase(CARTERA), [
      { clase: 'renta_variable', objetivo: 70, umbral: 5 },
      { clase: 'renta_fija', objetivo: 25, umbral: 5 },
      { clase: 'monetario', objetivo: 5, umbral: 5 },
    ])
    const variable = desvios.find((d) => d.clase === 'renta_variable')!
    expect(variable.desviacion).toBeCloseTo(10, 6)
    expect(variable.fueraDeRango).toBe(true)
    // Y dice cuánto mover: un 10 % de 100.000 € son 10.000 € a vender.
    expect(variable.ajuste).toBe(-1_000_000)

    const monetario = desvios.find((d) => d.clase === 'monetario')!
    expect(monetario.fueraDeRango).toBe(false)
  })

  it('una clase con objetivo pero sin nada invertido cuenta como 0 %', () => {
    const desvios = calcularDesvios(repartoPorClase(CARTERA), [
      { clase: 'cripto', objetivo: 5, umbral: 5 },
    ])
    expect(desvios[0]).toMatchObject({ actual: 0, desviacion: -5, fueraDeRango: false })
    expect(desvios[0]!.ajuste).toBe(500_000)
  })

  it('una cartera vacía no divide por cero', () => {
    expect(repartoPorClase([])).toEqual({ total: 0, partes: [] })
  })
})
