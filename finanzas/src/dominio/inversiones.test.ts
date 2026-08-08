import { describe, it, expect } from 'vitest'
import {
  posicion,
  situacion,
  costeCompra,
  netoVenta,
  ultimaValoracion,
  amortizacionAnualInmueble,
  resumenCartera,
  avisosInversion,
  asientoOperacion,
  asientosInversion,
  decimalesUnidades,
  CUENTA_PGC_POR_TIPO,
  type Inversion,
  type OperacionInversion,
  type ValoracionInversion,
  type TipoInversion,
  type TipoOperacion,
} from './inversiones'
import { comprobarCuadre } from './partida-doble'

let seq = 0
function inv(tipo: TipoInversion, nombre: string, extra: Partial<Inversion> = {}): Inversion {
  return {
    id: `i${++seq}`,
    creadoEn: '2026-01-01T00:00:00Z',
    creadoPor: 'test',
    origen: 'MANUAL',
    tipo,
    nombre,
    cuentaPGC: CUENTA_PGC_POR_TIPO[tipo],
    ...extra,
  }
}

function op(
  inversionId: string,
  fecha: string,
  tipo: TipoOperacion,
  extra: Partial<OperacionInversion> = {},
): OperacionInversion {
  return {
    id: `o${++seq}`,
    creadoEn: `${fecha}T00:00:00Z`,
    creadoPor: 'test',
    origen: 'MANUAL',
    inversionId,
    fecha,
    tipo,
    ...extra,
  }
}

function val(inversionId: string, fecha: string, valorTotal: number): ValoracionInversion {
  return { id: `v${++seq}`, creadoEn: `${fecha}T00:00:00Z`, creadoPor: 'test', origen: 'MANUAL', inversionId, fecha, valorTotal }
}

describe('coste de adquisición', () => {
  it('los gastos de compra suman al coste (NRV 9.ª)', () => {
    expect(costeCompra(op('i', '2026-01-01', 'COMPRA', { unidades: 100, precioUnitario: 10, gastos: 9.95 }))).toBe(1009.95)
  })
  it('los gastos de venta restan del neto cobrado', () => {
    expect(netoVenta(op('i', '2026-01-01', 'VENTA', { unidades: 100, precioUnitario: 12, gastos: 9.95 }))).toBe(1190.05)
  })
  it('admite el importe directo cuando no hay unidades (inmueble, depósito)', () => {
    expect(costeCompra(op('i', '2026-01-01', 'COMPRA', { importe: 180000, gastos: 20000 }))).toBe(200000)
  })
})

