import { describe, it, expect } from 'vitest'
import { leerPrestamo, fusionarPrestamos, tipoDeCuadro, type Celda } from './prestamo-archivo'

/**
 * Ficheros REALES de BBVA para un préstamo de 50.000 € a 84 meses. El banco
 * parte la información en dos descargas y hacen falta las dos:
 * «Amortizaciones y movimientos» trae la formalización y lo pagado; «Próximas
 * cuotas», lo que queda.
 */
const AMORTIZACIONES: Celda[][] = [
  ['AMORTIZACIONES Y MOVIMIENTOS'],
  [],
  ['Código de empresa', '20892964'],
  ['Usuario', 'ADMIN1'],
  ['CIF', 'B56241854'],
  ['Razón Social', 'BESPAIN 7777 S.L.'],
  ['Agrupación de producto', 'Más de 5 años'],
  ['Contrato', '0182 4424 31 0830073968'],
  ['Nombre comercial', 'PRESTAMO ONLINE NEGOCIOS'],
  ['Divisa del contrato', 'EUR'],
  [],
  ['INFORMACIÓN DE LA DESCARGA'],
  [],
  ['Fecha de la descarga', '09/08/2026'],
  ['Hora de la descarga', '13:23'],
  [],
  ['FECHA DE VENCIMIENTO', 'FECHA DE OPERACIÓN', 'TIPO DE MOVIMIENTO', 'IMPORTE DEL MOVIMIENTO', 'IMPORTE PRINCIPAL', 'IMPORTE DE INTERESES', 'COMISIONES', 'ESTADO', 'CAPITAL PENDIENTE', 'CAPITAL AMORTIZADO'],
  ['30/07/2026', '30/07/2026', 'Cuota', 681.14, 527.12, 154.02, 0, 'Pagada sin demora', 46862.76, 3137.24],
  ['30/06/2026', '30/06/2026', 'Cuota', 681.14, 525.42, 155.72, 0, 'Pagada sin demora', 47389.88, 2610.12],
  ['30/05/2026', '01/06/2026', 'Cuota', 681.14, 523.71, 157.43, 0, 'Pagada sin demora', 47915.3, 2084.7],
  ['30/04/2026', '30/04/2026', 'Cuota', 681.14, 522.02, 159.12, 0, 'Pagada sin demora', 48439.01, 1560.99],
  ['30/03/2026', '30/03/2026', 'Cuota', 681.14, 520.33, 160.81, 0, 'Pagada sin demora', 48961.03, 1038.97],
  ['28/02/2026', '02/03/2026', 'Cuota', 681.14, 518.64, 162.5, 0, 'Pagada sin demora', 49481.36, 518.64],
  ['30/01/2026', '30/01/2026', 'Formalización', 49875, 50000, 0, 125, 'Pagada', 50000, 0],
]

const PROXIMAS: Celda[][] = [
  ['PRÓXIMAS CUOTAS'],
  [],
  ['CIF', 'B56241854'],
  ['Contrato', '0182 4424 31 0830073968'],
  ['Nombre comercial', 'PRESTAMO ONLINE NEGOCIOS'],
  [],
  ['Aviso legal: El cuadro de amortización que te presentamos a continuación no tiene carácter contractual.'],
  [],
  ['FECHA DE VENCIMIENTO', 'IMPORTE DE CUOTA', 'IMPORTE PRINCIPAL', 'IMPORTE DE INTERESES', 'ESTADO', 'CAPITAL PENDIENTE', 'CAPITAL AMORTIZADO'],
  ['30/08/2026', 681.14, 528.84, 152.3, 'Pendiente', 46333.92, 3666.08],
  ['30/09/2026', 681.14, 530.55, 150.59, 'Pendiente', 45803.37, 4196.63],
  ['30/10/2026', 681.14, 532.28, 148.86, 'Pendiente', 45271.09, 4728.91],
  ['30/11/2026', 681.14, 534.01, 147.13, 'Pendiente', 44737.08, 5262.92],
  ['30/12/2026', 681.14, 535.74, 145.4, 'Pendiente', 44201.34, 5798.66],
]

describe('amortizaciones y movimientos de BBVA', () => {
  const r = leerPrestamo(AMORTIZACIONES)

  it('lee el contrato y deduce la entidad por su código', () => {
    expect(r.numeroContrato).toBe('0182 4424 31 0830073968')
    // 0182 es el código de BBVA: se propone, y se puede corregir.
    expect(r.entidad).toBe('BBVA')
    expect(r.nombreProducto).toBe('PRESTAMO ONLINE NEGOCIOS')
  })

  it('la formalización da el importe inicial, la fecha y la comisión', () => {
    expect(r.importeOriginal).toBe(50000)
    expect(r.fechaInicio).toBe('2026-01-30')
    expect(r.comisionApertura).toBe(125)
  })

  it('la formalización NO se cuenta como cuota', () => {
    expect(r.cuotas).toHaveLength(6)
    expect(r.nPagadas).toBe(6)
    expect(r.cuota).toBe(681.14)
  })

  it('deduce periodicidad y sistema', () => {
    expect(r.periodicidad).toBe('MENSUAL')
    expect(r.sistema).toBe('FRANCES')
  })

  it('calcula el tipo de interés con el propio cuadro', () => {
    // 154,02 de intereses sobre 47.389,88 de capital vivo → 3,90 % anual.
    expect(r.tipoInteres).toBeCloseTo(3.9, 2)
    expect(r.avisos.some((a) => /se ha calculado con el propio cuadro/.test(a))).toBe(true)
  })

  it('el capital vivo es el de la última cuota pagada', () => {
    expect(r.capitalPendiente).toBe(46862.76)
  })
})

