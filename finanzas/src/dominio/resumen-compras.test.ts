import { describe, it, expect } from 'vitest'
import {
  resumirCompras,
  cuotasDeudaPorMes,
  gastosBancariosPorMes,
  gastosCuentaPorCategoria,
  ingresosBancariosPorMes,
  familiaDeuda,
  ambitoDe,
  categoriasDe,
  efectoPresupuestoDe,
  ETIQUETA_FAMILIA_DEUDA,
} from './resumen-compras'
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

  it('las que cobra el propio banco están marcadas', () => {
    const bancarias = CATS.filter((c) => c.esBancaria).map((c) => c.nombre)
    expect(bancarias).toContain('Comisiones bancarias')
    expect(bancarias).toContain('Comisiones de TPV')
  })
})

describe('la naturaleza del gasto es de Compras; el banco tiene su propia lista', () => {
  const compras = categoriasDe(CATS, 'COMPRAS').map((c) => c.nombre)
  const banco = categoriasDe(CATS, 'BANCO').map((c) => c.nombre)

  it('las 20 naturalezas del gasto solo salen en Compras', () => {
    expect(compras).toHaveLength(20)
    expect(compras[0]).toBe('Stock nacional')
    expect(compras).toContain('Alquileres')
    expect(banco).not.toContain('Alquileres')
  })

  it('las nóminas son gasto: es el coste del personal', () => {
    const n = CATS.find((c) => c.id === 'cat-bco-nominas')!
    expect(efectoPresupuestoDe(n)).toBe('GASTO')
    expect(n.cuentaPGC).toBe('640')
    expect(categoriasDe(CATS, 'BANCO').map((c) => c.nombre)).toContain('Nóminas')
    // No es un concepto de Compras: la nómina no llega con factura.
    expect(categoriasDe(CATS, 'COMPRAS').map((c) => c.nombre)).not.toContain('Nóminas')
  })

  it('el banco ofrece lo que no lleva factura', () => {
    for (const n of [
      'Inversiones en empresas del grupo',
      'Inversiones financieras',
      'Comisiones de TPV',
      'Nóminas',
      'Gastos de mantenimiento',
      'Seguro de responsabilidad civil',
      'Seguro de vida',
      'Seguro de salud',
      'Tributos: trimestre corriente (303, 111, 115…)',
      'Tributos: cuota de aplazamiento',
    ]) {
      expect(banco).toContain(n)
    }
  })

  it('deja una línea para las facturas de proveedores, pero no se presupuesta', () => {
    const facturas = CATS.find((c) => c.id === 'cat-bco-facturas')!
    expect(banco).toContain(facturas.nombre)
    // El gasto ya está en la factura: contarlo aquí sería contarlo dos veces.
    expect(efectoPresupuestoDe(facturas)).toBe('NINGUNO')
  })

  it('los tributos son financiación: saldan una deuda ya devengada', () => {
    for (const id of ['cat-bco-tributos-trimestre', 'cat-bco-tributos-aplazamiento']) {
      expect(efectoPresupuestoDe(CATS.find((c) => c.id === id))).toBe('FINANCIACION')
    }
  })

  it('la Seguridad Social es GASTO, como las nóminas', () => {
    // Decisión del usuario: sin módulo de personal, el pago a la TGSS es el
    // único registro de la cuota patronal, que es coste real de la empresa.
    const ss = CATS.find((c) => c.id === 'cat-bco-seg-social')!
    expect(efectoPresupuestoDe(ss)).toBe('GASTO')
    expect(ss.cuentaPGC).toBe('642')
  })

  it('comprar participaciones o inversiones financieras es inversión, no gasto', () => {
    // El dinero no se consume: se cambia por un activo. No resta del resultado.
    for (const id of ['cat-bco-inv-grupo', 'cat-bco-inv-financiera']) {
      const c = CATS.find((x) => x.id === id)!
      expect(efectoPresupuestoDe(c)).toBe('INVERSION')
      expect(c.deduciblePorDefecto).toBe(false) // no llevan IVA que deducir
    }
    // Participaciones en partes vinculadas (2403) frente al resto (250).
    expect(CATS.find((c) => c.id === 'cat-bco-inv-grupo')!.cuentaPGC).toBe('2403')
    expect(CATS.find((c) => c.id === 'cat-bco-inv-financiera')!.cuentaPGC).toBe('250')
  })

  it('las categorías guardadas antes de la separación no se pierden', () => {
    // Sin `ambito`: si era bancaria va al banco, si no a compras.
    expect(ambitoDe({ id: 'x', nombre: 'Vieja', cuentaPGC: '629', deduciblePorDefecto: true })).toBe('COMPRAS')
    expect(ambitoDe({ id: 'y', nombre: 'Vieja banco', cuentaPGC: '626', deduciblePorDefecto: true, esBancaria: true })).toBe('BANCO')
    // Y sin `efectoPresupuesto` se tratan como gasto, que es lo que eran.
    expect(efectoPresupuestoDe({ id: 'x', nombre: 'Vieja', cuentaPGC: '629', deduciblePorDefecto: true })).toBe('GASTO')
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
    expect(lineas.find((l) => l.categoria === 'Gastos de mantenimiento')!.totalAnual).toBe(60)
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

  it('no trae al presupuesto lo que ya está contado en otro sitio', () => {
    // Una factura pagada por el banco ya es gasto en Compras; la cuota del
    // préstamo ya viene del cuadro de deuda. Traerlas sería contar dos veces.
    const l = gastosBancariosPorMes(
      [
        mov('2026-01-10', -1500, 'cat-bco-facturas'),
        mov('2026-01-05', -800, 'cat-bco-cuota-prestamo'),
        mov('2026-01-03', -2000, 'cat-bco-traspaso'),
      ],
      cats,
      2026,
    )
    expect(l).toEqual([])
  })

  it('cada concepto entra en el presupuesto con su tipo de línea', () => {
    const l = gastosBancariosPorMes(
      [
        mov('2026-04-20', -4200, 'cat-bco-tributos-trimestre'),
        mov('2026-04-30', -12, 'cat-banco-comision'),
        mov('2026-05-02', -50000, 'cat-bco-inv-grupo'),
      ],
      cats,
      2026,
    )
    expect(l.find((x) => x.categoriaId === 'cat-bco-tributos-trimestre')!.efecto).toBe('FINANCIACION')
    expect(l.find((x) => x.categoriaId === 'cat-banco-comision')!.efecto).toBe('GASTO')
    expect(l.find((x) => x.categoriaId === 'cat-bco-inv-grupo')!.efecto).toBe('INVERSION')
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

describe('abonos de la cuenta: de dónde viene el dinero', () => {
  const cats: CategoriaGasto[] = CATS
  const mov = (fecha: string, importe: number, categoriaId?: string, clase = 'OTRO') => ({ fecha, importe, categoriaId, clase })

  it('las entradas tienen su propia lista, distinta de la de cargos', () => {
    const entradas = categoriasDe(CATS, 'BANCO', 'ENTRADA').map((c) => c.nombre)
    const salidas = categoriasDe(CATS, 'BANCO', 'SALIDA').map((c) => c.nombre)
    for (const n of ['Dividendos recibidos', 'Retrocesión de comisiones bancarias', 'Devolución de préstamos concedidos', 'Aportación de capital de socios']) {
      expect(entradas).toContain(n)
      expect(salidas).not.toContain(n)
    }
    expect(entradas).not.toContain('Comisiones bancarias')
  })

  it('no todo lo que entra es ingreso', () => {
    const tipo = (id: string) => efectoPresupuestoDe(CATS.find((c) => c.id === id))
    expect(tipo('cat-bco-in-dividendos')).toBe('INGRESO')
    expect(tipo('cat-bco-in-retrocesion')).toBe('INGRESO')
    // Recuperar un préstamo concedido es desinversión, no beneficio.
    expect(tipo('cat-bco-in-devol-prestamo')).toBe('INVERSION')
    // El capital que meten los socios no es ingreso de la empresa.
    expect(tipo('cat-bco-in-capital')).toBe('FINANCIACION')
    // Los cobros de clientes ya están en Ventas.
    expect(tipo('cat-bco-in-clientes')).toBe('NINGUNO')
  })

  it('reparte los abonos por mes con su tipo de línea', () => {
    const l = ingresosBancariosPorMes(
      [
        mov('2026-03-31', 1200, 'cat-bco-in-dividendos'),
        mov('2026-06-30', 800, 'cat-bco-in-dividendos'),
        mov('2026-02-15', 45.3, 'cat-bco-in-retrocesion'),
        mov('2026-05-10', 30000, 'cat-bco-in-capital'),
      ],
      cats,
      2026,
    )
    const div = l.find((x) => x.categoriaId === 'cat-bco-in-dividendos')!
    expect(div.meses[2]).toBe(1200)
    expect(div.meses[5]).toBe(800)
    expect(div.totalAnual).toBe(2000)
    expect(div.efecto).toBe('INGRESO')
    expect(l.find((x) => x.categoriaId === 'cat-bco-in-capital')!.efecto).toBe('FINANCIACION')
    // Siempre en positivo: el signo lo pone quien presupuesta.
    expect(l.every((x) => x.totalAnual > 0)).toBe(true)
  })

  it('deja fuera los cobros de clientes, los traspasos y las salidas', () => {
    const l = ingresosBancariosPorMes(
      [
        mov('2026-01-10', 5000, 'cat-bco-in-clientes'),
        mov('2026-01-11', 2000, 'cat-bco-in-traspaso'),
        mov('2026-01-12', -30, 'cat-banco-comision'),
        mov('2026-01-13', 900), // sin clasificar
      ],
      cats,
      2026,
    )
    expect(l).toEqual([])
  })

  it('el desglose de abonos separa el ingreso real del capital', () => {
    const d = gastosCuentaPorCategoria(
      [mov('2026-03-31', 1200, 'cat-bco-in-dividendos'), mov('2026-05-10', 30000, 'cat-bco-in-capital'), mov('2026-01-31', -30, 'cat-banco-comision')],
      cats,
      undefined,
      undefined,
      'ENTRADA',
    )
    expect(d.total).toBe(31200) // la comisión es un cargo: fuera
    expect(d.totalIngreso).toBe(1200)
    expect(d.totalFinanciacion).toBe(30000)
  })
})

describe('préstamos a socios', () => {
  it('prestar a un socio es inversión, no gasto, y no se confunde con la deuda con socios', () => {
    const c = CATS.find((x) => x.id === 'cat-bco-prestamo-socios')!
    expect(efectoPresupuestoDe(c)).toBe('INVERSION')
    expect(ambitoDe(c)).toBe('BANCO')
    expect(c.nombre).toMatch(/a socios/)
    // «Préstamos de socios» es una familia de DEUDA, no una categoría del banco.
    expect(ETIQUETA_FAMILIA_DEUDA[familiaDeuda('SOCIOS')]).toBe('Préstamos de socios')
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
    expect(d.lineas.find((l) => l.categoria === 'Gastos de mantenimiento')!.numMovimientos).toBe(2)
  })

  it('la inversión se separa del gasto en el resumen', () => {
    const d = gastosCuentaPorCategoria(
      [mov('2026-05-02', -50000, 'cat-bco-inv-grupo'), mov('2026-06-01', -8000, 'cat-bco-inv-financiera'), mov('2026-01-31', -30, 'cat-banco-comision')],
      cats,
    )
    expect(d.totalInversion).toBe(58000)
    expect(d.totalGasto).toBe(30)
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
    expect(d).toEqual({
      lineas: [],
      total: 0,
      totalBancario: 0,
      totalGasto: 0,
      totalIngreso: 0,
      totalFinanciacion: 0,
      totalInversion: 0,
      totalYaContabilizado: 0,
      totalSinClasificar: 0,
      numSinClasificar: 0,
    })
  })

  it('separa el gasto, el pago de impuestos y lo que ya está contado', () => {
    const d = gastosCuentaPorCategoria(
      [
        mov('2026-01-31', -30, 'cat-banco-mantenimiento'),
        mov('2026-01-20', -4200, 'cat-bco-tributos-trimestre'),
        mov('2026-01-10', -1500, 'cat-bco-facturas'),
        mov('2026-01-05', -800, 'cat-bco-cuota-prestamo'),
      ],
      cats,
    )
    expect(d.total).toBe(6530)
    expect(d.totalGasto).toBe(30)
    expect(d.totalFinanciacion).toBe(4200)
    expect(d.totalInversion).toBe(0)
    // Factura + cuota de préstamo: ya contados en Compras y en Deudas.
    expect(d.totalYaContabilizado).toBe(2300)
  })
})