describe('posición con precio medio ponderado', () => {
  const acciones = inv('ACCIONES', 'Iberdrola')

  it('acumula compras y calcula el coste medio', () => {
    const p = posicion([
      op(acciones.id, '2026-01-10', 'COMPRA', { unidades: 100, precioUnitario: 10, gastos: 10 }),
      op(acciones.id, '2026-02-10', 'COMPRA', { unidades: 100, precioUnitario: 12, gastos: 10 }),
    ])
    expect(p.unidades).toBe(200)
    expect(p.coste).toBe(2220) // 1010 + 1210
    expect(p.costeUnitario).toBe(11.1)
  })

  it('la venta da de baja el coste medio, no el precio de la última compra', () => {
    const p = posicion([
      op(acciones.id, '2026-01-10', 'COMPRA', { unidades: 100, precioUnitario: 10 }),
      op(acciones.id, '2026-02-10', 'COMPRA', { unidades: 100, precioUnitario: 20 }),
      op(acciones.id, '2026-03-10', 'VENTA', { unidades: 100, precioUnitario: 25 }),
    ])
    // Coste medio 15 €; se venden 100 a 25 → resultado 1.000 €.
    expect(p.unidades).toBe(100)
    expect(p.coste).toBe(1500)
    expect(p.resultadoRealizado).toBe(1000)
  })

  it('vender con pérdida da resultado negativo', () => {
    const p = posicion([
      op(acciones.id, '2026-01-10', 'COMPRA', { unidades: 10, precioUnitario: 100 }),
      op(acciones.id, '2026-06-10', 'VENTA', { unidades: 10, precioUnitario: 80, gastos: 5 }),
    ])
    expect(p.unidades).toBe(0)
    expect(p.coste).toBe(0)
    expect(p.resultadoRealizado).toBe(-205) // 795 cobrado − 1000 de coste
  })

  it('al vender todo no queda coste colgando', () => {
    const p = posicion([
      op(acciones.id, '2026-01-10', 'COMPRA', { unidades: 3, precioUnitario: 33.33 }),
      op(acciones.id, '2026-02-10', 'VENTA', { unidades: 3, precioUnitario: 40 }),
    ])
    expect(p.unidades).toBe(0)
    expect(p.coste).toBe(0)
  })

  it('respeta el orden por fecha aunque lleguen desordenadas', () => {
    const p = posicion([
      op(acciones.id, '2026-03-10', 'VENTA', { unidades: 100, precioUnitario: 25 }),
      op(acciones.id, '2026-01-10', 'COMPRA', { unidades: 100, precioUnitario: 10 }),
      op(acciones.id, '2026-02-10', 'COMPRA', { unidades: 100, precioUnitario: 20 }),
    ])
    expect(p.resultadoRealizado).toBe(1000)
  })

  it('las operaciones anuladas no cuentan', () => {
    const anulada = { ...op(acciones.id, '2026-02-10', 'COMPRA', { unidades: 100, precioUnitario: 99 }), anuladoEn: '2026-03-01' }
    const p = posicion([op(acciones.id, '2026-01-10', 'COMPRA', { unidades: 10, precioUnitario: 10 }), anulada])
    expect(p.unidades).toBe(10)
    expect(p.coste).toBe(100)
  })

  it('separa dividendos, rendimientos y gastos del coste', () => {
    const p = posicion([
      op(acciones.id, '2026-01-10', 'COMPRA', { unidades: 100, precioUnitario: 10 }),
      op(acciones.id, '2026-05-10', 'DIVIDENDO', { importe: 45 }),
      op(acciones.id, '2026-06-10', 'GASTO', { importe: 12 }),
    ])
    expect(p.coste).toBe(1000)
    expect(p.rendimientos).toBe(45)
    expect(p.gastos).toBe(12)
  })

  it('una ampliación sube el coste sin tocar las unidades', () => {
    const piso = inv('INMUEBLE', 'Local')
    const p = posicion([
      op(piso.id, '2026-01-10', 'COMPRA', { unidades: 1, precioUnitario: 180000, gastos: 20000 }),
      op(piso.id, '2026-04-10', 'APORTACION', { importe: 15000 }),
    ])
    expect(p.unidades).toBe(1)
    expect(p.coste).toBe(215000)
  })
})

describe('cripto con 8 decimales', () => {
  const btc = inv('CRIPTO', 'Bitcoin')
  it('no pierde precisión en fracciones pequeñas', () => {
    expect(decimalesUnidades('CRIPTO')).toBe(8)
    const p = posicion([
      op(btc.id, '2026-01-10', 'COMPRA', { unidades: 0.0125, precioUnitario: 60000, gastos: 7.5 }),
      op(btc.id, '2026-02-10', 'COMPRA', { unidades: 0.00375, precioUnitario: 80000 }),
    ])
    expect(p.unidades).toBe(0.01625)
    expect(p.coste).toBe(1057.5) // 750 + 7,50 + 300
  })

  it('vender una fracción deja bien el resto', () => {
    const p = posicion([
      op(btc.id, '2026-01-10', 'COMPRA', { unidades: 1, precioUnitario: 30000 }),
      op(btc.id, '2026-06-10', 'VENTA', { unidades: 0.5, precioUnitario: 50000 }),
    ])
    expect(p.unidades).toBe(0.5)
    expect(p.coste).toBe(15000)
    expect(p.resultadoRealizado).toBe(10000)
  })
})

