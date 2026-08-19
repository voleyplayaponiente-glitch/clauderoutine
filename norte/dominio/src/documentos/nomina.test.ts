import { describe, expect, it } from 'vitest'
import { apunteDeNomina, leerNomina, pareceNomina } from './nomina.js'

/**
 * Copia la maquetación de un recibo de salario real: el mismo orden de líneas,
 * el mismo bloque de coste de empresa al final y la misma fila de totales sin
 * etiquetas. Las cifras y la empresa son inventadas, pero **cuadran**: 3.435,05
 * de devengos − 991,45 de deducciones = 2.443,60 de líquido. Si no cuadraran,
 * la prueba no probaría nada, porque el lector se apoya justo en esa resta.
 */
const RECIBO = `EJEMPLO PUBLICIDAD, S.L.U.
CALLE INVENTADA 12, 28703 - Alcobendas, MADRID B12345674 03199999999
ANA PEREZ GARCIA 01/07/2026 - 31/07/2026 30
281234567840 00000000T 02/11/2017 EJECUTIVA DE CUENTAS 1
1,00 1.510,82 Salario Base 1.510,82
1,00 199,82 Complemento Personal 199,82
Incentivos\\Objetivos 1.628,51
331,84 0,26 Kilometraje Exento 86,28
Seguro de Vida 8,06
Retención IRPF Especie no repercutido 1,56
19,34 8,06 I.R.P.F. P. Especie no Reperc. 1,56
19,34% 3.339,15 Retención a Cuenta del IRPF 645,79
4,70% 3.842,45 Cotización Cont. Comunes 180,60
1,65% 3.842,45 Cotización D+FP 63,40
0,15 3.842,45 Cotiz. MEI Empleado 5,76
Regularización Dietas 86,28
Base sal. esp. no repercutidos retenidos 8,06
Coste SS Empresa......................... 1243,02
. Cot. SS Empresa CC.................. 906,81
. Cot. SS Empresa MEI.................. 28,82
3.464,74 377,71 0,00 3.842,45 3.842,45 3.339,15 3.435,05 991,45
Acum. Base IRPF 23.919,87 Acum. IRPF Esp. Rep 0,00 2.443,60 €
Acum. IRPF 4.257,31
Acum. Cotiz. S.S. 1.582,21`

describe('leer una nómina', () => {
  it('la reconoce como nómina antes de intentar leerla', () => {
    expect(pareceNomina(RECIBO)).toBeGreaterThanOrEqual(2)
    expect(pareceNomina('Extracto de movimientos de la cuenta')).toBe(0)
  })

  it('saca el líquido aunque el recibo no escriba la palabra en ningún sitio', () => {
    expect(leerNomina(RECIBO).neto).toBe(244360)
  })

  it('deduce el bruto cuadrando la resta, no adivinando la columna', () => {
    expect(leerNomina(RECIBO).bruto).toBe(343505)
  })

  it('suma el IRPF y las cotizaciones del trabajador sin colar las de la empresa', () => {
    const nomina = leerNomina(RECIBO)
    expect(nomina.irpf).toBe(64579)
    // 180,60 + 63,40 + 5,76. Los 906,81 de «Cot. SS Empresa CC» no cuentan.
    expect(nomina.cotizaciones).toBe(24976)
  })

  it('lee empresa, CIF y periodo', () => {
    const nomina = leerNomina(RECIBO)
    expect(nomina.empresa).toBe('EJEMPLO PUBLICIDAD, S.L.U.')
    expect(nomina.cif).toBe('B12345674')
    expect(nomina.periodo).toEqual({ desde: '2026-07-01', hasta: '2026-07-31' })
  })

  it('avisa en vez de inventarse el bruto cuando la cuenta no sale', () => {
    const nomina = leerNomina('Líquido a percibir 1.000,00\nY nada más que cuadre')
    expect(nomina.neto).toBe(100000)
    expect(nomina.bruto).toBeNull()
    expect(nomina.avisos.join(' ')).toMatch(/cuadrar/i)
  })
})

describe('el movimiento que propone una nómina', () => {
  it('es un ingreso por el líquido el último día del periodo', () => {
    const apunte = apunteDeNomina(leerNomina(RECIBO))
    expect(apunte).toMatchObject({
      fecha: '2026-07-31',
      importe: 244360,
      concepto: 'Nómina 2026-07 · EJEMPLO PUBLICIDAD, S.L.U.',
    })
  })

  it('no propone nada si no ha podido leer el líquido', () => {
    expect(apunteDeNomina(leerNomina('Un documento cualquiera'))).toBeNull()
  })

  it('da la misma huella a la misma nómina aunque se vuelva a subir corregida', () => {
    const original = apunteDeNomina(leerNomina(RECIBO))
    const corregida = apunteDeNomina(leerNomina(RECIBO.replace('2.443,60 €', '2.500,00 €')))
    // Cambia el importe, no la identidad: es la nómina de julio de la misma
    // empresa, y tiene que reconocerse como tal en vez de colarse como un
    // segundo sueldo del mismo mes.
    expect(corregida!.importe).toBe(250000)
    expect(corregida!.huella).toBe(original!.huella)
  })
})
