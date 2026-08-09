import { describe, it, expect } from 'vitest'
import { datafonoPrincipal, datafonosDe, marcarPrincipal, tiendasSinDatafono } from './datafonos'
import type { Datafono } from './tipos'

const d = (p: Partial<Datafono> & { id: string }): Datafono => ({
  nombre: p.id, banco: 'CaixaBank', activo: true, ...p,
})

describe('datáfono principal', () => {
  it('manda el marcado como principal, no el orden de la lista', () => {
    const lista = [
      d({ id: 'a', centroCosteId: 'cc1' }),
      d({ id: 'b', centroCosteId: 'cc1', principal: true }),
    ]
    expect(datafonoPrincipal(lista, 'cc1')!.id).toBe('b')
  })

  it('sin ninguno marcado, el primero activo de esa tienda', () => {
    const lista = [d({ id: 'a', centroCosteId: 'cc1' }), d({ id: 'b', centroCosteId: 'cc1' })]
    expect(datafonoPrincipal(lista, 'cc1')!.id).toBe('a')
  })

  it('los de baja no cuentan', () => {
    const lista = [d({ id: 'a', centroCosteId: 'cc1', activo: false, principal: true }), d({ id: 'b', centroCosteId: 'cc1' })]
    expect(datafonoPrincipal(lista, 'cc1')!.id).toBe('b')
  })

  it('si la tienda no tiene ninguno, no devuelve el de otra', () => {
    const lista = [d({ id: 'a', centroCosteId: 'cc1', principal: true })]
    expect(datafonoPrincipal(lista, 'cc2')).toBeUndefined()
    expect(datafonoPrincipal(lista, undefined)).toBeUndefined()
    expect(datafonosDe(lista, 'cc2')).toEqual([])
  })
})

describe('marcar principal', () => {
  it('solo puede haber uno por tienda', () => {
    const lista = [
      d({ id: 'a', centroCosteId: 'cc1', principal: true }),
      d({ id: 'b', centroCosteId: 'cc1' }),
      d({ id: 'c', centroCosteId: 'cc2', principal: true }),
    ]
    const r = marcarPrincipal(lista, 'b')
    expect(r.find((x) => x.id === 'a')!.principal).toBe(false)
    expect(r.find((x) => x.id === 'b')!.principal).toBe(true)
    // El de la otra tienda se queda como estaba.
    expect(r.find((x) => x.id === 'c')!.principal).toBe(true)
  })

  it('un id que no existe no rompe nada', () => {
    const lista = [d({ id: 'a', centroCosteId: 'cc1' })]
    expect(marcarPrincipal(lista, 'zzz')).toEqual(lista)
  })
})

describe('tiendas sin datáfono', () => {
  it('las señala, menos la web, que no lleva', () => {
    const lista = [d({ id: 'a', centroCosteId: 'cc1' })]
    const puntos = [
      { id: 'cc1', nombre: 'San Juan' },
      { id: 'cc2', nombre: 'Alfafar' },
      { id: 'cc3', nombre: 'Web', tipoPuntoVenta: 'WEB' },
    ]
    expect(tiendasSinDatafono(lista, puntos)).toEqual([{ id: 'cc2', nombre: 'Alfafar' }])
  })
})
