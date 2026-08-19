import { describe, expect, it } from 'vitest'
import {
  patrimonioNeto,
  proyectarSaldo,
  serieDePatrimonio,
  variacion,
  type ComponentePatrimonio,
} from './patrimonio.js'

const CARTERA: ComponentePatrimonio[] = [
  { nombre: 'Corriente', clase: 'liquido', valor: 350_000 },
  { nombre: 'Ahorro', clase: 'liquido', valor: 1_200_000 },
  { nombre: 'Cartera indexada', clase: 'inversion', valor: 1_021_640 },
  { nombre: 'Piso', clase: 'bien', valor: 18_000_000 },
  { nombre: 'Hipoteca', clase: 'deuda', valor: 13_155_393 },
  { nombre: 'Visa', clase: 'tarjeta', valor: 24_240 },
]

describe('el patrimonio neto', () => {
  it('es activos menos pasivos, con las deudas contadas como pasivo', () => {
    const patrimonio = patrimonioNeto(CARTERA)
    expect(patrimonio.activos).toBe(20_571_640)
    expect(patrimonio.pasivos).toBe(13_179_633)
    expect(patrimonio.neto).toBe(7_392_007)
  })

  it('marca cuáles son pasivos para que la pantalla no tenga que saberlo', () => {
    const patrimonio = patrimonioNeto(CARTERA)
    expect(patrimonio.componentes.filter((c) => c.esPasivo).map((c) => c.nombre)).toEqual([
      'Hipoteca',
      'Visa',
    ])
  })

  it('sin nada, todo a cero y sin dividir por nada', () => {
    expect(patrimonioNeto([])).toMatchObject({ activos: 0, pasivos: 0, neto: 0 })
  })
})

describe('la variación', () => {
  it('da el importe y el porcentaje', () => {
    expect(variacion(110_000, 100_000)).toEqual({ absoluta: 10_000, porcentaje: 10 })
  })

  it('sin base con la que comparar el porcentaje es null, no infinito', () => {
    expect(variacion(50_000, 0)).toEqual({ absoluta: 50_000, porcentaje: null })
  })

  it('con base negativa el porcentaje se mide sobre su magnitud', () => {
    // Pasar de −1.000 € a −500 € es mejorar un 50 %, no empeorar.
    expect(variacion(-50_000, -100_000).porcentaje).toBe(50)
  })
})

describe('la proyección de saldo', () => {
  const APUNTES = [
    { fecha: '2026-08-25', importe: -75_000, concepto: 'Alquiler' },
    { fecha: '2026-08-28', importe: -25_000, concepto: 'Gas' },
    { fecha: '2026-09-01', importe: 244_360, concepto: 'Nómina' },
  ]

  it('arrastra el saldo día a día', () => {
    const proyeccion = proyectarSaldo({
      saldoInicial: 120_000,
      desde: '2026-08-20',
      dias: 15,
      apuntes: APUNTES,
    })
    expect(proyeccion.dias).toHaveLength(15)
    expect(proyeccion.dias[0]!.saldo).toBe(120_000)
    expect(proyeccion.saldoFinal).toBe(120_000 - 75_000 - 25_000 + 244_360)
  })

  it('encuentra el día de saldo mínimo, que es la cifra que importa', () => {
    // Acabar el mes con 2.643 € no consuela si el día 28 te quedas en 200.
    const proyeccion = proyectarSaldo({
      saldoInicial: 120_000,
      desde: '2026-08-20',
      dias: 15,
      apuntes: APUNTES,
    })
    expect(proyeccion.minimo.fecha).toBe('2026-08-28')
    expect(proyeccion.minimo.saldo).toBe(20_000)
  })

  it('avisa del primer día en negativo', () => {
    const proyeccion = proyectarSaldo({
      saldoInicial: 80_000,
      desde: '2026-08-20',
      dias: 15,
      apuntes: APUNTES,
    })
    expect(proyeccion.primerDiaEnNegativo).toBe('2026-08-28')
    expect(proyeccion.minimo.saldo).toBe(-20_000)
  })

  it('sin nada previsto la línea es plana, no inventa gasto variable', () => {
    // Extrapolar «los martes gastas 14 €» produce una línea preciosa que no se
    // cumple nunca.
    const proyeccion = proyectarSaldo({
      saldoInicial: 120_000,
      desde: '2026-08-20',
      dias: 10,
      apuntes: [],
    })
    expect(proyeccion.dias.every((d) => d.saldo === 120_000)).toBe(true)
    expect(proyeccion.primerDiaEnNegativo).toBeNull()
  })

  it('suma varios apuntes del mismo día en un solo escalón', () => {
    const proyeccion = proyectarSaldo({
      saldoInicial: 100_000,
      desde: '2026-08-20',
      dias: 3,
      apuntes: [
        { fecha: '2026-08-21', importe: -10_000, concepto: 'Luz' },
        { fecha: '2026-08-21', importe: -5_000, concepto: 'Agua' },
      ],
    })
    expect(proyeccion.dias[1]).toMatchObject({ saldo: 85_000, movimiento: -15_000 })
  })
})

describe('la serie del gráfico', () => {
  it('con una sola foto dice que no hay bastante para dibujar', () => {
    // Una línea de un punto la lee el ojo como «plano», y eso es una mentira
    // gráfica.
    const serie = serieDePatrimonio([{ mes: '2026-08-01', neto: 100_000 }])
    expect(serie.hayBastante).toBe(false)
    expect(serie.variacionPeriodo).toBeNull()
  })

  it('ordena por fecha y calcula la variación del periodo', () => {
    const serie = serieDePatrimonio([
      { mes: '2026-08-01', neto: 120_000 },
      { mes: '2026-06-01', neto: 100_000 },
      { mes: '2026-07-01', neto: 110_000 },
    ])
    expect(serie.puntos.map((p) => p.mes)).toEqual(['2026-06-01', '2026-07-01', '2026-08-01'])
    expect(serie.variacionPeriodo).toEqual({ absoluta: 20_000, porcentaje: 20 })
  })
})