describe('valoración: la plusvalía latente no es beneficio', () => {
  const fondo = inv('FONDO', 'Indexado global')
  const ops = [op(fondo.id, '2026-01-10', 'COMPRA', { unidades: 100, precioUnitario: 10 })]

  it('la revalorización se informa aparte y NO como resultado', () => {
    const s = situacion(fondo, ops, [val(fondo.id, '2026-06-30', 1400)])
    expect(s.posicion.coste).toBe(1000)
    expect(s.valorMercado).toBe(1400)
    expect(s.plusvaliaLatente).toBe(400)
    expect(s.posicion.resultadoRealizado).toBe(0) // no se ha vendido nada
    expect(s.deterioroSugerido).toBe(0)
  })

  it('la minusvalía latente SÍ obliga a dotar deterioro', () => {
    const s = situacion(fondo, ops, [val(fondo.id, '2026-06-30', 820)])
    expect(s.plusvaliaLatente).toBe(-180)
    expect(s.deterioroSugerido).toBe(180)
  })

  it('sin valoración no se inventa un valor de mercado', () => {
    const s = situacion(fondo, ops, [])
    expect(s.valorMercado).toBeUndefined()
    expect(s.plusvaliaLatente).toBeUndefined()
    expect(s.deterioroSugerido).toBe(0)
  })

  it('se queda con la valoración más reciente hasta la fecha', () => {
    const vs = [val(fondo.id, '2026-03-31', 1100), val(fondo.id, '2026-06-30', 1400), val(fondo.id, '2026-12-31', 1600)]
    expect(ultimaValoracion(vs, fondo.id, '2026-06-30')?.valorTotal).toBe(1400)
    expect(ultimaValoracion(vs, fondo.id)?.valorTotal).toBe(1600)
  })

  it('vendido todo, no hay deterioro que dotar', () => {
    const s = situacion(
      fondo,
      [...ops, op(fondo.id, '2026-07-01', 'VENTA', { unidades: 100, precioUnitario: 8 })],
      [val(fondo.id, '2026-07-02', 0)],
    )
    expect(s.posicion.unidades).toBe(0)
    expect(s.deterioroSugerido).toBe(0)
    expect(s.posicion.resultadoRealizado).toBe(-200) // la pérdida ya es real
  })
})

describe('inmuebles: el terreno no se amortiza', () => {
  it('amortiza solo la construcción', () => {
    const piso = inv('INMUEBLE', 'Local Almería', { valorTerreno: 60000, valorConstruccion: 140000, aniosVidaUtil: 50 })
    expect(amortizacionAnualInmueble(piso)).toBe(2800) // 140.000 / 50
  })
  it('sin vida útil o sin construcción no amortiza', () => {
    expect(amortizacionAnualInmueble(inv('INMUEBLE', 'Solar', { valorTerreno: 90000, valorConstruccion: 0, aniosVidaUtil: 50 }))).toBe(0)
    expect(amortizacionAnualInmueble(inv('INMUEBLE', 'Piso', { valorConstruccion: 100000 }))).toBe(0)
  })
  it('las acciones no amortizan', () => {
    expect(amortizacionAnualInmueble(inv('ACCIONES', 'Iberdrola'))).toBe(0)
  })
})

