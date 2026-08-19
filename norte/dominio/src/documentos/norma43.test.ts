import { describe, expect, it } from 'vitest'
import { leerNorma43, pareceNorma43 } from './norma43.js'

/**
 * El Cuaderno 43 es un formato publicado, así que aquí sí se puede construir el
 * fichero de prueba desde la especificación sin caer en el problema de inventar
 * una maquetación: las posiciones son las del cuaderno, no las que a uno le
 * parezcan.
 */
function registro(campos: [number, number, string][]): string {
  const linea = new Array(80).fill(' ')
  for (const [desde, hasta, valor] of campos) {
    const ancho = hasta - desde + 1
    // Los campos numéricos van con ceros a la izquierda y los de texto con
    // espacios a la derecha, tal como los escribe el banco.
    const relleno = /^\d*$/.test(valor) ? valor.padStart(ancho, '0') : valor.padEnd(ancho, ' ')
    for (let i = 0; i < ancho; i++) linea[desde - 1 + i] = relleno[i] ?? ' '
  }
  return linea.join('')
}

const FICHERO = [
  registro([
    [1, 2, '11'],
    [3, 6, '2100'],
    [7, 10, '0418'],
    [11, 20, '0200051332'],
    [21, 26, '260801'],
    [27, 32, '260819'],
    [33, 33, '2'],
    [34, 47, '2000000'],
    [48, 50, '978'],
    [51, 51, '3'],
    [52, 77, 'PEREZ GARCIA ANA'],
  ]),
  registro([
    [1, 2, '22'],
    [7, 10, '0418'],
    [11, 16, '260803'],
    [17, 22, '260803'],
    [23, 24, '03'],
    [25, 27, '001'],
    [28, 28, '1'],
    [29, 42, '11135'],
    [53, 64, 'TARJETAS'],
    [65, 80, 'LIQUIDACION'],
  ]),
  registro([
    [1, 2, '23'],
    [3, 4, '01'],
    [5, 42, 'CONTRATO 0049 1345 502'],
    [43, 80, 'CUOTA MENSUAL'],
  ]),
  registro([
    [1, 2, '22'],
    [7, 10, '0418'],
    [11, 16, '260817'],
    [17, 22, '260818'],
    [23, 24, '12'],
    [25, 27, '002'],
    [28, 28, '2'],
    [29, 42, '3500'],
    [53, 64, 'BIZUM'],
    [65, 80, 'MARTA RUIZ'],
  ]),
  registro([
    [1, 2, '33'],
    [3, 6, '2100'],
    [7, 10, '0418'],
    [11, 20, '0200051332'],
    [21, 25, '1'],
    [26, 39, '11135'],
    [40, 44, '1'],
    [45, 58, '3500'],
    [59, 59, '2'],
    [60, 73, '1992365'],
    [74, 76, '978'],
  ]),
  registro([
    [1, 2, '88'],
    [21, 25, '6'],
  ]),
].join('\n')

describe('leer un fichero Norma 43', () => {
  it('lo reconoce por sus registros y no por la extensión', () => {
    expect(pareceNorma43(FICHERO)).toBe(true)
    expect(pareceNorma43('Fecha;Concepto;Importe\n01/08/2026;Luz;-61,20')).toBe(false)
  })

  it('lee los movimientos con el signo del campo debe/haber', () => {
    const { apuntes } = leerNorma43(FICHERO)
    expect(apuntes).toHaveLength(2)
    // El cuaderno da los importes ya en céntimos: 11135 son 111,35 €, y el «1»
    // del campo 28 los convierte en salida de dinero.
    expect(apuntes[0]!.importe).toBe(-11135)
    expect(apuntes[1]!.importe).toBe(3500)
  })

  it('pega los conceptos complementarios al movimiento al que pertenecen', () => {
    const [liquidacion, bizum] = leerNorma43(FICHERO).apuntes
    expect(liquidacion!.concepto).toBe('TARJETAS LIQUIDACION · CONTRATO 0049 1345 502 · CUOTA MENSUAL')
    expect(bizum!.concepto).toBe('BIZUM MARTA RUIZ')
  })

  it('distingue fecha de operación y fecha valor', () => {
    const [, bizum] = leerNorma43(FICHERO).apuntes
    expect(bizum!.fecha).toBe('2026-08-17')
    expect(bizum!.fechaValor).toBe('2026-08-18')
  })

  it('saca del fichero el periodo, el titular y el saldo final', () => {
    const lectura = leerNorma43(FICHERO)
    expect(lectura.desde).toBe('2026-08-01')
    expect(lectura.hasta).toBe('2026-08-19')
    expect(lectura.cuenta.titular).toBe('PEREZ GARCIA ANA')
    expect(lectura.cuenta.ibanUltimos4).toBe('1332')
    expect(lectura.cuenta.saldoFinal).toBe(1992365)
  })
})
