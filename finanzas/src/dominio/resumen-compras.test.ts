import { describe, it, expect } from 'vitest'
import { resumirCompras, cuotasDeudaPorMes, gastosBancariosPorMes, gastosCuentaPorCategoria, familiaDeuda, ETIQUETA_FAMILIA_DEUDA } from './resumen-compras'
import { CATEGORIAS_GASTO_DEFECTO } from './defaults'
import type { Compra, Deuda, CategoriaGasto } from './tipos'

const CATS = CATEGORIAS_GASTO_DEFECTO

let n = 0
function compra(p: Partial<Compra> & { base: number }): Compra {
  const { base, ...resto } = p
  return {
    id: `c${++n}`,
    creadoEn: '2026-01-01T00:00:00Z',
    creadoPor: 'test',
    origen: 'MANUAL',
    naturaleza: 'SERVICIO',
    terceroId: 't1',
    numFactura: `F${n}`,
    fechaFactura: '2026-03-15',
    lineasIva: [{ base, tipoIvaId: 'iva21', tipo: 21, regimen: 'GENERAL', cuota: Math.round(base * 21) / 100 }],
    retencion: 0,
    formaPago: 'TRANSFERENCIA',
    estadoPago: 'PENDIENTE',
    deducible: true,
    ...resto,
  } as Compra
}

function deuda(p: Partial<Deuda> & { tipo: Deuda['tipo']; importeOriginal: number }): Deuda {
  return {
    id: `d${++n}`,
    creadoEn: '2026-01-01T00:00:00Z',
    creadoPor: 'test',
    origen: 'MANUAL',
    acreedor: 'Acreedor',
    tipoInteres: 0,
    periodicidad: 'MENSUAL',
    nPeriodos: 12,
    sistema: 'LINEAL',
    fechaInicio: '2025-12-31',
    esVinculada: false,
    ...p,
  } as Deuda
}

describe('categorías de gasto por defecto', () => {
  it('incluye stock nacional e internacional marcados como stock', () => {
    const nac = CATS.find((c) => c.id === 'cat-stock-nac')!
    const int = CATS.find((c) => c.id === 'cat-stock-int')!
    expect(nac.esStock).toBe(true)
    expect(int.esStock).toBe(true)
    expect(int.esInternacional).toBe(true)
    expect(nac.esInternacional).toBeUndefined()
  })

  it('gasolina y mantenimiento no deducibles vienen marcados como tales', () => {
    expect(CATS.find((c) => c.id === 'cat-gasolina-nd')!.deduciblePorDefecto).toBe(false)
    expect(CATS.find((c) => c.id === 'cat-mantenimiento-nd')!.deduciblePorDefecto).toBe(false)
    expect(CATS.find((c) => c.id === 'cat-gasolina')!.deduciblePorDefecto).toBe(true)
  })

  it('las categorías bancarias están marcadas', () => {
    const bancarias = CATS.filter((c) => c.esBancaria).map((c) => c.nombre)
    expect(bancarias).toContain('Comisiones bancarias')
    expect(bancarias).toContain('Seguros del banco')
  })
})

