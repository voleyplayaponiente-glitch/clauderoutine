import { describe, expect, it } from 'vitest'
import {
  amortizarAnticipado,
  compararAmortizacion,
  compararEstrategias,
  cuadroConAmortizaciones,
  cuotaFrancesa,
  ErrorPrestamo,
  generarCuadro,
  mesesParaCuota,
  planDePago,
  resumirCuadro,
  taeDesdeTin,
  tinDesdeTae,
  type Prestamo,
} from './amortizacion.js'

/**
 * Las cifras esperadas de las pruebas de cuadro están calculadas **aparte y
 * con aritmética decimal exacta**, no sacadas de esta misma implementación. Un
 * test que compara el código consigo mismo solo prueba que el código no ha
 * cambiado, no que esté bien.
 */
const HIPOTECA: Prestamo = {
  principal: 15_000_000, // 150.000 €
  tinAnual: 3,
  meses: 360,
  primerPago: '2026-09-01',
}

describe('la cuota del sistema francés', () => {
  it('150.000 € al 3 % a 30 años son 632,41 € al mes', () => {
    expect(cuotaFrancesa(15_000_000, 3, 360)).toBe(63_241)
  })

  it('12.000 € al 7,5 % a 5 años son 240,46 €', () => {
    expect(cuotaFrancesa(1_200_000, 7.5, 60)).toBe(24_046)
  })

  it('sin intereses es el principal entre el plazo, no un caso raro', () => {
    // Un préstamo familiar al 0 % es un préstamo. La fórmula se indefine ahí y
    // hay que tratarlo, no dejar que salga NaN.
    expect(cuotaFrancesa(120_000, 0, 12)).toBe(10_000)
  })
})

describe('el cuadro de amortización', () => {
  const cuadro = generarCuadro(HIPOTECA)

  it('tiene una fila por mes y empieza en la fecha del primer recibo', () => {
    expect(cuadro).toHaveLength(360)
    expect(cuadro[0]!.fecha).toBe('2026-09-01')
    expect(cuadro[11]!.fecha).toBe('2027-08-01')
  })

  it('cierra exactamente en cero: el banco no te deja debiendo cuatro céntimos', () => {
    expect(cuadro[cuadro.length - 1]!.saldoVivo).toBe(0)
  })

  it('cada cuota es interés más capital, sin excepción', () => {
    for (const fila of cuadro) {
      expect(fila.cuota).toBe(fila.interes + fila.capital)
    }
  })

  it('la suma del capital devuelto es exactamente el principal', () => {
    const capital = cuadro.reduce((total, c) => total + c.capital, 0)
    expect(capital).toBe(HIPOTECA.principal)
  })

  it('el total de intereses coincide con el calculado aparte', () => {
    expect(resumirCuadro(cuadro, HIPOTECA.principal).totalIntereses).toBe(7_766_533)
  })

  it('dice cuánto se paga por cada euro prestado', () => {
    // 150.000 € prestados y 227.665 € devueltos: 1,52 € por euro.
    expect(resumirCuadro(cuadro, HIPOTECA.principal).porCadaEuro).toBeCloseTo(1.518, 3)
  })

  it('el interés del primer mes es el saldo por el tipo mensual', () => {
    expect(cuadro[0]!.interes).toBe(37_500)
  })
})

describe('los otros dos sistemas', () => {
  it('el alemán amortiza capital constante y cuotas decrecientes', () => {
    const cuadro = generarCuadro({ ...HIPOTECA, sistema: 'aleman', meses: 12 })
    expect(cuadro[0]!.capital).toBe(cuadro[5]!.capital)
    expect(cuadro[0]!.cuota).toBeGreaterThan(cuadro[11]!.cuota)
    expect(cuadro[cuadro.length - 1]!.saldoVivo).toBe(0)
  })

  it('el americano solo paga intereses y devuelve el capital al final', () => {
    const cuadro = generarCuadro({ ...HIPOTECA, sistema: 'americano', meses: 12 })
    expect(cuadro[0]!.capital).toBe(0)
    expect(cuadro[10]!.capital).toBe(0)
    expect(cuadro[11]!.capital).toBe(HIPOTECA.principal)
    expect(cuadro[cuadro.length - 1]!.saldoVivo).toBe(0)
  })
})

