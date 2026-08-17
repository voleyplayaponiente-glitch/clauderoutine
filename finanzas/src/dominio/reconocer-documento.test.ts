import { describe, it, expect } from 'vitest'
import { reconocerDocumento } from './reconocer-documento'

/**
 * El usuario intentó subir el acuerdo de aplazamiento de Hacienda por la
 * importación de extractos de Bancos y solo obtuvo «no se pudo leer el
 * fichero». El lector funcionaba: era la pantalla equivocada. Estas pruebas
 * fijan que, a partir de ahora, la app diga a dónde va cada documento.
 */
const ACUERDO_AEAT = [
  ['CONCESIÓN DEL APLAZAMIENTO/FRACCIONAMIENTO DE PAGO SIN GARANTÍA'],
  ['N.I.F.:', 'B56241854'],
  ['Número de expediente:', '032640410056F'],
  ['Vista la petición de aplazamiento/fraccionamiento formulada por el obligado al pago'],
  ['ANEXO I: DEUDAS Y PLAZOS DE LA NOTIFICACIÓN'],
  ['1.037,47', '0,00', '1.037,47', '9,82', '1.047,29', '20-10-2026'],
]

const ACUERDO_TGSS = [
  ['TESORERÍA GENERAL DE LA SEGURIDAD SOCIAL'],
  ['RESOLUCIÓN DE CONCESIÓN DE APLAZAMIENTO'],
  ['calendario de pagos'],
  ['1.000,00', '15-09-2026'],
]

const EXTRACTO = [
  ['Fecha', 'Concepto', 'Importe', 'Saldo'],
  ['01/07/2026', 'PAGO TARJETA COMERCIO', '-45,20', '1.200,00'],
  ['02/07/2026', 'TRANSFERENCIA RECIBIDA', '300,00', '1.500,00'],
]

describe('a qué pantalla pertenece un documento', () => {
  it('el acuerdo de Hacienda manda a Deudas y lo explica', () => {
    const r = reconocerDocumento(ACUERDO_AEAT)
    expect(r.tipo).toBe('APLAZAMIENTO')
    expect(r.ruta).toBe('/deudas')
    expect(r.mensaje).toContain('Hacienda')
    // Lo importante del mensaje: que SÍ se puede leer, solo que en otro sitio.
    expect(r.mensaje).toContain('sí se puede leer')
  })

  it('distingue la Seguridad Social de Hacienda al redactar el aviso', () => {
    const r = reconocerDocumento(ACUERDO_TGSS)
    expect(r.tipo).toBe('APLAZAMIENTO')
    expect(r.mensaje).toContain('la Seguridad Social')
  })

  it('un extracto de banco de verdad NO se manda a ninguna parte', () => {
    // Si esto fallara, la importación normal quedaría bloqueada por un aviso.
    expect(reconocerDocumento(EXTRACTO).tipo).toBe('DESCONOCIDO')
  })

  it('no adivina con un documento cualquiera', () => {
    expect(reconocerDocumento([['Hola'], ['Una factura sin más']]).tipo).toBe('DESCONOCIDO')
  })
})
