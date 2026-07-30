import { describe, it, expect } from 'vitest'
import { saldoCuenta, tesoreriaTotal, totalArqueo, evaluarArqueo } from './tesoreria'
import type { CuentaTesoreria, MovimientoTesoreria, Denominacion } from './tipos'

const caja: CuentaTesoreria = {
  id: 'caja1', creadoEn: '', creadoPor: 'admin', origen: 'MANUAL',
  nombre: 'Caja Tienda', tipo: 'CAJA', saldoInicial: 100, cuentaPGC: '570',
}
function mov(p: Partial<MovimientoTesoreria>): MovimientoTesoreria {
  return { id: 'm', creadoEn: '', creadoPor: 'admin', origen: 'MANUAL', cuentaId: 'caja1', fecha: '2026-07-30', concepto: '', importe: 0, clase: 'OTRO', conciliado: false, ...p }
}

describe('saldos de tesorería', () => {
  it('saldo = inicial + movimientos, ignorando anulados', () => {
    const movs = [mov({ importe: 50 }), mov({ importe: -30 }), mov({ importe: 999, anuladoEn: '2026-07-30' })]
    expect(saldoCuenta(caja, movs)).toBe(120)
  })
  it('tesorería total suma varias cuentas', () => {
    const banco: CuentaTesoreria = { ...caja, id: 'b1', tipo: 'BANCO', saldoInicial: 1000 }
    const movs = [mov({ cuentaId: 'caja1', importe: 20 }), mov({ cuentaId: 'b1', importe: -200 })]
    expect(tesoreriaTotal([caja, banco], movs)).toBe(920)
  })
})

describe('arqueo de caja', () => {
  const den: Denominacion[] = [
    { valor: 50, cantidad: 2 }, // 100
    { valor: 20, cantidad: 1 }, // 20
    { valor: 0.5, cantidad: 3 }, // 1.50
    { valor: 0.01, cantidad: 5 }, // 0.05
  ]
  it('suma el total contado por denominación', () => {
    expect(totalArqueo(den)).toBe(121.55)
  })
  it('marca descuadre solo si supera el umbral', () => {
    const r = evaluarArqueo(den, 120, 5)
    expect(r.diferencia).toBe(1.55)
    expect(r.superaUmbral).toBe(false)
    const r2 = evaluarArqueo(den, 100, 5)
    expect(r2.diferencia).toBe(21.55)
    expect(r2.requiereExplicacion).toBe(true)
  })
})