describe('TIN y TAE', () => {
  it('convierte el nominal en efectivo con capitalización mensual', () => {
    expect(taeDesdeTin(3)).toBeCloseTo(3.0416, 4)
    expect(taeDesdeTin(7.5)).toBeCloseTo(7.7633, 4)
    // Una tarjeta al 20 % nominal es un 21,94 % efectivo.
    expect(taeDesdeTin(20)).toBeCloseTo(21.9391, 4)
  })

  it('la vuelta deja el número donde estaba', () => {
    expect(tinDesdeTae(taeDesdeTin(9.25))).toBeCloseTo(9.25, 6)
  })
})

describe('amortizar anticipadamente', () => {
  const opciones = { trasCuota: 24, importe: 1_000_000, comisionPorcentaje: 0.5 }

  it('reducir plazo ahorra más interés que reducir cuota', () => {
    const { reducirPlazo, reducirCuota } = compararAmortizacion(HIPOTECA, opciones)
    expect(reducirPlazo.interesAhorrado).toBeGreaterThan(reducirCuota.interesAhorrado)
    // Y acorta de verdad: la cuota se mantiene y sobran meses.
    expect(reducirPlazo.cuotasAhorradas).toBeGreaterThan(0)
    expect(reducirCuota.cuotasAhorradas).toBe(0)
  })

  it('reducir cuota baja el recibo y deja el plazo donde estaba', () => {
    const { reducirCuota } = compararAmortizacion(HIPOTECA, opciones)
    expect(reducirCuota.nuevaCuota).toBeLessThan(63_241)
    expect(reducirCuota.cuadro).toHaveLength(360)
  })

  it('la comisión se resta del ahorro, no se esconde', () => {
    // 0,5 % de 10.000 € son 50 €. Un simulador que enseña el ahorro bruto
    // está vendiendo, no informando.
    const { reducirPlazo } = compararAmortizacion(HIPOTECA, opciones)
    expect(reducirPlazo.comision).toBe(5_000)
    expect(reducirPlazo.ahorroNeto).toBe(reducirPlazo.interesAhorrado - 5_000)
  })

  it('un importe que cubre el saldo liquida la deuda y lo dice', () => {
    const resultado = amortizarAnticipado(HIPOTECA, {
      trasCuota: 12,
      importe: 20_000_000,
      modo: 'reducir_plazo',
    })
    expect(resultado.liquidaLaDeuda).toBe(true)
    expect(resultado.cuadro).toHaveLength(12)
    expect(resultado.cuotasAhorradas).toBe(348)
  })

  it('el cuadro nuevo sigue cerrando en cero', () => {
    const { reducirPlazo, reducirCuota } = compararAmortizacion(HIPOTECA, opciones)
    expect(reducirPlazo.cuadro[reducirPlazo.cuadro.length - 1]!.saldoVivo).toBe(0)
    expect(reducirCuota.cuadro[reducirCuota.cuadro.length - 1]!.saldoVivo).toBe(0)
  })
})

describe('cuántos meses hacen falta con una cuota', () => {
  it('lo calcula sin simular mes a mes', () => {
    expect(mesesParaCuota(15_000_000, 3, 63_241)).toBe(360)
  })

  it('se niega a responder cuando la cuota no cubre ni los intereses', () => {
    // 300 € al mes sobre 150.000 € al 3 %: los intereses son 375 €. La deuda
    // crece. Devolver un número aquí sería mentir con aspecto de cálculo.
    expect(() => mesesParaCuota(15_000_000, 3, 30_000)).toThrow(ErrorPrestamo)
  })
})

