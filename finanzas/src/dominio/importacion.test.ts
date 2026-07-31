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
