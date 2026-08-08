import { describe, it, expect } from 'vitest'
import { parsearN43, fecha6, importe14, separarRegistros } from './n43'

/**
 * Constructores de registros según las posiciones de la norma. Se montan campo
 * a campo y se comprueba que cada registro mide 80, para que una prueba nunca
 * pueda "validar" un desplazamiento equivocado.
 */
function reg11(o: {
  entidad?: string
  oficina?: string
  cuenta?: string
  fechaIni?: string
  fechaFin?: string
  signo?: string
  saldo?: string
}): string {
  const r =
    '11' +
    (o.entidad ?? '2100') +
    (o.oficina ?? '0418') +
    (o.cuenta ?? '0200051332') +
    (o.fechaIni ?? '260101') +
    (o.fechaFin ?? '260131') +
    (o.signo ?? '2') +
    (o.saldo ?? '00000000100000') +
    '978' + // divisa
    '3' + // modalidad
    'CUENTA CORRIENTE'.padEnd(26) +
    ''.padEnd(3)
  return r.padEnd(80).slice(0, 80)
}

function reg22(o: {
  fechaOp?: string
  fechaValor?: string
  comun?: string
  propio?: string
  signo?: string
  importe?: string
  documento?: string
  ref1?: string
  ref2?: string
}): string {
  const r =
    '22' +
    '    ' + // 3-6 libre
    '0418' + // 7-10 oficina origen
    (o.fechaOp ?? '260115') +
    (o.fechaValor ?? '260115') +
    (o.comun ?? '12') +
    (o.propio ?? '001') +
    (o.signo ?? '2') +
    (o.importe ?? '00000000012100') +
    (o.documento ?? '0000000001') +
    (o.ref1 ?? 'REF123456789').padEnd(12) +
    (o.ref2 ?? '').padEnd(16)
  return r.padEnd(80).slice(0, 80)
}

function reg23(texto: string, codigo = '01'): string {
  return ('23' + codigo + texto.padEnd(38) + ''.padEnd(38)).padEnd(80).slice(0, 80)
}

function reg33(o: { apuntes?: string; debe?: string; haber?: string; signo?: string; saldo?: string }): string {
  const r =
    '33' +
    '2100' +
    '0418' +
    '0200051332' +
    (o.apuntes ?? '00002') +
    (o.debe ?? '00000000005000') +
    (o.haber ?? '00000000012100') +
    (o.signo ?? '2') +
    (o.saldo ?? '00000000107100') +
    '978' +
    ''.padEnd(9)
  return r.padEnd(80).slice(0, 80)
}

const reg88 = '88'.padEnd(80)

describe('los registros de prueba miden 80 caracteres', () => {
  it('cumplen la norma', () => {
    expect(reg11({})).toHaveLength(80)
    expect(reg22({})).toHaveLength(80)
    expect(reg23('X')).toHaveLength(80)
    expect(reg33({})).toHaveLength(80)
  })
})

describe('conversión de fecha (AAMMDD)', () => {
  it('convierte a ISO', () => {
    expect(fecha6('260115')).toBe('2026-01-15')
    expect(fecha6('251231')).toBe('2025-12-31')
  })
  it('rechaza fechas imposibles en vez de inventarlas', () => {
    expect(fecha6('263201')).toBeUndefined() // mes 32
    expect(fecha6('260230')).toBeUndefined() // 30 de febrero
    expect(fecha6('260001')).toBeUndefined() // mes 0
    expect(fecha6('26011')).toBeUndefined() // longitud incorrecta
    expect(fecha6('2601AB')).toBeUndefined()
  })
})

describe('conversión de importe (14 dígitos en céntimos)', () => {
  it('aplica dos decimales implícitos', () => {
    expect(importe14('00000000012100', '2')).toBe(121)
    expect(importe14('00000000000001', '2')).toBe(0.01)
  })
  it('el adeudo es negativo', () => {
    expect(importe14('00000000005000', '1')).toBe(-50)
  })
  it('rechaza lo que no son dígitos', () => {
    expect(importe14('0000ABCD012100', '2')).toBeUndefined()
  })
})