describe('resumen de compras del mes', () => {
  const compras = [
    compra({ base: 1000, categoriaGastoId: 'cat-stock-nac', naturaleza: 'MERCADERIA' }),
    compra({ base: 2000, categoriaGastoId: 'cat-stock-int', naturaleza: 'MERCADERIA', impuestoEspecial: 300 }),
    compra({ base: 800, categoriaGastoId: 'cat-alquiler' }),
    compra({ base: 100, categoriaGastoId: 'cat-gasolina-nd', deducible: false }),
  ]

  it('agrupa por categoría y ordena por coste real', () => {
    const r = resumirCompras(compras, CATS, '2026-03-01', '2026-03-31')
    expect(r.lineas.map((l) => l.categoria)).toEqual([
      'Stock internacional',
      'Stock nacional',
      'Alquileres',
      'Gasolina NO deducible',
    ])
    expect(r.numFacturas).toBe(4)
  })

  it('el IVA no deducible cuenta como más gasto', () => {
    const r = resumirCompras(compras, CATS, '2026-03-01', '2026-03-31')
    const gasolina = r.lineas.find((l) => l.categoria === 'Gasolina NO deducible')!
    expect(gasolina.base).toBe(100)
    expect(gasolina.ivaNoDeducible).toBe(21)
    expect(gasolina.costeReal).toBe(121) // no son 100: el IVA que no deduces lo pagas
  })

  it('el impuesto especial suma al coste de la mercancía', () => {
    const r = resumirCompras(compras, CATS, '2026-03-01', '2026-03-31')
    const int = r.lineas.find((l) => l.categoria === 'Stock internacional')!
    expect(int.impuestoEspecial).toBe(300)
    expect(int.costeReal).toBe(2300)
  })

  it('separa el coste de stock del de estructura', () => {
    const r = resumirCompras(compras, CATS, '2026-03-01', '2026-03-31')
    expect(r.costeStock).toBe(3300) // 1000 + 2000 + 300 de impuesto
    expect(r.costeEstructura).toBe(921) // 800 + 121
  })

  it('el IVA deducible es la cuota menos lo no deducible', () => {
    const r = resumirCompras(compras, CATS, '2026-03-01', '2026-03-31')
    expect(r.cuotaIva).toBe(819) // 21% de 3900
    expect(r.ivaNoDeducible).toBe(21)
    expect(r.ivaDeducible).toBe(798)
  })

  it('respeta el periodo pedido', () => {
    const conOtroMes = [...compras, compra({ base: 5000, categoriaGastoId: 'cat-alquiler', fechaFactura: '2026-04-02' })]
    expect(resumirCompras(conOtroMes, CATS, '2026-03-01', '2026-03-31').numFacturas).toBe(4)
    expect(resumirCompras(conOtroMes, CATS, '2026-04-01', '2026-04-30').numFacturas).toBe(1)
    expect(resumirCompras(conOtroMes, CATS).numFacturas).toBe(5) // sin periodo, todas
  })

  it('las anuladas no cuentan', () => {
    const conAnulada = [...compras, { ...compra({ base: 9999, categoriaGastoId: 'cat-alquiler' }), anuladoEn: '2026-03-20' }]
    expect(resumirCompras(conAnulada, CATS, '2026-03-01', '2026-03-31').base).toBe(3900)
  })

  it('las compras sin categoría se ven, no se esconden', () => {
    const r = resumirCompras([compra({ base: 500 })], CATS, '2026-03-01', '2026-03-31')
    expect(r.lineas[0].categoria).toBe('Sin categoría')
    expect(r.lineas[0].base).toBe(500)
  })

  it('sin compras el resumen es todo ceros', () => {
    const r = resumirCompras([], CATS)
    expect(r.lineas).toEqual([])
    expect(r.costeReal).toBe(0)
  })
})

describe('familias de deuda', () => {
  it('agrupa por quién es el acreedor', () => {
    expect(familiaDeuda('PRESTAMO')).toBe('BANCARIA')
    expect(familiaDeuda('POLIZA')).toBe('BANCARIA')
    expect(familiaDeuda('LEASING')).toBe('BANCARIA')
    expect(familiaDeuda('SOCIOS')).toBe('SOCIOS')
    expect(familiaDeuda('GRUPO')).toBe('SOCIOS')
    expect(familiaDeuda('HACIENDA')).toBe('HACIENDA')
    expect(familiaDeuda('SEG_SOCIAL')).toBe('SEGURIDAD_SOCIAL')
    expect(familiaDeuda('PROVEEDOR')).toBe('COMERCIAL')
    expect(familiaDeuda('DIVIDENDO')).toBe('OTRA')
  })
  it('todas las familias tienen etiqueta en español', () => {
    expect(ETIQUETA_FAMILIA_DEUDA.HACIENDA).toMatch(/Hacienda/)
    expect(ETIQUETA_FAMILIA_DEUDA.SEGURIDAD_SOCIAL).toMatch(/Seguridad Social/)
  })
})

