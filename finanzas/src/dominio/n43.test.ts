import { describe, it, expect } from 'vitest'
import { parsearN43 } from './n43'

// Construye líneas N43 de posiciones fijas para la prueba.
const cabecera =
  '11' + '2100' + '0418' + '0200051332' + '260101' + '260131' + '2' + '00000000100000'
const movAbono =
  '22' + '0418' + '260115' + '260115' + '03' + '001' + '2' + '00000000012100' + '0000000000' + 'TARJETA VISA'
const concepto = '23' + '01' + 'PAGO TARJETA COMERCIO'.padEnd(38) + ''.padEnd(38)
const movAdeudo =
  '22' + '0418' + '260120' + '260120' + '03' + '002' + '1' + '00000000005000' + '0000000000' + 'RECIBO LUZ   '

const fichero = [cabecera, movAbono, concepto, movAdeudo, '33', '88'].join('\n')

describe('parser Norma 43', () => {
  const r = parsearN43(fichero)

  it('lee una cuenta con su saldo inicial', () => {
    expect(r.cuentas).toHaveLength(1)
    expect(r.cuentas[0].cuenta).toBe('0200051332')
    expect(r.cuentas[0].saldoInicial).toBe(1000)
    expect(r.errores).toHaveLength(0)
  })
  it('lee movimientos con signo correcto', () => {
    const movs = r.cuentas[0].movimientos
    expect(movs).toHaveLength(2)
    expect(movs[0].importe).toBe(121) // abono +
    expect(movs[1].importe).toBe(-50) // adeudo −
  })
  it('asocia el concepto complementario (registro 23) al movimiento', () => {
    expect(r.cuentas[0].movimientos[0].concepto).toContain('PAGO TARJETA COMERCIO')
  })
  it('convierte la fecha YYMMDD a ISO', () => {
    expect(r.cuentas[0].movimientos[0].fechaOperacion).toBe('2026-01-15')
  })
})
