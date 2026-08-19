import { describe, expect, it } from 'vitest'
import { type Celda, leerTablaDeApuntes } from './tabla.js'

/**
 * Las dos cuadrículas de abajo reproducen **la forma exacta** de dos extractos
 * de banco reales (dónde empieza la tabla, qué columnas hay y cómo se llaman).
 * Los datos sí están cambiados: nombres, números de cuenta e importes son
 * inventados, porque un fichero de pruebas acaba en el repositorio y el
 * extracto de alguien no tiene por qué acabar ahí.
 */

// Cabecera en la fila 5, columna A vacía, la descripción repartida en tres
// columnas y dos columnas llamadas «Divisa».
const HOJA_A: Celda[][] = [
  [],
  ['', '', '', 'Últimos movimientos'],
  ['', '', '', 'Fecha de generación del informe: 19/08/2026'],
  [],
  ['', 'F.Valor', 'Fecha', 'Concepto', 'Movimiento', 'Importe', 'Divisa', 'Disponible', 'Divisa', 'Observaciones'],
  ['', '18/08/2026', '18/08/2026', 'Recarga de tarjetas prepago', '4532015112830366 01827013 716', -80, 'EUR', 12386.92, 'EUR', '4532015112830366 01827013 716'],
  ['', '06/08/2026', '06/08/2026', 'Transferencia realizada', 'Alquiler agosto', -750, 'EUR', 12466.92, 'EUR', 'Alquiler agosto'],
  ['', '03/08/2026', '03/08/2026', 'Abono por disposicion de prestamo/credito', 'Abono capital préstamo', 15000, 'EUR', 24840.73, 'EUR', 'Referencia interna'],
]

// Cabecera en la fila 8, con titular y saldo sueltos arriba en dos filas.
const HOJA_B: Celda[][] = [
  ['', '', 'CUENTA NÓMINA', 'FECHA', ''],
  ['', '', 'ES9121000418450200051332', '19/08/2026 | 10:06:50', ''],
  ['', '', 'Titular', 'Saldo', ''],
  ['', '', 'PEREZ GARCIA ANA', '25.074,47 EUR', ''],
  ['', '', '', '', ''],
  ['Movimientos', '', '', '', ''],
  ['', '', '', '', ''],
  ['FECHA OPERACIÓN', 'FECHA VALOR', 'CONCEPTO', 'IMPORTE EUR', 'SALDO'],
  ['17/08/2026', '17/08/2026', 'Bizum De Marta Ruiz Concepto Cena', 35.0, 25074.47],
  ['06/08/2026', '05/08/2026', 'Transferencia Inmediata A Favor De Ana Perez', -1000.0, 24959.47],
]

describe('leer una tabla de movimientos', () => {
  it('encuentra la cabecera aunque no esté en la primera fila', () => {
    const lectura = leerTablaDeApuntes(HOJA_A)
    expect(lectura.apuntes).toHaveLength(3)
    expect(lectura.desde).toBe('2026-08-03')
    expect(lectura.hasta).toBe('2026-08-18')
  })

  it('junta las columnas de descripción sin repetir lo que ya ha dicho', () => {
    const [recarga, alquiler, prestamo] = leerTablaDeApuntes(HOJA_A).apuntes
    // «Movimiento» y «Observaciones» traían lo mismo: se dice una vez.
    expect(recarga!.concepto).toBe('Recarga de tarjetas prepago · **** 0366 01827013 716')
    expect(alquiler!.concepto).toBe('Transferencia realizada · Alquiler agosto')
    // Aquí sí eran distintas y las dos aportan.
    expect(prestamo!.concepto).toBe(
      'Abono por disposicion de prestamo/credito · Abono capital préstamo · Referencia interna',
    )
  })

  it('tapa la tarjeta antes de que el concepto salga del motor', () => {
    const [recarga] = leerTablaDeApuntes(HOJA_A).apuntes
    expect(recarga!.concepto).not.toContain('4532015112830366')
    expect(recarga!.tarjeta).toBe('0366')
  })

  it('respeta el signo del importe y lo pasa a céntimos', () => {
    const apuntes = leerTablaDeApuntes(HOJA_A).apuntes
    expect(apuntes.map((a) => a.importe)).toEqual([-8000, -75000, 1500000])
    expect(apuntes[0]!.saldo).toBe(1238692)
  })

  it('lee la cabecera suelta que hay encima de la tabla', () => {
    const lectura = leerTablaDeApuntes(HOJA_B)
    expect(lectura.cuenta.titular).toBe('PEREZ GARCIA ANA')
    // Del IBAN solo sobreviven cuatro cifras, aquí y en todas partes.
    expect(lectura.cuenta.ibanUltimos4).toBe('1332')
    expect(lectura.cuenta.saldoFinal).toBe(2507447)
  })

  it('distingue fecha de operación y fecha valor', () => {
    const [, transferencia] = leerTablaDeApuntes(HOJA_B).apuntes
    expect(transferencia!.fecha).toBe('2026-08-06')
    expect(transferencia!.fechaValor).toBe('2026-08-05')
  })

  it('da huellas distintas a dos apuntes idénticos del mismo día', () => {
    const repetido: Celda[][] = [
      ['Fecha', 'Concepto', 'Importe'],
      ['05/08/2026', 'Recarga', -50],
      ['05/08/2026', 'Recarga', -50],
    ]
    const [uno, dos] = leerTablaDeApuntes(repetido).apuntes
    expect(uno!.huella).not.toBe(dos!.huella)
  })

  it('avisa cuando no hay tabla en vez de devolver una lista vacía sin más', () => {
    const lectura = leerTablaDeApuntes([['Resumen de la cuenta'], ['Nada que ver aquí']])
    expect(lectura.apuntes).toHaveLength(0)
    expect(lectura.avisos[0]).toMatch(/cabecera/i)
  })

  it('entiende un extracto con columnas de cargo y abono separadas', () => {
    const conDebeHaber: Celda[][] = [
      ['Fecha', 'Descripción', 'Cargo', 'Abono', 'Saldo'],
      ['01/08/2026', 'Recibo de la luz', '61,20', '', '1.000,00'],
      ['02/08/2026', 'Devolución', '', '15,00', '1.015,00'],
    ]
    const apuntes = leerTablaDeApuntes(conDebeHaber).apuntes
    expect(apuntes.map((a) => a.importe)).toEqual([-6120, 1500])
  })
})