describe('en qué orden pagar varias deudas', () => {
  const DEUDAS = [
    { id: 'tarjeta', nombre: 'Tarjeta', saldo: 180_000, tinAnual: 21, cuotaMinima: 6_000 },
    { id: 'coche', nombre: 'Coche', saldo: 850_000, tinAnual: 6.5, cuotaMinima: 18_000 },
    { id: 'estudios', nombre: 'Estudios', saldo: 400_000, tinAnual: 4, cuotaMinima: 9_000 },
  ]

  it('la avalancha ataca primero el tipo más alto', () => {
    const plan = planDePago(DEUDAS, 20_000, 'avalancha')
    expect(plan.liquidaciones[0]!.id).toBe('tarjeta')
  })

  it('la bola de nieve ataca primero el saldo más pequeño', () => {
    const plan = planDePago(DEUDAS, 20_000, 'bola_de_nieve')
    expect(plan.liquidaciones[0]!.id).toBe('tarjeta')
    // Con estas deudas coinciden en la primera; el orden completo no.
    expect(planDePago(DEUDAS, 20_000, 'avalancha').liquidaciones.map((l) => l.id)).not.toEqual(
      plan.liquidaciones.map((l) => l.id),
    )
  })

  it('la avalancha nunca paga más intereses que la bola de nieve', () => {
    const { sobrecosteBolaDeNieve } = compararEstrategias(DEUDAS, 20_000)
    expect(sobrecosteBolaDeNieve).toBeGreaterThanOrEqual(0)
  })

  it('las dos liquidan todo y dicen en cuántos meses', () => {
    const { avalancha, bolaDeNieve } = compararEstrategias(DEUDAS, 20_000)
    expect(avalancha.meses).not.toBeNull()
    expect(bolaDeNieve.meses).not.toBeNull()
    expect(avalancha.liquidaciones).toHaveLength(3)
  })

  it('con mínimos que no cubren los intereses responde «nunca», no un número enorme', () => {
    const imposible = [{ id: 'x', nombre: 'Revolving', saldo: 500_000, tinAnual: 24, cuotaMinima: 5_000 }]
    // 24 % anual sobre 5.000 € son 100 € al mes de intereses y el mínimo son 50.
    expect(planDePago(imposible, 0, 'avalancha').meses).toBeNull()
  })

  it('el extra acelera: más dinero al mes, menos meses y menos intereses', () => {
    const poco = planDePago(DEUDAS, 5_000, 'avalancha')
    const mucho = planDePago(DEUDAS, 50_000, 'avalancha')
    expect(mucho.meses!).toBeLessThan(poco.meses!)
    expect(mucho.interesTotal).toBeLessThan(poco.interesTotal)
  })
})

describe('varias amortizaciones anticipadas seguidas', () => {
  it('cada una se calcula sobre el préstamo tal como queda tras la anterior', () => {
    const cuadro = cuadroConAmortizaciones(HIPOTECA, [
      { trasCuota: 12, importe: 500_000, modo: 'reducir_plazo' },
      { trasCuota: 36, importe: 500_000, modo: 'reducir_plazo' },
    ])
    expect(cuadro[cuadro.length - 1]!.saldoVivo).toBe(0)
    expect(cuadro.length).toBeLessThan(360)
    // La numeración es continua: no hay saltos ni repetidos.
    expect(cuadro.map((c) => c.numero)).toEqual(cuadro.map((_, i) => i + 1))
  })

  it('amortizar dos veces acorta más que amortizar una', () => {
    const una = cuadroConAmortizaciones(HIPOTECA, [
      { trasCuota: 12, importe: 500_000, modo: 'reducir_plazo' },
    ])
    const dos = cuadroConAmortizaciones(HIPOTECA, [
      { trasCuota: 12, importe: 500_000, modo: 'reducir_plazo' },
      { trasCuota: 36, importe: 500_000, modo: 'reducir_plazo' },
    ])
    expect(dos.length).toBeLessThan(una.length)
  })

  it('el capital devuelto más lo amortizado suma el principal', () => {
    const extras = [
      { trasCuota: 12, importe: 500_000, modo: 'reducir_plazo' as const },
      { trasCuota: 36, importe: 500_000, modo: 'reducir_cuota' as const },
    ]
    const capital = cuadroConAmortizaciones(HIPOTECA, extras).reduce((t, c) => t + c.capital, 0)
    expect(capital + 1_000_000).toBe(HIPOTECA.principal)
  })
})
