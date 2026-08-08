import { describe, it, expect } from 'vitest'
import { detectarColumnas, filasAMovimientos, leerHoja, lineasAMovimientos, totalExtracto } from './extracto'

describe('detección de columnas en hojas de banca electrónica', () => {
  it('reconoce fecha, concepto e importe', () => {
    const m = detectarColumnas([['Fecha', 'Concepto', 'Importe']])
    expect(m).toEqual({ fecha: 0, concepto: 1, importe: 2, debe: -1, haber: -1, extra: -1, primeraFila: 1 })
  })

  it('salta las filas de rótulos que los bancos ponen encima', () => {
    const m = detectarColumnas([
      ['BANKINTER · Extracto de cuenta'],
      ['ES96 0128 1632 6401 0002 8342'],
      [''],
      ['Fecha', 'Fecha valor', 'Concepto', 'Importe', 'Saldo'],
    ])
    expect(m?.primeraFila).toBe(4)
    expect(m?.fecha).toBe(0)
    expect(m?.concepto).toBe(2)
    expect(m?.importe).toBe(3)
  })

  it('no confunde "fecha valor" con "fecha"', () => {
    const m = detectarColumnas([['Fecha valor', 'Fecha', 'Concepto', 'Importe']])
    expect(m?.fecha).toBe(1)
  })

  it('reconoce extractos con debe y haber separados', () => {
    const m = detectarColumnas([['Fecha', 'Descripción', 'Cargo', 'Abono']])
    expect(m?.importe).toBe(-1)
    expect(m?.debe).toBe(2)
    expect(m?.haber).toBe(3)
  })

  it('devuelve undefined si la hoja no es un extracto', () => {
    expect(detectarColumnas([['Artículo', 'Precio', 'Stock']])).toBeUndefined()
    expect(detectarColumnas([])).toBeUndefined()
  })
})

describe('conversión de filas a movimientos', () => {
  const hoja = [
    ['Fecha', 'Concepto', 'Importe'],
    ['15/01/2026', 'PAGO TARJETA COMERCIO', '121,00'],
    ['20/01/2026', 'RECIBO LUZ', '-50,00'],
    ['21/01/2026', 'TRANSFERENCIA', '1.234,56'],
  ]

  it('lee importes en formato español, con punto de millar y coma decimal', () => {
    const r = leerHoja(hoja)!.resultado
    expect(r.movimientos.map((m) => m.importe)).toEqual([121, -50, 1234.56])
    expect(r.descartadas).toEqual([])
  })

  it('convierte las fechas a ISO', () => {
    expect(leerHoja(hoja)!.resultado.movimientos[0].fecha).toBe('2026-01-15')
  })

  it('conserva el texto original de la fila', () => {
    expect(leerHoja(hoja)!.resultado.movimientos[0].origen).toContain('PAGO TARJETA COMERCIO')
  })

  it('con debe y haber separados el cargo sale negativo', () => {
    const conDebeHaber = [
      ['Fecha', 'Concepto', 'Cargo', 'Abono'],
      ['15/01/2026', 'RECIBO', '50,00', ''],
      ['16/01/2026', 'NÓMINA', '', '1.500,00'],
    ]
    const r = leerHoja(conDebeHaber)!.resultado
    expect(r.movimientos.map((m) => m.importe)).toEqual([-50, 1500])
  })

  it('el cargo ya firmado por el banco no cambia de signo dos veces', () => {
    const r = leerHoja([
      ['Fecha', 'Concepto', 'Cargo', 'Abono'],
      ['15/01/2026', 'RECIBO', '-50,00', ''],
    ])!.resultado
    expect(r.movimientos[0].importe).toBe(-50)
  })

  it('no inventa nada: la fila ilegible se descarta con su motivo', () => {
    const r = leerHoja([
      ['Fecha', 'Concepto', 'Importe'],
      ['15/01/2026', 'BUENA', '10,00'],
      ['no es fecha', 'MALA', '20,00'],
      ['16/01/2026', 'SIN IMPORTE', 'abc'],
    ])!.resultado
    expect(r.movimientos).toHaveLength(1)
    expect(r.descartadas).toHaveLength(2)
    expect(r.descartadas[0].motivo).toMatch(/Fecha no reconocida/)
    expect(r.descartadas[1].motivo).toMatch(/Importe no reconocido/)
  })

  it('las filas totalmente vacías se ignoran sin ruido', () => {
    const r = leerHoja([
      ['Fecha', 'Concepto', 'Importe'],
      ['15/01/2026', 'UNA', '10,00'],
      ['', '', ''],
      [],
    ])!.resultado
    expect(r.movimientos).toHaveLength(1)
    expect(r.descartadas).toEqual([])
  })

  it('un concepto vacío no deja el movimiento sin texto', () => {
    const r = filasAMovimientos(
      [['Fecha', 'Concepto', 'Importe'], ['15/01/2026', '', '10,00']],
      { fecha: 0, concepto: 1, importe: 2, debe: -1, haber: -1, extra: -1, primeraFila: 1 },
    )
    expect(r.movimientos[0].concepto).toBe('Movimiento bancario')
  })
})