describe('próximas cuotas de BBVA', () => {
  const r = leerPrestamo(PROXIMAS)

  it('lee el cuadro pendiente', () => {
    expect(r.cuotas).toHaveLength(5)
    expect(r.nPendientes).toBe(5)
    expect(r.nPagadas).toBe(0)
  })

  it('reconstruye el importe inicial sumando pendiente y amortizado', () => {
    // 46.333,92 + 3.666,08 = 50.000, aunque este fichero no trae la formalización.
    expect(r.importeOriginal).toBe(50000)
    expect(r.avisos.some((a) => /reconstruido/.test(a))).toBe(true)
  })

  it('el tipo sale igual que en el otro fichero', () => {
    expect(r.tipoInteres).toBeCloseTo(3.9, 2)
  })
})

describe('los dos ficheros juntos', () => {
  const r = fusionarPrestamos([leerPrestamo(AMORTIZACIONES), leerPrestamo(PROXIMAS)])

  it('junta lo pagado con lo pendiente sin repetir cuotas', () => {
    expect(r.nPagadas).toBe(6)
    expect(r.nPendientes).toBe(5)
    expect(r.nPeriodos).toBe(11)
    expect(r.cuotas[0].fecha).toBe('2026-02-28')
    expect(r.cuotas[r.cuotas.length - 1].fecha).toBe('2026-12-30')
  })

  it('conserva los datos de la formalización', () => {
    expect(r.importeOriginal).toBe(50000)
    expect(r.fechaInicio).toBe('2026-01-30')
    expect(r.comisionApertura).toBe(125)
    expect(r.entidad).toBe('BBVA')
  })

  it('no dice que el importe se ha reconstruido si viene de la formalización', () => {
    expect(r.avisos.some((a) => /reconstruido/.test(a))).toBe(false)
  })

  it('con los dos ficheros no pide subir el que falta', () => {
    expect(r.avisos.some((a) => /Sube también el otro/.test(a))).toBe(false)
  })

  it('con uno solo sí lo pide', () => {
    const solo = fusionarPrestamos([leerPrestamo(PROXIMAS)])
    expect(solo.avisos.some((a) => /Sube también el otro/.test(a))).toBe(true)
  })

  it('la primera cuota vence un mes después de la formalización', () => {
    // Es la convención que usa el cuadro de la app: encaja con el del banco.
    expect(r.fechaInicio).toBe('2026-01-30')
    expect(r.cuotas[0].fecha).toBe('2026-02-28')
  })
})

describe('lo que no se puede leer', () => {
  it('un fichero que no es un cuadro se rechaza con motivo', () => {
    const r = leerPrestamo([['Hoja de cálculo cualquiera'], ['a', 'b']])
    expect(r.cuotas).toEqual([])
    expect(r.avisos[0]).toMatch(/No se reconoce el cuadro/)
  })

  it('un contrato de otra entidad desconocida no inventa el banco', () => {
    const filas = AMORTIZACIONES.map((f) => (f[0] === 'Contrato' ? ['Contrato', '9999 1234 56 7890123456'] : f))
    expect(leerPrestamo(filas).entidad).toBeUndefined()
  })

  it('sin intereses en el cuadro no se inventa un tipo', () => {
    const sinInteres = PROXIMAS.map((f) => (typeof f[3] === 'number' ? [...f.slice(0, 3), '', ...f.slice(4)] : f))
    expect(leerPrestamo(sinInteres).tipoInteres).toBeUndefined()
  })

  it('el tipo se calcula con la mediana, no con una cuota suelta', () => {
    const cuotas = [
      { fecha: '2026-08-30', cuota: 681.14, principal: 528.84, intereses: 152.3, pendiente: 46333.92, pagada: false },
      { fecha: '2026-09-30', cuota: 681.14, principal: 530.55, intereses: 150.59, pendiente: 45803.37, pagada: false },
      // Una cuota rara no debe torcer el resultado.
      { fecha: '2026-10-30', cuota: 681.14, principal: 532.28, intereses: 900, pendiente: 45271.09, pagada: false },
    ]
    expect(tipoDeCuadro(cuotas, 'MENSUAL')).toBeCloseTo(3.9, 1)
  })
})
