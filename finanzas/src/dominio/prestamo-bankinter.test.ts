import { describe, it, expect } from 'vitest'
import { fechaDeSerieExcel, fusionarPrestamos, leerCondicionesPrestamo, leerPrestamo } from './prestamo-archivo'

/**
 * Ficheros REALES de Bankinter (préstamo 8517 de BESPAIN 7777 SL), tal y como
 * los entrega SheetJS con `header: 1`. Tercer formato distinto después del
 * Excel de BBVA y el PDF de CaixaBank:
 *  · rotula las columnas a su manera («IMPORTE CUOTA», «AMORTIZACION»),
 *  · las fechas del cuadro llegan como número de serie de Excel,
 *  · y las condiciones (importe, tipo, fechas) van en un fichero aparte que no
 *    tiene cuadro, con una fila de rótulos y una sola fila de valores.
 */
const CONDICIONES = [
  ['Número de cuenta: ES9701281632600510018517', '', '', '', '', '', '', '', ''],
  ['Empresa: BESPAIN 7777 SL', '', '', '', '', '', '', '', ''],
  ['Fecha de generación: 9/8/2026 18:24:18 -', '', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', '', ''],
  ['Condiciones', '', '', '', '', '', '', '', ''],
  ['SWIFT: BKBKESMMXXX', '', '', '', '', '', '', '', ''],
  ['CONDICIONES', '', '', '', '', '', '', '', ''],
  ['CONDICIONES PRÉSTAMO', '', '', '', '', '', '', '', ''],
  ['FECHA INICIO', 'FECHA VENCIMIENTO', 'IMPORTE INICIAL', 'IMPORTE PENDIENTE', 'DEUDA PDTE.', 'LIQUIDACIÓN', 'PRÓXIMA CUOTA', 'TIPO INTERÉS', 'CLASES DE CUOTA'],
  ['13.07.2026', '13.10.2026', '15000 EUR', '15000 EUR', '15000 EUR', 'Diferida', '13.08.2026', '0 %', 'CUOTAS AMORT CTE'],
]

const CUADRO = [
  ['Número de cuenta: ES9701281632600510018517', '', '', '', ''],
  ['Empresa: BESPAIN 7777 SL', '', '', '', ''],
  ['Fecha de generación: 9/8/2026 18:23:23', '', '', '', ''],
  ['', '', '', '', ''],
  ['*La información de este cuadro de amortización es orientativa…', '', '', '', ''],
  ['FECHA CUOTA', 'IMPORTE CUOTA', 'AMORTIZACION', 'INTERESES', 'IMPORTE PENDIENTE DE AMORTIZACIÓN'],
  [46247, 5000, 5000, 0, 10000],
  [46278, 5000, 5000, 0, 5000],
  [46308, 5000, 5000, 0, 0],
  ['', '', '', '', ''],
]

describe('fechas como número de serie de Excel', () => {
  it('convierte el serial de Excel a fecha', () => {
    expect(fechaDeSerieExcel(46247)).toBe('2026-08-13')
    expect(fechaDeSerieExcel(46308)).toBe('2026-10-13')
  })

  it('no toma un importe por una fecha', () => {
    expect(fechaDeSerieExcel(5000)).toBeUndefined()
    expect(fechaDeSerieExcel(15000)).toBeUndefined()
  })
})

describe('ficha de condiciones de Bankinter', () => {
  const d = leerCondicionesPrestamo(CONDICIONES)!

  it('la reconoce aunque no traiga cuadro', () => {
    expect(d).toBeDefined()
    expect(d.cuotas).toEqual([])
  })

  it('lee importe, fecha y tipo', () => {
    expect(d.importeOriginal).toBe(15000)
    expect(d.fechaInicio).toBe('2026-07-13')
    expect(d.tipoInteres).toBe(0)
  })

  it('«CUOTAS AMORT CTE» es amortización constante: sistema lineal', () => {
    expect(d.sistema).toBe('LINEAL')
  })

  it('saca la entidad del IBAN, que aquí es la única referencia', () => {
    expect(d.entidad).toBe('Bankinter')
    expect(d.numeroContrato).toBe('ES9701281632600510018517')
  })

  it('dice que el préstamo es sin intereses en vez de callarlo', () => {
    expect(d.avisos.some((a) => a.includes('0 %'))).toBe(true)
  })
})

describe('cuadro de amortización de Bankinter', () => {
  const d = leerPrestamo(CUADRO)

  it('reconoce sus rótulos de columna', () => {
    expect(d.cuotas.length).toBe(3)
    expect(d.cuotas[0]).toMatchObject({ fecha: '2026-08-13', cuota: 5000, principal: 5000, intereses: 0, pendiente: 10000 })
    expect(d.cuotas[2].fecha).toBe('2026-10-13')
  })

  it('deduce la periodicidad y el importe de la cuota', () => {
    expect(d.periodicidad).toBe('MENSUAL')
    expect(d.cuota).toBe(5000)
  })

  it('reconstruye el importe inicial del propio cuadro', () => {
    // Primera fila: 10.000 pendientes + 5.000 amortizados en esa cuota.
    expect(d.importeOriginal).toBe(15000)
  })
})

describe('los dos ficheros de Bankinter juntos', () => {
  const f = fusionarPrestamos([leerPrestamo(CONDICIONES), leerPrestamo(CUADRO)])

  it('componen el préstamo completo', () => {
    expect(f.entidad).toBe('Bankinter')
    expect(f.importeOriginal).toBe(15000)
    expect(f.fechaInicio).toBe('2026-07-13')
    expect(f.tipoInteres).toBe(0)
    expect(f.cuota).toBe(5000)
    expect(f.nPeriodos).toBe(3)
    expect(f.periodicidad).toBe('MENSUAL')
    expect(f.sistema).toBe('LINEAL')
  })

  it('la primera cuota vence un mes después del inicio, como dice el banco', () => {
    // Inicio 13/07/2026 → próxima cuota 13/08/2026, que es la primera del cuadro.
    expect(f.cuotas[0].fecha).toBe('2026-08-13')
  })
})

/**
 * Los MISMOS dos ficheros, pero descargados en PDF. Bankinter cambia bastante:
 * abrevia los rótulos y los parte en dos líneas («F. Inicio /» arriba,
 * «F. Vencimiento» debajo), y los importes llegan como «5.000,00 EUR».
 */
const CONDICIONES_PDF = [
  ['Empresa', 'Usuario', 'Fecha y hora'],
  ['BESPAIN 7777 SL', 'ANDREW NIETO LOPEZ', '09.08.2026 21:35'],
  ['Préstamos'],
  ['SWIFT: BKBKESMMXXX'],
  ['Condiciones'],
  ['Condiciones préstamo'],
  ['F. Inicio /', 'Imp. inicial /', 'Deuda pdte.', 'Liquidación', 'Próxima Cuota', 'Tipo Interés', 'Clases de Cuota'],
  ['F. Vencimiento', 'Imp. pendiente'],
  ['13.07.2026', '15000 EUR', '15000 EUR', 'Diferida', '13.08.2026', '0 %', 'CUOTAS AMORT CTE'],
  ['13.10.2026', '15000 EUR'],
  ['Cuenta de cargo: ES4801281632600100028335'],
  ['Tipos de interés'],
]

const CUADRO_PDF = [
  ['Empresa', 'Usuario', 'Fecha y hora'],
  ['BESPAIN 7777 SL', 'ANDREW NIETO LOPEZ', '9/8/26 21:35'],
  ['*La información de este cuadro de amortización es orientativa…'],
  ['Amortizacion'],
  ['FECHA CUOTA', 'IMPORTE CUOTA', 'AMORTIZACION', 'INTERESES', 'IMPORTE PENDIENTE DE AMORTIZACIÓN'],
  ['13.08.2026', '5.000,00 EUR', '5.000,00 EUR', '0,00 EUR', '10.000,00 EUR'],
  ['13.09.2026', '5.000,00 EUR', '5.000,00 EUR', '0,00 EUR', '5.000,00 EUR'],
  ['13.10.2026', '5.000,00 EUR', '5.000,00 EUR', '0,00 EUR', '0,00 EUR'],
  ['El presente cuadro de amortización no tiene en cuenta posibles amortizaciones parciales…'],
]

describe('los mismos préstamos de Bankinter, pero en PDF', () => {
  it('lee el cuadro con importes en «5.000,00 EUR» y fechas con puntos', () => {
    const d = leerPrestamo(CUADRO_PDF)
    expect(d.cuotas.length).toBe(3)
    expect(d.cuotas[0]).toMatchObject({ fecha: '2026-08-13', cuota: 5000, principal: 5000, pendiente: 10000 })
    expect(d.importeOriginal).toBe(15000)
  })

  it('lee las condiciones con los rótulos abreviados y partidos en dos líneas', () => {
    const d = leerCondicionesPrestamo(CONDICIONES_PDF)!
    expect(d).toBeDefined()
    expect(d.fechaInicio).toBe('2026-07-13')
    expect(d.importeOriginal).toBe(15000)
    expect(d.tipoInteres).toBe(0)
    expect(d.sistema).toBe('LINEAL')
    expect(d.entidad).toBe('Bankinter')
  })

  it('el PDF da el mismo préstamo que el Excel', () => {
    const pdf = fusionarPrestamos([leerPrestamo(CONDICIONES_PDF), leerPrestamo(CUADRO_PDF)])
    const excel = fusionarPrestamos([leerPrestamo(CONDICIONES), leerPrestamo(CUADRO)])
    for (const campo of ['importeOriginal', 'fechaInicio', 'tipoInteres', 'cuota', 'nPeriodos', 'periodicidad', 'sistema', 'entidad'] as const) {
      expect({ campo, valor: pdf[campo] }).toEqual({ campo, valor: excel[campo] })
    }
  })
})

describe('la cuenta de cargo no es el número del préstamo', () => {
  it('del PDF se saca el banco, pero no se usa la cuenta de cargo como contrato', () => {
    const d = leerCondicionesPrestamo(CONDICIONES_PDF)!
    expect(d.entidad).toBe('Bankinter')
    expect(d.numeroContrato).toBeUndefined()
  })

  it('del Excel sí, porque ahí el IBAN es el del propio préstamo', () => {
    expect(leerCondicionesPrestamo(CONDICIONES)!.numeroContrato).toBe('ES9701281632600510018517')
  })
})
