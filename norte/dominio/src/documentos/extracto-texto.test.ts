import { describe, expect, it } from 'vitest'
import { leerExtractoDeTexto } from './extracto-texto.js'

/**
 * Reproduce la maquetación de un extracto en PDF real —con el concepto partido
 * en dos líneas y la continuación colgando de la línea de «Fecha valor»— pero
 * con nombres e importes inventados.
 */
const PDF = `TITULAR: PEREZ GARCIA ANA
CUENTA NÓMINA: ES9121000418450200051332
Saldo: 25.074,47 EUR (a fecha 19/08/2026)
Movimientos de cuenta del 1 Agosto 2026 al 19 Agosto 2026 Ordenados por fecha
Fecha operación Operación Importe Saldo
17/08/2026 Bizum De Marta Ruiz Concepto Cena Del Sábado En 35,00 EUR 25.074,47 EUR
Fecha valor: 17/08/2026 El Puerto
06/08/2026 Transferencia Inmediata A Favor De Ana Perez -1.000,00 EUR 24.959,47 EUR
Fecha valor: 05/08/2026
03/08/2026 Liquidacion De Las Tarjetas De Credito Del Contrato -111,35 EUR 15.959,47 EUR
Fecha valor: 03/08/2026 0049 1345 502 0002359
Documento impreso: 19 Agosto 2026 a las 10:06 Página 1 de 1`

describe('leer un extracto en texto', () => {
  it('lee los tres movimientos y deja fuera cabecera y pie', () => {
    const lectura = leerExtractoDeTexto(PDF)
    expect(lectura.apuntes).toHaveLength(3)
    expect(lectura.desde).toBe('2026-08-03')
    expect(lectura.hasta).toBe('2026-08-17')
  })

  it('recompone el concepto partido en dos líneas', () => {
    const [bizum] = leerExtractoDeTexto(PDF).apuntes
    expect(bizum!.concepto).toBe('Bizum De Marta Ruiz Concepto Cena Del Sábado En El Puerto')
  })

  it('separa el importe del saldo y no los confunde', () => {
    const apuntes = leerExtractoDeTexto(PDF).apuntes
    expect(apuntes.map((a) => a.importe)).toEqual([3500, -100000, -11135])
    expect(apuntes.map((a) => a.saldo)).toEqual([2507447, 2495947, 1595947])
  })

  it('coge la fecha valor de la línea de continuación', () => {
    const [, transferencia] = leerExtractoDeTexto(PDF).apuntes
    expect(transferencia!.fecha).toBe('2026-08-06')
    expect(transferencia!.fechaValor).toBe('2026-08-05')
  })

  it('lee titular, IBAN y saldo de la cabecera', () => {
    const { cuenta } = leerExtractoDeTexto(PDF)
    expect(cuenta.titular).toBe('PEREZ GARCIA ANA')
    expect(cuenta.ibanUltimos4).toBe('1332')
    expect(cuenta.saldoFinal).toBe(2507447)
  })

  it('dice que el PDF podría ser un escaneado en vez de callarse', () => {
    const lectura = leerExtractoDeTexto('Documento sin texto útil')
    expect(lectura.apuntes).toHaveLength(0)
    expect(lectura.avisos[0]).toMatch(/escaneada/i)
  })

  it('acepta líneas con un solo importe y no lo toma por el saldo', () => {
    const lectura = leerExtractoDeTexto('01/08/2026 Recibo de la luz -61,20')
    expect(lectura.apuntes[0]!.importe).toBe(-6120)
    expect(lectura.apuntes[0]!.saldo).toBeUndefined()
  })
})
