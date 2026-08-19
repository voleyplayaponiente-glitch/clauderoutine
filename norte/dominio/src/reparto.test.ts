import { describe, expect, it } from 'vitest'
import { calcularReparto, ErrorReparto, nombreDeTipoReparto } from './reparto.js'

describe('repartir un gasto entre quienes lo comparten', () => {
  it('a partes iguales, sin perder el céntimo suelto', () => {
    const cuotas = calcularReparto(1000, {
      tipo: 'mitades',
      partes: [{ usuarioId: 'ana' }, { usuarioId: 'luis' }, { usuarioId: 'sara' }],
    })
    expect(cuotas.map((c) => c.importe)).toEqual([334, 333, 333])
    expect(cuotas.reduce((t, c) => t + c.importe, 0)).toBe(1000)
  })

  it('en proporción a los ingresos: 2.400 y 1.600 netos sobre 1.234,56 €', () => {
    // Comprobado aparte: 123456 × 240000/400000 = 74073,6 → 74.074 con el resto.
    const cuotas = calcularReparto(123_456, {
      tipo: 'proporcional_ingresos',
      partes: [
        { usuarioId: 'ana', ingreso: 240_000 },
        { usuarioId: 'luis', ingreso: 160_000 },
      ],
    })
    expect(cuotas).toEqual([
      { usuarioId: 'ana', importe: 74_074 },
      { usuarioId: 'luis', importe: 49_382 },
    ])
  })

  it('sin ingresos anotados NO parte a medias por su cuenta: lo dice', () => {
    expect(() =>
      calcularReparto(10_000, {
        tipo: 'proporcional_ingresos',
        partes: [{ usuarioId: 'ana', ingreso: 0 }, { usuarioId: 'luis', ingreso: 0 }],
      }),
    ).toThrow(/no se puede repartir en proporción/i)
  })

  it('por porcentajes, y se niega si no suman 100', () => {
    expect(
      calcularReparto(20_000, {
        tipo: 'porcentaje_manual',
        partes: [
          { usuarioId: 'ana', porcentaje: 70 },
          { usuarioId: 'luis', porcentaje: 30 },
        ],
      }).map((c) => c.importe),
    ).toEqual([14_000, 6_000])

    expect(() =>
      calcularReparto(20_000, {
        tipo: 'porcentaje_manual',
        partes: [
          { usuarioId: 'ana', porcentaje: 70 },
          { usuarioId: 'luis', porcentaje: 20 },
        ],
      }),
    ).toThrow(ErrorReparto)
  })

  describe('con importe fijo', () => {
    it('quien tiene fijo pone eso y el resto se lo reparten los demás', () => {
      const cuotas = calcularReparto(90_000, {
        tipo: 'importe_fijo',
        partes: [
          { usuarioId: 'ana', importeFijo: 40_000 },
          { usuarioId: 'luis' },
          { usuarioId: 'sara' },
        ],
      })
      expect(cuotas.map((c) => c.importe)).toEqual([40_000, 25_000, 25_000])
    })

    it('si los fijos ya se pasan del gasto, la regla no vale y se dice', () => {
      expect(() =>
        calcularReparto(20_000, {
          tipo: 'importe_fijo',
          partes: [{ usuarioId: 'ana', importeFijo: 40_000 }, { usuarioId: 'luis' }],
        }),
      ).toThrow(/se pasan del gasto/i)
    })

    it('si todos tienen fijo, tienen que cuadrar exactamente', () => {
      expect(
        calcularReparto(50_000, {
          tipo: 'importe_fijo',
          partes: [
            { usuarioId: 'ana', importeFijo: 30_000 },
            { usuarioId: 'luis', importeFijo: 20_000 },
          ],
        }).map((c) => c.importe),
      ).toEqual([30_000, 20_000])

      expect(() =>
        calcularReparto(50_000, {
          tipo: 'importe_fijo',
          partes: [
            { usuarioId: 'ana', importeFijo: 30_000 },
            { usuarioId: 'luis', importeFijo: 10_000 },
          ],
        }),
      ).toThrow(/diferencia/i)
    })
  })

  it('una devolución compartida se reparte igual, en negativo', () => {
    const cuotas = calcularReparto(-1000, {
      tipo: 'mitades',
      partes: [{ usuarioId: 'ana' }, { usuarioId: 'luis' }, { usuarioId: 'sara' }],
    })
    expect(cuotas.reduce((t, c) => t + c.importe, 0)).toBe(-1000)
    expect(cuotas.every((c) => c.importe < 0)).toBe(true)
  })

  it('no admite un participante repetido', () => {
    expect(() =>
      calcularReparto(1000, {
        tipo: 'mitades',
        partes: [{ usuarioId: 'ana' }, { usuarioId: 'ana' }],
      }),
    ).toThrow(/repetido/i)
  })

  it('nombra los tipos en español', () => {
    expect(nombreDeTipoReparto('proporcional_ingresos')).toBe('en proporción a los ingresos')
  })
})
