import { describe, it, expect } from 'vitest'
import { CENTROS_COSTE_DEFECTO } from './defaults'

describe('puntos de venta del grupo', () => {
  it('están los cinco, con el nombre exacto', () => {
    expect(CENTROS_COSTE_DEFECTO.map((c) => c.nombre)).toEqual([
      'VAPESSENCE GV ALICANTE',
      'VAPESPACE SAN JUAN',
      'VAPESSENCE ALFAFAR',
      'VAPESSENCE GV HORTALEZA',
      'VAPESPACE.ES',
    ])
  })

  it('los ids son fijos: una compra guarda el id del centro', () => {
    // Si estos ids cambiaran, las compras y ventas ya registradas quedarían
    // apuntando a un centro que no existe.
    expect(CENTROS_COSTE_DEFECTO.map((c) => c.id)).toEqual([
      'cc-gv-alicante',
      'cc-san-juan',
      'cc-alfafar',
      'cc-gv-hortaleza',
      'cc-vapespace-es',
    ])
    expect(new Set(CENTROS_COSTE_DEFECTO.map((c) => c.codigo)).size).toBe(5)
  })

  it('todos son puntos de venta y la web va marcada como online', () => {
    expect(CENTROS_COSTE_DEFECTO.every((c) => c.tipo === 'PUNTO_VENTA')).toBe(true)
    expect(CENTROS_COSTE_DEFECTO.find((c) => c.id === 'cc-vapespace-es')!.tipoPuntoVenta).toBe('WEB')
  })
})
