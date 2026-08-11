import { describe, it, expect } from 'vitest'
import { esAplazamiento, leerAplazamiento } from './aplazamiento-aeat'

/**
 * Acuerdo REAL de concesión de aplazamiento de la AEAT (expediente
 * 032640410056F de BESPAIN 7777 SLU, Impuesto sobre Sociedades 2025), tal y
 * como lo entrega `celdasDePdf`. Se han conservado las páginas que importan:
 * la 1 (identificación e importe), la 7-8 (ANEXO I, el calendario) y el
 * principio del ANEXO II.
 *
 * Lo que este documento enseñó, y que el supuesto anterior no tenía:
 *  · la fecha va **al final** de la fila y con guiones (`20-10-2026`);
 *  · cada fila trae **cinco** importes (principal · recargo · total deuda ·
 *    intereses · total del plazo), no tres;
 *  · el NIF se escribe «N.I.F.:», con puntos;
 *  · el importe aplazado va **dentro de una frase**, no tras un rótulo;
 *  · y el **ANEXO II repite los doce plazos** con sus fechas e importes, así que
 *    leerlo entero duplicaba el calendario.
 */
const ACUERDO_REAL = [
  ['Delegación Especial de COM. VALENCIANA'],
  ['DEPENDENCIA REGIONAL DE RECAUDACIÓN'],
  ['Nº Certificado: 2659665508243'],
  ['BESPAIN 7777 SLU'],
  ['CONCESIÓN DEL APLAZAMIENTO/FRACCIONAMIENTO DE PAGO SIN GARANTÍA'],
  ['IDENTIFICACIÓN DEL DOCUMENTO'],
  ['N.I.F.:', 'B56241854'],
  ['Deudor:', 'BESPAIN 7777 SLU'],
  ['Número de expediente:', '032640410056F'],
  ['ACUERDO'],
  ['Vista la petición de aplazamiento/fraccionamiento formulada por el obligado al pago para el ingreso de'],
  ['la/s deuda/s que se relacionan en el', 'Anexo I', 'por un importe de 12.449,65 euros.'],
  ['Se acuerda CONCEDER el aplazamiento/fraccionamiento del pago de la/s deuda/s en el/los plazo/s que'],
  ['LIQUIDACIÓN DE INTERESES DE DEMORA'],
  ['En el', 'Anexo II', 'se recoge la liquidación de los intereses de demora.'],
  ['El importe de los plazos y los intereses de demora correspondientes se cargarán en las fechas de'],
  ['vencimiento señaladas en el acuerdo, en la cuenta ES31-2100-3985-5902-0036-5748, o en aquella otra'],
  ['ANEXO I: DEUDAS Y PLAZOS DE LA NOTIFICACIÓN'],
  ['N.I.F.:', 'B56241854'],
  ['Número de expediente:', '032640410056F'],
  ['Número Liquidación: A0303126530134868'],
  ['Concepto: IMPTO SOBRE SOCIEDADES DECLARACION ANUAL'],
  ['Fecha de Intereses: 27-07-2026'],
  ['Importe principal', 'Recargo de', 'Importe total', 'Importe de los', 'Importe total del', 'Fecha de'],
  ['deuda (1)', 'apremio (2)', 'deuda (1+2)', 'intereses (3)', 'plazo (1+2+3)', 'vencimiento'],
  ['1.037,47', '0,00', '1.037,47', '9,82', '1.047,29', '20-10-2026'],
  ['1.037,47', '0,00', '1.037,47', '13,39', '1.050,86', '20-11-2026'],
  ['1.037,47', '0,00', '1.037,47', '16,86', '1.054,33', '21-12-2026'],
  ['1.037,47', '0,00', '1.037,47', '20,44', '1.057,91', '20-01-2027'],
  ['1.037,47', '0,00', '1.037,47', '24,02', '1.061,49', '22-02-2027'],
  ['Importe principal', 'Recargo de', 'Importe total', 'Importe de los', 'Importe total del', 'Fecha de'],
  ['deuda (1)', 'apremio (2)', 'deuda (1+2)', 'intereses (3)', 'plazo (1+2+3)', 'vencimiento'],
  ['1.037,47', '0,00', '1.037,47', '27,25', '1.064,72', '22-03-2027'],
  ['1.037,47', '0,00', '1.037,47', '30,83', '1.068,30', '20-04-2027'],
  ['1.037,47', '0,00', '1.037,47', '34,30', '1.071,77', '20-05-2027'],
  ['1.037,47', '0,00', '1.037,47', '37,87', '1.075,34', '21-06-2027'],
  ['1.037,47', '0,00', '1.037,47', '41,34', '1.078,81', '20-07-2027'],
  ['1.037,47', '0,00', '1.037,47', '44,92', '1.082,39', '20-08-2027'],
  ['1.037,48', '0,00', '1.037,48', '48,50', '1.085,98', '20-09-2027'],
  ['--------------------', '--------------------', '--------------------', '--------------------', '--------------------'],
  ['12.449,65', '0,00', '12.449,65', '349,54', '12.799,19'],
  ['TOTAL GENERAL'],
  ['12.449,65', '0,00', '12.449,65', '349,54', '12.799,19'],
  ['ANEXO II: LIQUIDACIÓN DE INTERESES DE DEMORA RESULTADO DE LA CONCESIÓN DEL APLAZAMIENTO'],
  ['DETALLE DE LA LIQUIDACIÓN'],
  ['A0303126530134868', '1.037,47 28-07-2026 20-10-2026', '85', '4.062', '9,82', '9,82'],
  ['A0303126530134868', '1.037,47 28-07-2026 20-11-2026', '116', '4.062', '13,39', '13,39'],
  ['A0303126530134868', '1.037,47 28-07-2026 20-12-2026', '146', '4.062', '16,86', '16,86'],
  ['TOTAL', '-------------------', '349,54'],
]

