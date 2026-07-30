import { describe, it, expect } from 'vitest'
import { generarAlertas, type MetricasAlerta } from './alertas'

const cero: MetricasAlerta = {
  tensionLiquidez: false, facturasVencidas: 0, importeVencido: 0, descuadresCaja: 0,
  stockBajo: 0, impuestosProximos: 0, conciliacionesPendientes: 0, puntosBajoObjetivo: 0,
}
const fmt = (n: number) => `${n} €`

describe('centro de alertas', () => {
  it('sin problemas → sin alertas', () => {
    expect(generarAlertas(cero, fmt)).toHaveLength(0)
  })
  it('prioriza la tensión de liquidez como crítica y primera', () => {
    const a = generarAlertas({ ...cero, tensionLiquidez: true, diaTension: '2026-08-01', stockBajo: 3 }, fmt)
    expect(a[0].nivel).toBe('critico')
    expect(a[0].id).toBe('tension')
    expect(a).toHaveLength(2)
  })
  it('ordena avisos antes que info', () => {
    const a = generarAlertas({ ...cero, conciliacionesPendientes: 5, stockBajo: 2 }, fmt)
    expect(a[0].id).toBe('stock') // aviso
    expect(a[1].id).toBe('conciliacion') // info
  })
  it('incluye el importe vencido en el detalle', () => {
    const a = generarAlertas({ ...cero, facturasVencidas: 2, importeVencido: 1500 }, fmt)
    expect(a[0].detalle).toContain('1500')
  })
})
