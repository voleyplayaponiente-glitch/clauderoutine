import { describe, it, expect } from 'vitest'
import { proyectarSaldoDiario, detectarTension, type Flujo } from './prevision'

describe('proyección de saldo diario', () => {
  const flujos: Flujo[] = [
    { fecha: '2026-07-02', importe: -500, concepto: 'Pago proveedor', categoria: 'compras' },
    { fecha: '2026-07-03', importe: 800, concepto: 'Cobro cliente', categoria: 'cobros' },
  ]
  const serie = proyectarSaldoDiario(1000, flujos, '2026-07-01', 4)

  it('genera un punto por día', () => {
    expect(serie).toHaveLength(4)
    expect(serie[0].fecha).toBe('2026-07-01')
    expect(serie[3].fecha).toBe('2026-07-04')
  })
  it('acumula entradas y salidas sobre el saldo inicial', () => {
    expect(serie[0].saldo).toBe(1000) // sin flujos
    expect(serie[1].saldo).toBe(500) // −500
    expect(serie[2].saldo).toBe(1300) // +800
    expect(serie[3].saldo).toBe(1300)
  })
})

describe('detección de tensión de liquidez', () => {
  it('marca el primer día bajo el mínimo y el saldo más bajo', () => {
    const serie = proyectarSaldoDiario(1000, [
      { fecha: '2026-07-02', importe: -900, concepto: 'x', categoria: 'c' },
    ], '2026-07-01', 3)
    const t = detectarTension(serie, 300)
    expect(t.hayTension).toBe(true)
    expect(t.primerDia).toBe('2026-07-02')
    expect(t.saldoMinimo).toBe(100)
  })
  it('sin tensión si nunca baja del mínimo', () => {
    const serie = proyectarSaldoDiario(1000, [], '2026-07-01', 3)
    expect(detectarTension(serie, 300).hayTension).toBe(false)
  })
})