describe('resumen de la cartera', () => {
  const a = inv('ACCIONES', 'Iberdrola')
  const b = inv('CRIPTO', 'Bitcoin')
  const c = inv('INMUEBLE', 'Local')

  const sits = [
    situacion(a, [op(a.id, '2026-01-01', 'COMPRA', { unidades: 100, precioUnitario: 10 })], [val(a.id, '2026-06-30', 1300)]),
    situacion(b, [op(b.id, '2026-01-01', 'COMPRA', { unidades: 0.5, precioUnitario: 40000 })], [val(b.id, '2026-06-30', 25000)]),
    situacion(c, [op(c.id, '2026-01-01', 'COMPRA', { importe: 200000 })], []),
  ]

  it('suma coste y valor de mercado', () => {
    const r = resumenCartera(sits)
    expect(r.coste).toBe(221000) // 1.000 + 20.000 + 200.000
    expect(r.valorMercado).toBe(226300) // 1.300 + 25.000 + 200.000 (sin valorar → coste)
    expect(r.plusvaliaLatente).toBe(5300)
  })

  it('cuenta las inversiones sin valorar y no las infla', () => {
    expect(resumenCartera(sits).sinValorar).toBe(1)
  })

  it('agrupa por tipo', () => {
    const porTipo = Object.fromEntries(resumenCartera(sits).porTipo.map((t) => [t.tipo, t.coste]))
    expect(porTipo).toEqual({ ACCIONES: 1000, CRIPTO: 20000, INMUEBLE: 200000 })
  })

  it('la cartera vacía suma cero', () => {
    const r = resumenCartera([])
    expect(r.coste).toBe(0)
    expect(r.valorMercado).toBe(0)
  })
})

describe('avisos', () => {
  it('avisa de que la plusvalía latente no es beneficio', () => {
    const f = inv('FONDO', 'Indexado')
    const s = situacion(f, [op(f.id, '2026-01-01', 'COMPRA', { unidades: 10, precioUnitario: 100 })], [val(f.id, '2026-06-01', 1500)])
    expect(avisosInversion(s).some((a) => /no es beneficio/.test(a))).toBe(true)
  })

  it('avisa del deterioro cuando el valor cae', () => {
    const f = inv('FONDO', 'Indexado')
    const s = situacion(f, [op(f.id, '2026-01-01', 'COMPRA', { unidades: 10, precioUnitario: 100 })], [val(f.id, '2026-06-01', 700)])
    expect(avisosInversion(s).some((a) => /deterioro/.test(a))).toBe(true)
  })

  it('avisa si el inmueble no reparte terreno y construcción', () => {
    const p = inv('INMUEBLE', 'Local')
    const s = situacion(p, [op(p.id, '2026-01-01', 'COMPRA', { importe: 200000 })], [])
    expect(avisosInversion(s).some((a) => /terreno no se amortiza/.test(a))).toBe(true)
  })

  it('avisa si el reparto no cuadra con el coste', () => {
    const p = inv('INMUEBLE', 'Local', { valorTerreno: 50000, valorConstruccion: 100000, aniosVidaUtil: 50 })
    const s = situacion(p, [op(p.id, '2026-01-01', 'COMPRA', { importe: 200000 })], [])
    expect(avisosInversion(s).some((a) => /no coincide con el coste/.test(a))).toBe(true)
  })

  it('avisa de la indefinición contable de la cripto', () => {
    const b = inv('CRIPTO', 'Bitcoin')
    const s = situacion(b, [op(b.id, '2026-01-01', 'COMPRA', { unidades: 1, precioUnitario: 30000 })], [])
    expect(avisosInversion(s).some((a) => /ICAC/.test(a))).toBe(true)
  })

  it('avisa si se han vendido más unidades de las que había', () => {
    const a = inv('ACCIONES', 'X')
    const s = situacion(
      a,
      [op(a.id, '2026-01-01', 'COMPRA', { unidades: 10, precioUnitario: 10 }), op(a.id, '2026-02-01', 'VENTA', { unidades: 15, precioUnitario: 12 })],
      [],
    )
    expect(avisosInversion(s).some((a) => /más unidades/.test(a))).toBe(true)
  })
})

