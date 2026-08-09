import { describe, it, expect } from 'vitest'
import { fusionarCategorias } from '../store/store'
import { CATEGORIAS_GASTO_DEFECTO } from './defaults'
import type { CategoriaGasto } from './tipos'

/**
 * Cambiar un valor por defecto NO llega a quien ya tiene datos guardados: la
 * fusión respeta su copia. Para un cambio de criterio contable hay que
 * corregirla expresamente, y solo si sigue teniendo el valor antiguo.
 */
const ANTIGUA: CategoriaGasto = {
  id: 'cat-bco-seg-social',
  nombre: 'Seguridad Social',
  cuentaPGC: '476',
  deduciblePorDefecto: true,
  ambito: 'BANCO',
  efectoPresupuesto: 'FINANCIACION',
  orden: 32,
}

describe('correcciones sobre categorías ya guardadas', () => {
  it('la Seguridad Social guardada como financiación pasa a gasto', () => {
    const r = fusionarCategorias([ANTIGUA], CATEGORIAS_GASTO_DEFECTO)
    const ss = r.find((c) => c.id === 'cat-bco-seg-social')!
    expect(ss.efectoPresupuesto).toBe('GASTO')
    expect(ss.cuentaPGC).toBe('642')
  })

  it('si el usuario ya la había cambiado, manda lo suyo', () => {
    const suya = { ...ANTIGUA, efectoPresupuesto: 'INVERSION' as const, nombre: 'TGSS mía' }
    const r = fusionarCategorias([suya], CATEGORIAS_GASTO_DEFECTO)
    const ss = r.find((c) => c.id === 'cat-bco-seg-social')!
    expect(ss.efectoPresupuesto).toBe('INVERSION')
    expect(ss.nombre).toBe('TGSS mía')
  })

  it('la corrección no toca el resto de categorías guardadas', () => {
    const propia: CategoriaGasto = { id: 'mia', nombre: 'Mi categoría', cuentaPGC: '629', deduciblePorDefecto: true }
    const r = fusionarCategorias([ANTIGUA, propia], CATEGORIAS_GASTO_DEFECTO)
    expect(r.find((c) => c.id === 'mia')).toEqual(propia)
  })

  it('las categorías nuevas de fábrica se añaden igual', () => {
    const r = fusionarCategorias([ANTIGUA], CATEGORIAS_GASTO_DEFECTO)
    expect(r.map((c) => c.id)).toContain('cat-bco-nominas')
    expect(r).toHaveLength(CATEGORIAS_GASTO_DEFECTO.length)
  })
})