describe('acuerdo REAL de aplazamiento de la AEAT', () => {
  const d = leerAplazamiento(ACUERDO_REAL)

  it('reconoce el documento como aplazamiento de Hacienda', () => {
    expect(esAplazamiento(ACUERDO_REAL).es).toBe(true)
    expect(esAplazamiento(ACUERDO_REAL).organismo).toBe('HACIENDA')
  })

  it('lee los DOCE plazos del Anexo I, ni uno más', () => {
    // El Anexo II repite los mismos plazos con sus fechas: si se leyera, saldrían
    // quince y el calendario estaría duplicado.
    expect(d.plazos.length).toBe(12)
    expect(d.plazos[0].fecha).toBe('2026-10-20')
    expect(d.plazos[11].fecha).toBe('2027-09-20')
  })

  it('separa principal e intereses de cada plazo', () => {
    expect(d.plazos[0]).toEqual({ fecha: '2026-10-20', cuota: 1047.29, intereses: 9.82, capital: 1037.47 })
    expect(d.plazos[11]).toEqual({ fecha: '2027-09-20', cuota: 1085.98, intereses: 48.5, capital: 1037.48 })
  })

  it('la suma de los plazos es la del documento', () => {
    expect(d.totalPlazos).toBe(12799.19)
    const capital = d.plazos.reduce((s, p) => s + (p.capital ?? 0), 0)
    expect(Math.round(capital * 100) / 100).toBe(12449.65)
    const intereses = d.plazos.reduce((s, p) => s + (p.intereses ?? 0), 0)
    expect(Math.round(intereses * 100) / 100).toBe(349.54)
  })

  it('lee el expediente, el NIF y el importe aplazado', () => {
    expect(d.referencia).toBe('032640410056F')
    expect(d.nif).toBe('B56241854')
    expect(d.importeTotal).toBe(12449.65)
  })

  it('el cuadre sale: principal + intereses = suma de los plazos', () => {
    expect(d.avisos.some((a) => a.includes('no cuadra'))).toBe(false)
  })

  it('no confunde el IBAN de domiciliación con una fecha', () => {
    // «ES31-2100-3985-5902-0036-5748» tiene guiones y cifras, pero no es un plazo.
    expect(d.plazos.every((p) => p.fecha >= '2026-10-20')).toBe(true)
  })
})