describe('asientos: la partida doble cuadra siempre', () => {
  const a = inv('ACCIONES', 'Iberdrola')

  const cuadran = (asientos: { apuntes: { cuenta: string; debe: number; haber: number }[] }[]) =>
    asientos.every((x) => comprobarCuadre(x.apuntes).cuadra)

  it('la compra carga la inversión y abona tesorería', () => {
    const asiento = asientoOperacion(a, op(a.id, '2026-01-10', 'COMPRA', { unidades: 100, precioUnitario: 10, gastos: 10 }), [])!
    expect(comprobarCuadre(asiento.apuntes).cuadra).toBe(true)
    expect(asiento.apuntes.find((p) => p.cuenta === '250')?.debe).toBe(1010)
    expect(asiento.apuntes.find((p) => p.cuenta === '572')?.haber).toBe(1010)
  })

  it('la venta con beneficio usa la 766 y da de baja el coste medio', () => {
    const compras = [
      op(a.id, '2026-01-10', 'COMPRA', { unidades: 100, precioUnitario: 10 }),
      op(a.id, '2026-02-10', 'COMPRA', { unidades: 100, precioUnitario: 20 }),
    ]
    const venta = op(a.id, '2026-03-10', 'VENTA', { unidades: 100, precioUnitario: 25 })
    const asiento = asientoOperacion(a, venta, compras)!
    expect(comprobarCuadre(asiento.apuntes).cuadra).toBe(true)
    expect(asiento.apuntes.find((p) => p.cuenta === '572')?.debe).toBe(2500)
    expect(asiento.apuntes.find((p) => p.cuenta === '250')?.haber).toBe(1500) // coste medio 15 × 100
    expect(asiento.apuntes.find((p) => p.cuenta === '766')?.haber).toBe(1000)
  })

  it('la venta con pérdida usa la 666', () => {
    const compra = op(a.id, '2026-01-10', 'COMPRA', { unidades: 10, precioUnitario: 100 })
    const asiento = asientoOperacion(a, op(a.id, '2026-06-10', 'VENTA', { unidades: 10, precioUnitario: 80 }), [compra])!
    expect(comprobarCuadre(asiento.apuntes).cuadra).toBe(true)
    expect(asiento.apuntes.find((p) => p.cuenta === '666')?.debe).toBe(200)
    expect(asiento.apuntes.find((p) => p.cuenta === '766')).toBeUndefined()
  })

  it('el dividendo va a la 760 y el alquiler a la 762', () => {
    const div = asientoOperacion(a, op(a.id, '2026-05-10', 'DIVIDENDO', { importe: 45 }), [])!
    expect(div.apuntes.find((p) => p.cuenta === '760')?.haber).toBe(45)
    const piso = inv('INMUEBLE', 'Local')
    const alq = asientoOperacion(piso, op(piso.id, '2026-05-10', 'RENDIMIENTO', { importe: 800 }), [])!
    expect(alq.apuntes.find((p) => p.cuenta === '762')?.haber).toBe(800)
  })

  it('una operación anulada no genera asiento', () => {
    const anulada = { ...op(a.id, '2026-01-10', 'COMPRA', { unidades: 1, precioUnitario: 10 }), anuladoEn: '2026-02-01' }
    expect(asientoOperacion(a, anulada, [])).toBeUndefined()
  })

  it('todo el histórico de una inversión cuadra, apunte a apunte', () => {
    const ops = [
      op(a.id, '2026-01-10', 'COMPRA', { unidades: 100, precioUnitario: 10, gastos: 9.95 }),
      op(a.id, '2026-02-10', 'COMPRA', { unidades: 50, precioUnitario: 13.37 }),
      op(a.id, '2026-05-10', 'DIVIDENDO', { importe: 45.5 }),
      op(a.id, '2026-06-10', 'GASTO', { importe: 3.25 }),
      op(a.id, '2026-09-10', 'VENTA', { unidades: 120, precioUnitario: 11.11, gastos: 9.95 }),
    ]
    const asientos = asientosInversion(a, ops)
    expect(asientos).toHaveLength(5)
    expect(cuadran(asientos)).toBe(true)
  })

  it('respeta la cuenta del PGC que la empresa haya puesto', () => {
    const btc = inv('CRIPTO', 'Bitcoin', { cuentaPGC: '2060' })
    const asiento = asientoOperacion(btc, op(btc.id, '2026-01-10', 'COMPRA', { unidades: 1, precioUnitario: 30000 }), [])!
    expect(asiento.apuntes.find((p) => p.debe > 0)?.cuenta).toBe('2060')
  })
})
