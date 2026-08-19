import { describe, expect, it } from 'vitest'
import { calcularSaldos, clasificarPorPlazo, liquidar, type GastoCompartido } from './liquidacion.js'

const aMedias = (...ids: string[]) =>
  ({ tipo: 'mitades', partes: ids.map((usuarioId) => ({ usuarioId })) }) as const

describe('la cuenta de un espacio compartido', () => {
  it('quien paga de más queda a favor, y quien no paga nada, en contra', () => {
    const gastos: GastoCompartido[] = [
      { id: '1', fecha: '2026-08-01', concepto: 'Alquiler', importe: 90_000, pagadoPor: 'ana', reparto: aMedias('ana', 'luis') },
      { id: '2', fecha: '2026-08-05', concepto: 'Compra', importe: 12_000, pagadoPor: 'luis', reparto: aMedias('ana', 'luis') },
    ]
    const { saldos, pagos, total } = calcularSaldos(gastos, ['ana', 'luis'])

    expect(total).toBe(102_000)
    expect(saldos).toEqual([
      { usuarioId: 'ana', pagado: 90_000, debido: 51_000, saldo: 39_000 },
      { usuarioId: 'luis', pagado: 12_000, debido: 51_000, saldo: -39_000 },
    ])
    expect(pagos).toEqual([{ deUsuarioId: 'luis', aUsuarioId: 'ana', importe: 39_000 }])
  })

  it('sin gastos no hay nada que liquidar, y no se inventa un pago de cero', () => {
    const { saldos, pagos } = calcularSaldos([], ['ana', 'luis'])
    expect(pagos).toEqual([])
    expect(saldos.every((s) => s.saldo === 0)).toBe(true)
  })

  it('cada reparto puede ser distinto: el alquiler por sueldos y la compra a medias', () => {
    const gastos: GastoCompartido[] = [
      {
        id: '1', fecha: '2026-08-01', concepto: 'Alquiler', importe: 100_000, pagadoPor: 'ana',
        reparto: {
          tipo: 'proporcional_ingresos',
          partes: [
            { usuarioId: 'ana', ingreso: 240_000 },
            { usuarioId: 'luis', ingreso: 160_000 },
          ],
        },
      },
      { id: '2', fecha: '2026-08-02', concepto: 'Compra', importe: 20_000, pagadoPor: 'ana', reparto: aMedias('ana', 'luis') },
    ]
    const { saldos } = calcularSaldos(gastos, ['ana', 'luis'])
    // Ana debía 60.000 del alquiler y 10.000 de la compra = 70.000; puso 120.000.
    expect(saldos[0]).toEqual({ usuarioId: 'ana', pagado: 120_000, debido: 70_000, saldo: 50_000 })
    expect(saldos[1]!.saldo).toBe(-50_000)
  })

  it('quien pagó algo y ya no es miembro sigue en la cuenta: su dinero existió', () => {
    const gastos: GastoCompartido[] = [
      { id: '1', fecha: '2026-08-01', concepto: 'Cena', importe: 6_000, pagadoPor: 'sara', reparto: aMedias('ana', 'luis') },
    ]
    const { saldos } = calcularSaldos(gastos, ['ana', 'luis'])
    expect(saldos.find((s) => s.usuarioId === 'sara')).toEqual({
      usuarioId: 'sara', pagado: 6_000, debido: 0, saldo: 6_000,
    })
  })
})

