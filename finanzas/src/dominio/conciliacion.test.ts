import { describe, it, expect } from 'vitest'
import { puntuar, sugerencias, type Emparejable } from './conciliacion'

const e = (id: string, fecha: string, concepto: string, importe: number): Emparejable => ({ id, fecha, concepto, importe })

describe('puntuación de emparejamiento', () => {
  it('importe distinto → score 0', () => {
    expect(puntuar(e('a', '2026-07-30', 'x', 100), e('b', '2026-07-30', 'x', 99))).toBe(0)
  })
  it('mismo importe, misma fecha y concepto parecido → score alto', () => {
    const s = puntuar(e('a', '2026-07-30', 'PAGO PROVEEDOR ACME', 100), e('b', '2026-07-30', 'Pago proveedor Acme SL', 100))
    expect(s).toBeGreaterThan(0.8)
  })
  it('importe exacto pero fuera de tolerancia de fecha → sugerencia débil', () => {
    expect(puntuar(e('a', '2026-07-01', 'x', 100), e('b', '2026-07-30', 'y', 100), 3)).toBe(0.6)
  })
})

describe('sugerencias sin robar candidatos', () => {
  it('empareja cada línea con su mejor candidato único', () => {
    const extracto = [e('e1', '2026-07-30', 'ALQUILER LOCAL', 800), e('e2', '2026-07-30', 'SEGURO', 800)]
    const candidatos = [e('c1', '2026-07-30', 'Alquiler local julio', 800), e('c2', '2026-07-30', 'Prima seguro', 800)]
    const s = sugerencias(extracto, candidatos, 3)
    expect(s).toHaveLength(2)
    const par = Object.fromEntries(s.map((x) => [x.extracto.id, x.candidato.id]))
    expect(par['e1']).toBe('c1')
    expect(par['e2']).toBe('c2')
  })
})