describe('cuotas de deuda aplazada para el presupuesto', () => {
  it('reparte por meses la cuota del cuadro de amortización', () => {
    const d = deuda({ tipo: 'PRESTAMO', importeOriginal: 12000, nPeriodos: 12, periodicidad: 'MENSUAL' })
    const lineas = cuotasDeudaPorMes([d], 2026)
    expect(lineas).toHaveLength(1)
    expect(lineas[0].familia).toBe('BANCARIA')
    expect(lineas[0].meses).toHaveLength(12)
    expect(lineas[0].totalAnual).toBe(12000)
    expect(lineas[0].meses.every((m) => m === 1000)).toBe(true)
  })

  it('agrupa varias deudas de la misma familia', () => {
    const lineas = cuotasDeudaPorMes(
      [
        deuda({ tipo: 'PRESTAMO', importeOriginal: 12000 }),
        deuda({ tipo: 'POLIZA', importeOriginal: 6000 }),
      ],
      2026,
    )
    expect(lineas).toHaveLength(1)
    expect(lineas[0].totalAnual).toBe(18000)
  })

  it('separa Hacienda, Seguridad Social y socios en líneas distintas', () => {
    const lineas = cuotasDeudaPorMes(
      [
        deuda({ tipo: 'HACIENDA', importeOriginal: 6000 }),
        deuda({ tipo: 'SEG_SOCIAL', importeOriginal: 3000 }),
        deuda({ tipo: 'SOCIOS', importeOriginal: 24000 }),
      ],
      2026,
    )
    expect(lineas.map((l) => l.familia)).toEqual(['SOCIOS', 'HACIENDA', 'SEGURIDAD_SOCIAL'])
    expect(lineas.map((l) => l.totalAnual)).toEqual([24000, 6000, 3000])
  })

  it('solo cuenta las cuotas del ejercicio pedido', () => {
    const d = deuda({ tipo: 'PRESTAMO', importeOriginal: 24000, nPeriodos: 24, fechaInicio: '2025-12-31' })
    expect(cuotasDeudaPorMes([d], 2026)[0].totalAnual).toBe(12000)
    expect(cuotasDeudaPorMes([d], 2027)[0].totalAnual).toBe(12000)
    expect(cuotasDeudaPorMes([d], 2028)).toEqual([])
  })

  it('una deuda trimestral solo carga los meses que tocan', () => {
    const d = deuda({ tipo: 'HACIENDA', importeOriginal: 4000, nPeriodos: 4, periodicidad: 'TRIMESTRAL', fechaInicio: '2025-12-31' })
    const meses = cuotasDeudaPorMes([d], 2026)[0].meses
    expect(meses.filter((m) => m > 0)).toHaveLength(4)
    expect(meses.reduce((a, b) => a + b, 0)).toBe(4000)
  })

  it('las deudas anuladas no se presupuestan', () => {
    const d = { ...deuda({ tipo: 'PRESTAMO', importeOriginal: 12000 }), anuladoEn: '2026-02-01' }
    expect(cuotasDeudaPorMes([d], 2026)).toEqual([])
  })

  it('sin deudas no hay líneas', () => {
    expect(cuotasDeudaPorMes([], 2026)).toEqual([])
  })

  it('la primera cuota vence un periodo DESPUÉS de la firma', () => {
    // Firmado el 31/01/2026 a 12 meses: la última cuota cae ya en 2027, así que
    // en 2026 solo se presupuestan 11.
    const d = deuda({ tipo: 'PRESTAMO', importeOriginal: 12000, nPeriodos: 12, fechaInicio: '2026-01-31' })
    expect(cuotasDeudaPorMes([d], 2026)[0].totalAnual).toBe(11000)
    expect(cuotasDeudaPorMes([d], 2027)[0].totalAnual).toBe(1000)
  })
})