describe('cuántas transferencias hacen falta', () => {
  const cuantos = (saldos: number[]) =>
    liquidar(saldos.map((saldo, i) => ({ usuarioId: `u${i}`, saldo }))).length

  // Los mínimos están comprobados aparte, con una búsqueda exhaustiva en
  // Python sobre las mismas listas de saldos.
  it('una pareja se arregla con una', () => {
    expect(cuantos([5_000, -5_000])).toBe(1)
  })

  it('dos parejas independientes, dos transferencias y no tres', () => {
    expect(cuantos([5_000, -5_000, 3_000, -3_000])).toBe(2)
  })

  it('tres en cadena, dos', () => {
    expect(cuantos([6_000, -1_000, -5_000])).toBe(2)
  })

  it('cuatro mezclados sin subgrupo que cierre, tres', () => {
    expect(cuantos([4_000, -1_000, -1_000, -2_000])).toBe(3)
  })

  it('EL CASO QUE JUSTIFICA BUSCAR SUBGRUPOS: cuatro en vez de cinco', () => {
    // Repartiendo a lo bruto («el que más debe le paga al que más cobra») salen
    // cinco. Separando primero el subgrupo que ya suma cero, cuatro.
    expect(cuantos([-500, -600, 500, 500, -200, 300])).toBe(4)
  })

  it('el resultado es el mismo pase lo que pase con el orden de entrada', () => {
    const saldos = [-500, -600, 500, 500, -200, 300]
    const alReves = [...saldos].reverse()
    const pagosA = liquidar(saldos.map((saldo, i) => ({ usuarioId: `u${i}`, saldo })))
    const pagosB = liquidar(
      alReves.map((saldo, i) => ({ usuarioId: `u${saldos.length - 1 - i}`, saldo })),
    )
    expect(pagosB).toEqual(pagosA)
  })

  it('los pagos cierran todos los saldos exactamente', () => {
    const saldos = [-500, -600, 500, 500, -200, 300]
    const restante = new Map(saldos.map((saldo, i) => [`u${i}`, saldo]))
    for (const pago of liquidar(saldos.map((saldo, i) => ({ usuarioId: `u${i}`, saldo })))) {
      expect(pago.importe).toBeGreaterThan(0)
      restante.set(pago.deUsuarioId, restante.get(pago.deUsuarioId)! + pago.importe)
      restante.set(pago.aUsuarioId, restante.get(pago.aUsuarioId)! - pago.importe)
    }
    expect([...restante.values()].every((v) => v === 0)).toBe(true)
  })

  it('un descuadre es un fallo de programación y se grita, no se disimula', () => {
    expect(() => liquidar([{ usuarioId: 'ana', saldo: 100 }])).toThrow(/no suman cero/i)
  })
})

describe('después de un cierre', () => {
  const CIERRE = { hasta: '2026-07-31', cerradoEn: '2026-08-01T10:00:00.000Z' }
  const gastos = [
    // Estaba ahí cuando se cerró: se pagó en ese cierre.
    { fecha: '2026-07-20', apuntadoEn: '2026-07-20T08:00:00.000Z', concepto: 'Cena de julio' },
    // Fecha de julio pero apuntado en agosto: se ha quedado fuera sin querer.
    { fecha: '2026-07-28', apuntadoEn: '2026-08-05T08:00:00.000Z', concepto: 'Ticket olvidado' },
    { fecha: '2026-08-03', apuntadoEn: '2026-08-03T08:00:00.000Z', concepto: 'Compra' },
  ]

  it('separa lo ya liquidado de lo que llegó tarde', () => {
    const { enPlazo, yaLiquidados, tardios } = clasificarPorPlazo(gastos, CIERRE)
    expect(enPlazo.map((g) => g.concepto)).toEqual(['Compra'])
    expect(yaLiquidados.map((g) => g.concepto)).toEqual(['Cena de julio'])
    expect(tardios.map((g) => g.concepto)).toEqual(['Ticket olvidado'])
  })

  it('sin cierre previo, todo está en plazo', () => {
    const { enPlazo, yaLiquidados, tardios } = clasificarPorPlazo(gastos, null)
    expect(enPlazo).toHaveLength(3)
    expect(yaLiquidados).toHaveLength(0)
    expect(tardios).toHaveLength(0)
  })

  it('el mismo día del cierre cuenta como ya liquidado, no como el siguiente periodo', () => {
    const { enPlazo, yaLiquidados } = clasificarPorPlazo(
      [{ fecha: '2026-07-31', apuntadoEn: '2026-07-31T09:00:00.000Z', concepto: 'El último día' }],
      CIERRE,
    )
    expect(enPlazo).toHaveLength(0)
    expect(yaLiquidados).toHaveLength(1)
  })
})
