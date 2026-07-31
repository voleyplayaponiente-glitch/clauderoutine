import { describe, it, expect } from 'vitest'
import { generarDemoSquare, definicionConector, urlServidorSegura } from './conectores'

describe('conector de demostración (Square)', () => {
  it('genera liquidaciones y comisiones deterministas', () => {
    const a = generarDemoSquare('2026-07-30', 3)
    const b = generarDemoSquare('2026-07-30', 3)
    expect(a.movimientos).toEqual(b.movimientos) // determinista
    expect(a.movimientos).toHaveLength(6) // 3 días × (liquidación + comisión)
  })
  it('los externalId son estables para la idempotencia', () => {
    const r = generarDemoSquare('2026-07-30', 1)
    expect(r.movimientos[0].externalId).toBe('SQ-LIQ-2026-07-30')
    expect(r.movimientos[1].externalId).toBe('SQ-COM-2026-07-30')
  })
  it('la comisión es una salida (importe negativo)', () => {
    const r = generarDemoSquare('2026-07-30', 1)
    expect(r.movimientos[0].importe).toBeGreaterThan(0)
    expect(r.movimientos[1].importe).toBeLessThan(0)
  })
  it('el catálogo describe cada conector', () => {
    expect(definicionConector('SQUARE').nombre).toBe('Square')
    expect(definicionConector('BANCO_PSD2').soloLectura).toBe(true)
  })
})

describe('URL del servidor de conectores (el secreto viaja en la cabecera)', () => {
  it('acepta HTTPS', () => {
    expect(urlServidorSegura('https://umbrel.midominio.com').ok).toBe(true)
  })
  it('acepta HTTP solo en la red local', () => {
    expect(urlServidorSegura('http://localhost:3001').ok).toBe(true)
    expect(urlServidorSegura('http://127.0.0.1:3001').ok).toBe(true)
    expect(urlServidorSegura('http://umbrel.local:3001').ok).toBe(true)
    expect(urlServidorSegura('http://192.168.1.50:3001').ok).toBe(true)
    expect(urlServidorSegura('http://10.0.0.5:3001').ok).toBe(true)
    expect(urlServidorSegura('http://172.16.0.9:3001').ok).toBe(true)
  })
  it('rechaza HTTP hacia Internet (el secreto saldría en claro)', () => {
    const r = urlServidorSegura('http://servidor-ajeno.com')
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/local/)
  })
  it('rechaza esquemas raros y URLs vacías o inválidas', () => {
    expect(urlServidorSegura('javascript:alert(1)').ok).toBe(false)
    expect(urlServidorSegura('file:///etc/passwd').ok).toBe(false)
    expect(urlServidorSegura('umbrel.local:3001').ok).toBe(false)
    expect(urlServidorSegura('').ok).toBe(false)
    expect(urlServidorSegura(undefined).ok).toBe(false)
  })
  it('172.32 no es rango privado', () => {
    expect(urlServidorSegura('http://172.32.0.1').ok).toBe(false)
  })
})
