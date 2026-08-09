import { describe, it, expect } from 'vitest'
import { leerVentasCsv, rangoDeNombre, esResumenSemanalSquare } from './ventas-csv'
import { parsearCSV, detectarSeparador } from './csv'

/**
 * Informe REAL de Square: «Resumen de ventas - Día de la semana». Está
 * transpuesto (una fila por métrica, una columna por día de la semana) y NO
 * lleva fechas: el periodo va en el nombre del fichero.
 */
const SQUARE = `"Resumen de ventas - Día de la semana
Todo el día (0:00-23:59 CET)",domingo,lunes,martes,miércoles,jueves,viernes,sábado
Ventas de productos,"556,99 €","833,68 €","1029,80 €","532,81 €","492,26 €","503,52 €","802,18 €"
Artículos,"556,99 €","833,68 €","1029,80 €","532,81 €","492,26 €","503,52 €","802,18 €"
Costes del servicio brutos,"0,00 €","0,00 €","0,00 €","0,00 €","0,00 €","0,00 €","0,00 €"
Devoluciones,"-12,31 €","-32,90 €","0,00 €","0,00 €","0,00 €","0,00 €","-19,05 €"
Descuentos y artículos gratuitos,"-3,00 €","-27,70 €","-17,87 €","-2,30 €","0,00 €","-2,07 €","-7,70 €"
Ventas netas,"541,68 €","773,08 €","1011,93 €","530,51 €","492,26 €","501,45 €","775,43 €"
Ventas diferidas,"0,00 €","0,00 €","0,00 €","0,00 €","0,00 €","0,00 €","0,00 €"
Ventas de tarjetas regalo,"0,00 €","0,00 €","0,00 €","0,00 €","0,00 €","0,00 €","0,00 €"
Impuestos,"113,72 €","162,32 €","212,50 €","111,39 €","103,34 €","105,28 €","162,77 €"
Ventas brutas,"655,40 €","935,40 €","1224,43 €","641,90 €","595,60 €","606,73 €","938,20 €"
Propinas,"0,00 €","0,00 €","0,00 €","0,00 €","0,00 €","0,00 €","0,00 €"
Total de las ventas,"655,40 €","935,40 €","1224,43 €","641,90 €","595,60 €","606,73 €","938,20 €"
Total de pagos cobrados,"655,40 €","935,40 €","1224,43 €","641,90 €","595,60 €","606,73 €","938,20 €"
Efectivo,"103,00 €","232,80 €","462,23 €","131,10 €","187,10 €","89,10 €","368,80 €"
Otros,"552,40 €","702,60 €","762,20 €","510,80 €","408,50 €","517,63 €","569,40 €"
Comisiones,"0,00 €","0,00 €","0,00 €","0,00 €","0,00 €","0,00 €","0,00 €"
Total neto,"655,40 €","935,40 €","1224,43 €","641,90 €","595,60 €","606,73 €","938,20 €"
Transacciones de ventas de productos,32,49,54,37,33,27,48
Transacciones de ventas de artículos,32,49,54,37,33,27,48
Transacciones de devoluciones detalladas,1,2,0,0,0,0,1
Transacciones de descuentos,1,5,4,2,0,2,5
Transacciones de ventas,33,51,54,37,33,27,49
Transacciones de impuestos,33,51,54,37,33,27,49
Total de transacciones de ventas,32,49,54,37,33,27,48
Total de transacciones de pagos cobrados,33,51,54,37,33,27,49
`

const NOMBRE = 'resumenventas2026080120260807.csv'

describe('resumen semanal de Square', () => {
  it('se reconoce por los días de la semana en la cabecera', () => {
    expect(esResumenSemanalSquare(parsearCSV(SQUARE, detectarSeparador(SQUARE)))).toBe(true)
  })

  it('saca el periodo del nombre del fichero', () => {
    expect(rangoDeNombre(NOMBRE)).toEqual({ desde: '2026-08-01', hasta: '2026-08-07' })
    // El prefijo que añade la subida no molesta.
    expect(rangoDeNombre('a5fe7e86-resumenventas2026080120260807.csv')).toEqual({ desde: '2026-08-01', hasta: '2026-08-07' })
    expect(rangoDeNombre('ventas.csv')).toBeUndefined()
  })

  it('cruza cada día de la semana con su fecha real', () => {
    const r = leerVentasCsv(SQUARE, NOMBRE)
    // Del 1 al 7 de agosto de 2026: sábado 1, domingo 2, lunes 3… viernes 7.
    expect(r.filas.map((f) => f.fecha)).toEqual([
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
    ])
  })

  it('lee los importes del día correcto', () => {
    const r = leerVentasCsv(SQUARE, NOMBRE)
    const sabado = r.filas.find((f) => f.fecha === '2026-08-01')!
    expect(sabado).toMatchObject({ base: 775.43, cuota: 162.77, total: 938.2, numTickets: 49 })
    const martes = r.filas.find((f) => f.fecha === '2026-08-04')!
    expect(martes).toMatchObject({ base: 1011.93, cuota: 212.5, total: 1224.43, numTickets: 54 })
  })

  it('los importes cuadran: netas + impuestos = brutas', () => {
    const r = leerVentasCsv(SQUARE, NOMBRE)
    for (const f of r.filas) expect(f.base! + f.cuota!).toBeCloseTo(f.total!, 2)
  })

  it('reparte el cobro entre efectivo y tarjeta, y suma el total', () => {
    const r = leerVentasCsv(SQUARE, NOMBRE)
    const domingo = r.filas.find((f) => f.fecha === '2026-08-02')!
    expect(domingo.cobros).toEqual([
      { forma: 'EFECTIVO', importe: 103 },
      { forma: 'TARJETA', importe: 552.4 },
    ])
    const cobrado = domingo.cobros.reduce((s, c) => s + c.importe, 0)
    expect(cobrado).toBeCloseTo(domingo.total!, 2)
  })

  it('avisa de que «Otros» se ha tomado como tarjeta y de que falta la tienda', () => {
    const r = leerVentasCsv(SQUARE, NOMBRE)
    expect(r.origen).toBe('SQUARE_SEMANAL')
    expect(r.avisos.some((a) => /«Otros»/.test(a))).toBe(true)
    expect(r.avisos.some((a) => /de qué tienda/.test(a))).toBe(true)
  })

  it('sin fechas en el nombre no inventa el periodo', () => {
    const r = leerVentasCsv(SQUARE, 'ventas.csv')
    expect(r.filas).toEqual([])
    expect(r.avisos[0]).toMatch(/no dice el periodo|no lleva las fechas/)
  })

  it('con un periodo de más de una semana se niega a repartir por fechas', () => {
    // «lunes» sería la suma de tres lunes: convertirlo en un día concreto
    // sería inventarse las cifras.
    const r = leerVentasCsv(SQUARE, 'resumenventas2026080120260821.csv')
    expect(r.filas).toEqual([])
    expect(r.avisos[0]).toMatch(/suma de varios lunes/)
  })

  it('un día sin ventas no se registra como venta vacía', () => {
    const cero = SQUARE.replace('Ventas brutas,"655,40 €"', 'Ventas brutas,"0,00 €"').replace(
      'Ventas netas,"541,68 €"',
      'Ventas netas,"0,00 €"',
    )
    const r = leerVentasCsv(cero, NOMBRE)
    expect(r.filas).toHaveLength(6)
    expect(r.descartadas.some((d) => /Sin ventas/.test(d.motivo))).toBe(true)
  })
})
