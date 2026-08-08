import { describe, it, expect } from 'vitest'
import { extraerDatosFactura } from './factura-pdf'

/**
 * Factura REAL de proveedor (canon de stand en un centro comercial), tal y
 * como salen las líneas de `lineasDePdf`. Es la regresión del caso que falló:
 * la factura lleva **retención de IRPF del 19 %**, así que base + IVA NO da el
 * total. Con la regla de cuadre antigua se descartaban los tres importes y se
 * desglosaba el total al 21 %, dando una base de 1.605,07 € en vez de
 * 1.904,06 €. Además la fecha va en letra («1 de agosto de 2026») y el NIF del
 * emisor lleva prefijo ES y guion («NIF:ESH-53314811»).
 */
const FACTURA_STAND = [
  'Centro Comercial',
  'Gran Vía',
  'C/ José García Sellés, 2',
  '03015, Alicante',
  'Teléfono +34 965 250 642',
  'Fax +34 965 257 158',
  'administracion@ccgranvia.com BESPAIN 7777, S.L.',
  'www.ccgranvia.com Costa verde, 35',
  '03509 Finestrat - ALICANTE',
  'Comunidad de Propietarios',
  'Centro Comercial Gran Via',
  'NIF:ESH-53314811',
  'N.I.F.: B56241854',
  'FACTURA Nº 518/26 FECHA: 1 de agosto de 2026',
  'CONCEPTO IMPORTE',
  'Correspondiente al canon por cesión de uso de zonas comunes para la instalación de un stand',
  'de venta de vapeadores. 1.904,06',
  'Periodo: agosto/26',
  'FORMA DE PAGO: SUBTOTAL 1.904,06 €',
  'TRANSFERENCIA BANCARIA % IVA 21% 399,85 €',
  'ES39-2100-6968-1513-0004-1276 RETENCION 19% 361,77 €',
  'CDAD. PROPIETARIOS C.C.GRAN VIA TOTAL EUROS 1.942,14 €',
]

describe('factura real con retención', () => {
  const r = extraerDatosFactura(FACTURA_STAND, 'B56241854')

  it('lee los importes de verdad, no los inventa desglosando el total', () => {
    expect(r.base).toBe(1904.06)
    expect(r.cuota).toBe(399.85)
    expect(r.retencion).toBe(361.77)
    expect(r.total).toBe(1942.14)
    expect(r.tipoIva).toBe(21)
  })

  it('el cuadre se hace con la retención: base + IVA − retención = total', () => {
    expect(r.base! + r.cuota! - r.retencion!).toBeCloseTo(r.total!, 2)
    expect(r.avisos.filter((a) => /no cuadran|desglosado|calculado/.test(a))).toEqual([])
  })

  it('lee la fecha escrita en letra', () => {
    expect(r.fecha).toBe('2026-08-01')
  })

  it('lee el NIF del emisor aunque lleve prefijo ES y guion', () => {
    expect(r.cif).toBe('H53314811')
  })

  it('no confunde el NIF del emisor con el nuestro', () => {
    expect(r.cif).not.toBe('B56241854')
    expect(r.avisos.some((a) => /NIF\/CIF válido/.test(a))).toBe(false)
  })

  it('el número de factura es la referencia, no un importe', () => {
    expect(r.numFactura).toBe('518/26')
  })

  it('toma como proveedor la razón social que hay sobre el NIF, no el membrete', () => {
    // Antes cogía «Centro Comercial», que es el logotipo de la primera línea.
    expect(r.proveedor).toBe('Comunidad de Propietarios Centro Comercial Gran Via')
  })

  it('no deja ningún campo por leer', () => {
    expect(r.encontrados).toEqual(
      expect.arrayContaining(['cif', 'numFactura', 'fecha', 'base', 'cuota', 'total', 'retencion', 'proveedor']),
    )
  })
})
