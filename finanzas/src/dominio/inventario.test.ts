import { describe, it, expect } from 'vitest'
import { calcularRegularizacion, asientoRegularizacion } from './inventario'
import { comprobarCuadre, saldoCuenta } from './partida-doble'
import type { MovimientoStock } from './tipos'

function mov(p: Partial<MovimientoStock>): MovimientoStock {
  return { id: Math.random().toString(), creadoEn: '2026-01-01T00:00:00Z', creadoPor: 'admin', origen: 'MANUAL', articuloId: 'a1', almacenId: 'alm1', fecha: '2026-01-01', tipo: 'COMPRA', cantidad: 0, costeUnitario: 0, esAprovisionamientoApertura: false, ...p }
}

describe('inventario físico', () => {
  const movs = [
    mov({ cantidad: 10, costeUnitario: 2 }),
    mov({ fecha: '2026-01-02', creadoEn: '2026-01-02T00:00:00Z', cantidad: 10, costeUnitario: 3 }),
  ] // teórica 20 @ 2,50

  it('calcula la diferencia y su valor', () => {
    const r = calcularRegularizacion('a1', 'alm1', 17, movs)
    expect(r.teorica).toBe(20)
    expect(r.diferencia).toBe(-3)
    expect(r.costeMedio).toBe(2.5)
    expect(r.valorDiferencia).toBe(-7.5)
  })
  it('genera un asiento cuadrado (faltante → 610 debe / 300 haber)', () => {
    const r = calcularRegularizacion('a1', 'alm1', 17, movs)
    const a = asientoRegularizacion(r, '2026-01-03', 'REF-1')!
    expect(comprobarCuadre(a.apuntes).cuadra).toBe(true)
    expect(saldoCuenta('610', a.apuntes)).toBe(7.5)
    expect(saldoCuenta('300', a.apuntes)).toBe(-7.5)
  })
  it('sobrante → 300 debe / 610 haber', () => {
    const r = calcularRegularizacion('a1', 'alm1', 22, movs)
    const a = asientoRegularizacion(r, '2026-01-03', 'REF-1')!
    expect(saldoCuenta('300', a.apuntes)).toBe(5)
    expect(saldoCuenta('610', a.apuntes)).toBe(-5)
  })
  it('sin diferencia no genera asiento', () => {
    const r = calcularRegularizacion('a1', 'alm1', 20, movs)
    expect(asientoRegularizacion(r, '2026-01-03', 'REF-1')).toBeNull()
  })
})