describe('gastos bancarios por mes', () => {
  const cats: CategoriaGasto[] = CATS
  const mov = (fecha: string, importe: number, categoriaId?: string, clase = 'OTRO') => ({ fecha, importe, categoriaId, clase })

  it('agrupa por categoría bancaria y por mes', () => {
    const lineas = gastosBancariosPorMes(
      [
        mov('2026-01-31', -12, 'cat-banco-comision'),
        mov('2026-02-28', -12, 'cat-banco-comision'),
        mov('2026-03-31', -60, 'cat-banco-mantenimiento'),
      ],
      cats,
      2026,
    )
    const comisiones = lineas.find((l) => l.categoria === 'Comisiones bancarias')!
    expect(comisiones.meses[0]).toBe(12)
    expect(comisiones.meses[1]).toBe(12)
    expect(comisiones.totalAnual).toBe(24)
    expect(lineas.find((l) => l.categoria === 'Mantenimiento de cuenta')!.totalAnual).toBe(60)
  })

  it('los importes se presupuestan en positivo aunque sean salidas', () => {
    const l = gastosBancariosPorMes([mov('2026-05-31', -33.5, 'cat-banco-seguro')], cats, 2026)
    expect(l[0].totalAnual).toBe(33.5)
  })

  it('una comisión sin categoría se recoge igual, marcada como sin clasificar', () => {
    const l = gastosBancariosPorMes([mov('2026-05-31', -5, undefined, 'COMISION')], cats, 2026)
    expect(l[0].categoria).toMatch(/sin clasificar/)
    expect(l[0].totalAnual).toBe(5)
  })

  it('ignora entradas, movimientos de otro año y gastos que no son del banco', () => {
    const l = gastosBancariosPorMes(
      [
        mov('2026-01-31', 500, 'cat-banco-comision'), // entrada
        mov('2025-01-31', -12, 'cat-banco-comision'), // otro año
        mov('2026-01-31', -900, 'cat-alquiler'), // no es del banco
      ],
      cats,
      2026,
    )
    expect(l).toEqual([])
  })

  it('los anulados no cuentan', () => {
    const l = gastosBancariosPorMes(
      [{ ...mov('2026-01-31', -12, 'cat-banco-comision'), anuladoEn: '2026-02-01' }],
      cats,
      2026,
    )
    expect(l).toEqual([])
  })
})

describe('desglose de gastos de una cuenta bancaria', () => {
  const cats: CategoriaGasto[] = CATS
  const mov = (fecha: string, importe: number, categoriaId?: string, clase = 'OTRO') => ({ fecha, importe, categoriaId, clase })

  it('agrupa las salidas por naturaleza y separa lo que cobra el banco', () => {
    const d = gastosCuentaPorCategoria(
      [
        mov('2026-01-31', -30, 'cat-banco-mantenimiento'),
        mov('2026-02-28', -30, 'cat-banco-mantenimiento'),
        mov('2026-03-31', -6, 'cat-banco-comision'),
        mov('2026-03-05', -900, 'cat-alquiler'),
      ],
      cats,
    )
    expect(d.total).toBe(966)
    expect(d.totalBancario).toBe(66)
    // El alquiler se paga POR el banco, pero no lo cobra el banco.
    expect(d.lineas.find((l) => l.categoria === 'Alquileres')!.esBancaria).toBe(false)
    expect(d.lineas[0].categoria).toBe('Alquileres') // ordenado por importe
    expect(d.lineas.find((l) => l.categoria === 'Mantenimiento de cuenta')!.numMovimientos).toBe(2)
  })

  it('lo que no está clasificado se ve, no se esconde', () => {
    const d = gastosCuentaPorCategoria([mov('2026-01-31', -40), mov('2026-02-02', -10)], cats)
    expect(d.numSinClasificar).toBe(2)
    expect(d.totalSinClasificar).toBe(50)
    expect(d.lineas[0].categoria).toBe('Sin clasificar')
  })

  it('una comisión sin clasificar se reconoce igual como gasto del banco', () => {
    const d = gastosCuentaPorCategoria([mov('2026-01-31', -5, undefined, 'COMISION')], cats)
    expect(d.totalBancario).toBe(5)
  })

  it('respeta el periodo y deja fuera entradas y anulados', () => {
    const d = gastosCuentaPorCategoria(
      [
        mov('2026-01-31', -30, 'cat-banco-mantenimiento'),
        mov('2025-12-31', -30, 'cat-banco-mantenimiento'),
        mov('2026-01-15', 1000, 'cat-banco-comision'),
        { ...mov('2026-01-20', -99, 'cat-alquiler'), anuladoEn: '2026-01-21' },
      ],
      cats,
      '2026-01-01',
      '2026-12-31',
    )
    expect(d.total).toBe(30)
    expect(d.lineas).toHaveLength(1)
  })

  it('sin salidas devuelve todo a cero', () => {
    const d = gastosCuentaPorCategoria([], cats)
    expect(d).toEqual({ lineas: [], total: 0, totalBancario: 0, totalSinClasificar: 0, numSinClasificar: 0 })
  })
})
