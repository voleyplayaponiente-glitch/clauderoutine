import { describe, it, expect } from 'vitest'
import { extraerDatosFactura } from './factura-pdf'

/** Factura típica de proveedor español, tal y como sale el texto de un PDF. */
const FACTURA = [
  'DISTRIBUCIONES VAPEO SUR S.L.',
  'CIF: B12345674',
  'Avda. del Mediterráneo 12, 04007 Almería',
  '',
  'FACTURA Nº: 2026/0451',
  'Fecha: 15/03/2026',
  '',
  'Cliente: BTC EMBASSY SPAIN HOLDING S.L.',
  'CIF: B19730290',
  '',
  'Descripción                Cantidad   Precio    Importe',
  'Líquido 10ml surtido            200      6,50   1.300,00',
  'Dispositivos recargables         25     22,00     550,00',
  '',
  'Base imponible                                 1.850,00',
  'IVA 21%                                          388,50',
  'TOTAL FACTURA                                  2.238,50',
]

describe('lectura asistida de facturas en PDF', () => {
  const r = extraerDatosFactura(FACTURA, 'B19730290')

  it('lee el CIF del proveedor, no el nuestro', () => {
    expect(r.cif).toBe('B12345674')
  })

  it('lee el número de factura', () => {
    expect(r.numFactura).toBe('2026/0451')
  })

  it('lee la fecha y la pasa a ISO', () => {
    expect(r.fecha).toBe('2026-03-15')
  })

  it('lee base, IVA y total', () => {
    expect(r.base).toBe(1850)
    expect(r.cuota).toBe(388.5)
    expect(r.total).toBe(2238.5)
    expect(r.tipoIva).toBe(21)
  })

  it('no deja avisos cuando todo cuadra y se ha leído', () => {
    expect(r.avisos.filter((a) => /no se ha|no cuadran/i.test(a))).toEqual([])
  })

  it('señala qué campos ha encontrado', () => {
    expect(r.encontrados).toEqual(expect.arrayContaining(['cif', 'numFactura', 'fecha', 'base', 'cuota', 'total']))
  })
})

describe('el cuadre manda: antes que rellenar mal, no rellena', () => {
  it('si base + IVA no da el total, descarta los importes y lo dice', () => {
    const rota = [
      'PROVEEDOR SL',
      'CIF: B12345674',
      'FACTURA Nº: 1',
      'Fecha: 15/03/2026',
      'Base imponible 1.000,00',
      'IVA 21% 210,00',
      'TOTAL FACTURA 9.999,00',
    ]
    const r = extraerDatosFactura(rota)
    expect(r.base).toBeUndefined()
    expect(r.cuota).toBeUndefined()
    expect(r.total).toBeUndefined()
    expect(r.avisos.some((a) => /no cuadran/.test(a))).toBe(true)
  })

  it('admite un céntimo de diferencia por redondeo', () => {
    const r = extraerDatosFactura(['Base imponible 100,00', 'IVA 21% 21,00', 'TOTAL 121,01'])
    expect(r.base).toBe(100)
    expect(r.total).toBe(121.01)
  })
})

describe('facturas incompletas', () => {
  it('con base y tipo, calcula la cuota y avisa', () => {
    const r = extraerDatosFactura(['PROVEEDOR SL', 'Base imponible 1.000,00', 'IVA 21%'])
    expect(r.base).toBe(1000)
    expect(r.cuota).toBe(210)
    expect(r.total).toBe(1210)
    expect(r.avisos.some((a) => /calculado/.test(a))).toBe(true)
  })

  it('solo con el total, desglosa hacia atrás y avisa', () => {
    const r = extraerDatosFactura(['PROVEEDOR SL', 'IVA 21% incluido', 'TOTAL A PAGAR 121,00'])
    expect(r.base).toBe(100)
    expect(r.cuota).toBe(21)
    expect(r.total).toBe(121)
    expect(r.avisos.some((a) => /desglosado/.test(a))).toBe(true)
  })

  it('sin importes legibles no inventa ninguno', () => {
    const r = extraerDatosFactura(['PROVEEDOR SL', 'Gracias por su compra'])
    expect(r.base).toBeUndefined()
    expect(r.total).toBeUndefined()
    expect(r.avisos.some((a) => /no se han podido leer los importes/i.test(a))).toBe(true)
  })

  it('un PDF escaneado lo dice claramente', () => {
    const r = extraerDatosFactura([])
    expect(r.avisos[0]).toMatch(/escaneo/)
    expect(r.encontrados).toEqual([])
  })

  it('avisa si hay varios NIF y no puede decidir', () => {
    const r = extraerDatosFactura(['CIF: B12345674', 'CIF: B76717586', 'TOTAL 100,00'])
    expect(r.cif).toBe('B12345674')
    expect(r.avisos.some((a) => /2 NIF\/CIF/.test(a))).toBe(true)
  })

  it('descarta un NIF con letra de control incorrecta', () => {
    const r = extraerDatosFactura(['CIF: B12345699', 'TOTAL 100,00'])
    expect(r.cif).toBeUndefined()
    expect(r.avisos.some((a) => /NIF\/CIF válido/.test(a))).toBe(true)
  })
})

describe('el número de factura no se confunde con un importe', () => {
  it('no coge el total de la línea «TOTAL FACTURA»', () => {
    // Caso real: el PDF escribe «FACTURA N: 2026/0451» (sin la º) y más abajo
    // «TOTAL FACTURA 2.238,50». Antes se quedaba con 2.238.
    const r = extraerDatosFactura([
      'FACTURA N: 2026/0451',
      'Fecha: 15/03/2026',
      'Base imponible 1.850,00',
      'IVA 21% 388,50',
      'TOTAL FACTURA 2.238,50',
    ])
    expect(r.numFactura).toBe('2026/0451')
  })

  it('admite las variantes de rótulo que usan los proveedores', () => {
    expect(extraerDatosFactura(['Factura nº A-2026-77']).numFactura).toBe('A-2026-77')
    expect(extraerDatosFactura(['FACTURA Nº: 2026/0451']).numFactura).toBe('2026/0451')
    expect(extraerDatosFactura(['Fra. num. FV25-0031']).numFactura).toBe('FV25-0031')
    expect(extraerDatosFactura(['FACTURA SIMPLIFICADA 001234']).numFactura).toBe('001234')
  })

  it('si solo hay una línea de total, no inventa un número', () => {
    expect(extraerDatosFactura(['TOTAL FACTURA 2.238,50']).numFactura).toBeUndefined()
  })
})

describe('formatos numéricos', () => {
  it('lee una factura en formato anglosajón', () => {
    const r = extraerDatosFactura(['Base imponible 1,850.00', 'IVA 21% 388.50', 'TOTAL 2,238.50'])
    expect(r.base).toBe(1850)
    expect(r.total).toBe(2238.5)
  })
})