describe('parser Norma 43 — fichero correcto', () => {
  const fichero = [
    reg11({}),
    reg22({ fechaOp: '260115', fechaValor: '260116', signo: '2', importe: '00000000012100' }),
    reg23('PAGO TARJETA COMERCIO'),
    reg22({ fechaOp: '260120', fechaValor: '260120', signo: '1', importe: '00000000005000', comun: '03' }),
    reg33({}),
    reg88,
  ].join('\n')
  const r = parsearN43(fichero)

  it('no da errores', () => {
    expect(r.errores).toEqual([])
  })

  it('lee la cabecera de cuenta', () => {
    expect(r.cuentas).toHaveLength(1)
    expect(r.cuentas[0].banco).toBe('2100')
    expect(r.cuentas[0].cuenta).toBe('0200051332')
    expect(r.cuentas[0].saldoInicial).toBe(1000)
    expect(r.cuentas[0].fechaInicial).toBe('2026-01-01')
    expect(r.cuentas[0].fechaFinal).toBe('2026-01-31')
  })

  it('lee las fechas del movimiento en la posición correcta', () => {
    const m = r.cuentas[0].movimientos
    expect(m[0].fechaOperacion).toBe('2026-01-15')
    expect(m[0].fechaValor).toBe('2026-01-16')
    expect(m[1].fechaOperacion).toBe('2026-01-20')
  })

  it('lee los importes con su signo y sin desbordarse', () => {
    const m = r.cuentas[0].movimientos
    expect(m[0].importe).toBe(121)
    expect(m[1].importe).toBe(-50)
  })

  it('lee documento y referencia', () => {
    expect(r.cuentas[0].movimientos[0].documento).toBe('0000000001')
    expect(r.cuentas[0].movimientos[0].referencia).toBe('REF123456789')
  })

  it('asocia el concepto complementario (registro 23)', () => {
    expect(r.cuentas[0].movimientos[0].concepto).toContain('PAGO TARJETA COMERCIO')
  })

  it('sin registro 23 usa la glosa del concepto común', () => {
    expect(r.cuentas[0].movimientos[1].concepto).toBe('Domiciliaciones / recibos / letras')
  })

  it('lee el fin de cuenta', () => {
    expect(r.cuentas[0].apuntesDeclarados).toBe(2)
    expect(r.cuentas[0].saldoFinal).toBe(1071)
  })
})

describe('parser Norma 43 — el fichero no puede colar datos falsos', () => {
  it('avisa si el nº de apuntes declarado no coincide', () => {
    const f = [reg11({}), reg22({}), reg33({ apuntes: '00005' }), reg88].join('\n')
    const r = parsearN43(f)
    expect(r.errores.some((e) => /declara 5 apuntes/.test(e))).toBe(true)
  })

  it('avisa si el saldo final no cuadra con los movimientos', () => {
    const f = [reg11({}), reg22({ importe: '00000000012100' }), reg33({ apuntes: '00001', debe: '00000000000000', saldo: '00000099999999' })].join('\n')
    const r = parsearN43(f)
    expect(r.errores.some((e) => /no cuadra/.test(e))).toBe(true)
  })

  it('descarta el movimiento con fecha ilegible y lo dice', () => {
    const f = [reg11({}), reg22({ fechaOp: '263201' }), reg88].join('\n')
    const r = parsearN43(f)
    expect(r.cuentas[0].movimientos).toHaveLength(0)
    expect(r.errores.some((e) => /fecha de operación ilegible/.test(e))).toBe(true)
  })

  it('descarta el movimiento con importe ilegible y lo dice', () => {
    const f = [reg11({}), reg22({ importe: 'XXXXXXXXXXXXXX' }), reg88].join('\n')
    const r = parsearN43(f)
    expect(r.cuentas[0].movimientos).toHaveLength(0)
    expect(r.errores.some((e) => /importe ilegible/.test(e))).toBe(true)
  })

  it('avisa de un movimiento sin cabecera de cuenta', () => {
    const r = parsearN43([reg22({}), reg88].join('\n'))
    expect(r.errores.some((e) => /antes de la cabecera/.test(e))).toBe(true)
  })
})

describe('parser Norma 43 — formatos de fichero', () => {
  it('admite ficheros sin saltos de línea, troceando de 80 en 80', () => {
    const seguido = [reg11({}), reg22({}), reg33({ apuntes: '00001', debe: '00000000000000', haber: '00000000012100', saldo: '00000000112100' }), reg88].join('')
    expect(separarRegistros(seguido)).toHaveLength(4)
    const r = parsearN43(seguido)
    expect(r.cuentas[0].movimientos).toHaveLength(1)
    expect(r.cuentas[0].movimientos[0].importe).toBe(121)
  })

  it('admite CRLF y registros recortados por la cola', () => {
    const corto = reg22({}).trimEnd()
    const f = [reg11({}), corto, reg88].join('\r\n')
    const r = parsearN43(f)
    expect(r.cuentas[0].movimientos[0].importe).toBe(121)
  })

  it('varias cuentas en el mismo fichero no se mezclan', () => {
    const f = [
      reg11({ cuenta: '1111111111' }),
      reg22({ importe: '00000000010000' }),
      reg33({ apuntes: '00001', debe: '00000000000000', haber: '00000000010000', saldo: '00000000110000' }),
      reg11({ cuenta: '2222222222' }),
      reg22({ importe: '00000000020000' }),
      reg33({ apuntes: '00001', debe: '00000000000000', haber: '00000000020000', saldo: '00000000120000' }),
      reg88,
    ].join('\n')
    const r = parsearN43(f)
    expect(r.cuentas).toHaveLength(2)
    expect(r.cuentas[0].movimientos[0].importe).toBe(100)
    expect(r.cuentas[1].movimientos[0].importe).toBe(200)
    expect(r.errores).toEqual([])
  })
})