describe('lectura de líneas de un PDF de extracto', () => {
  it('lee fecha, concepto e importe de una línea típica', () => {
    const r = lineasAMovimientos(['15/01/2026 PAGO TARJETA COMERCIO 121,00'])
    expect(r.movimientos).toHaveLength(1)
    expect(r.movimientos[0]).toMatchObject({ fecha: '2026-01-15', concepto: 'PAGO TARJETA COMERCIO', importe: 121 })
  })

  it('cuando hay importe y saldo, se queda con el importe', () => {
    const r = lineasAMovimientos(['20/01/2026 RECIBO LUZ -50,00 1.234,56'])
    expect(r.movimientos[0].importe).toBe(-50)
    expect(r.movimientos[0].concepto).toBe('RECIBO LUZ')
  })

  it('descarta la fecha valor repetida del concepto', () => {
    const r = lineasAMovimientos(['15/01/2026 16/01/2026 TRANSFERENCIA RECIBIDA 300,00'])
    expect(r.movimientos[0].concepto).toBe('TRANSFERENCIA RECIBIDA')
    expect(r.movimientos[0].fecha).toBe('2026-01-15')
  })

  it('ignora las líneas que no son movimientos', () => {
    const r = lineasAMovimientos([
      'BANKINTER — EXTRACTO DE CUENTA',
      'ES96 0128 1632 6401 0002 8342',
      'Fecha Concepto Importe Saldo',
      '15/01/2026 COMPRA 25,00 100,00',
      'Página 1 de 3',
    ])
    expect(r.movimientos).toHaveLength(1)
    expect(r.descartadas).toEqual([])
  })

  it('avisa de la línea que empieza por fecha pero no tiene importe', () => {
    const r = lineasAMovimientos(['15/01/2026 CONCEPTO SIN CIFRAS'])
    expect(r.movimientos).toHaveLength(0)
    expect(r.descartadas[0].motivo).toMatch(/no tiene ningún importe/)
  })

  it('lee miles con punto y decimales con coma', () => {
    const r = lineasAMovimientos(['01/02/2026 NOMINA MENSUAL 1.850,75'])
    expect(r.movimientos[0].importe).toBe(1850.75)
  })

  it('admite el símbolo del euro pegado al importe', () => {
    const r = lineasAMovimientos(['01/02/2026 COMPRA 12,30 €'])
    expect(r.movimientos[0].importe).toBe(12.3)
  })

  it('un PDF sin capa de texto no produce movimientos falsos', () => {
    expect(lineasAMovimientos([]).movimientos).toEqual([])
    expect(lineasAMovimientos(['', '   ']).movimientos).toEqual([])
  })
})

describe('total del extracto', () => {
  it('suma sin arrastrar decimales', () => {
    const r = lineasAMovimientos(['01/02/2026 A 0,10', '02/02/2026 B 0,20'])
    expect(totalExtracto(r.movimientos)).toBe(0.3)
  })
  it('la lista vacía suma cero', () => {
    expect(totalExtracto([])).toBe(0)
  })
})
