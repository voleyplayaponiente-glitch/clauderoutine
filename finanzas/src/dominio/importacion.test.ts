import { describe, it, expect } from 'vitest'
import { sugerirMapeo, validarFila, parsearFechaFlexible, destinoPorId } from './importacion'

const articulos = destinoPorId('articulos')!
const banco = destinoPorId('movimientos-banco')!

describe('sugerencia de mapeo', () => {
  it('empareja cabeceras por nombre y sinónimos', () => {
    const m = sugerirMapeo(['Referencia', 'Producto', 'Precio venta', 'Min'], articulos)
    expect(m.referencia).toBe(0)
    expect(m.descripcion).toBe(1) // "Producto" → sinónimo de descripción
    expect(m.pvp).toBe(2) // "Precio venta"
    expect(m.stockMinimo).toBe(3)
  })
  it('devuelve -1 para campos sin columna', () => {
    const m = sugerirMapeo(['Referencia'], articulos)
    expect(m.pvp).toBe(-1)
  })
})

describe('validación de filas', () => {
  const mapeo = sugerirMapeo(['Referencia', 'Descripción', 'PVP'], articulos)
  it('fila correcta → estado ok y valores tipados', () => {
    const r = validarFila(['A1', 'Camiseta', '9,99'], articulos, mapeo)
    expect(r.estado).toBe('ok')
    expect(r.valores.pvp).toBe(9.99)
  })
  it('falta un obligatorio → error', () => {
    const r = validarFila(['', 'Camiseta', '9,99'], articulos, mapeo)
    expect(r.estado).toBe('error')
    expect(r.mensajes.join()).toMatch(/Referencia/)
  })
  it('número no válido → error', () => {
    const r = validarFila(['A1', 'Camiseta', 'gratis'], articulos, mapeo)
    expect(r.estado).toBe('error')
    expect(r.mensajes.join()).toMatch(/Número/)
  })
  it('el caso 180.000 se interpreta como número grande', () => {
    const mBanco = sugerirMapeo(['Fecha', 'Concepto', 'Importe'], banco)
    const r = validarFila(['15/01/2026', 'Ingreso', '180.000'], banco, mBanco)
    expect(r.estado).toBe('ok')
    expect(r.valores.importe).toBe(180000)
    expect(r.valores.fecha).toBe('2026-01-15')
  })
})

describe('fechas flexibles', () => {
  it('acepta dd/mm/aaaa y aaaa-mm-dd', () => {
    expect(parsearFechaFlexible('15/01/2026')).toBe('2026-01-15')
    expect(parsearFechaFlexible('2026-1-5')).toBe('2026-01-05')
    expect(parsearFechaFlexible('nada')).toBeNull()
  })
})

describe('fechas con el mes en letra (PDF de banca digital)', () => {
  it('lee el formato «1 Jul 2026» de CaixaBank', () => {
    expect(parsearFechaFlexible('1 Jul 2026')).toBe('2026-07-01')
    expect(parsearFechaFlexible('24 Abr 2026')).toBe('2026-04-24')
    expect(parsearFechaFlexible('15 Dic 2025')).toBe('2025-12-15')
    expect(parsearFechaFlexible('10 Mar 2026')).toBe('2026-03-10')
    expect(parsearFechaFlexible('1 Ene 2026')).toBe('2026-01-01')
  })
  it('admite el mes completo y con preposiciones', () => {
    expect(parsearFechaFlexible('24 de abril de 2026')).toBe('2026-04-24')
    expect(parsearFechaFlexible('15-dic-2025')).toBe('2025-12-15')
    expect(parsearFechaFlexible('3 septiembre 2026')).toBe('2026-09-03')
  })
  it('sigue leyendo los formatos numéricos de siempre', () => {
    expect(parsearFechaFlexible('01/07/2026')).toBe('2026-07-01')
    expect(parsearFechaFlexible('2026-07-01')).toBe('2026-07-01')
  })
  it('no inventa una fecha con un mes que no existe', () => {
    expect(parsearFechaFlexible('24 Xyz 2026')).toBeNull()
    expect(parsearFechaFlexible('no es fecha')).toBeNull()
  })
})
