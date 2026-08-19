import { describe, expect, it } from 'vitest'
import {
  calcularArrastre,
  calcularSobre,
  calendarioDelMes,
  proponerAsignacion,
  resumirPresupuesto,
  type EntradaSobre,
} from './presupuesto.js'

const BASE: EntradaSobre = {
  categoriaId: 'c1',
  categoria: 'Alimentación',
  tipo: 'variable',
  esencial: true,
  asignado: 40000,
  arrastrado: 0,
  gastado: 0,
  previsto: 0,
  rollover: false,
}

// Mitad de mes: 15 de un mes de 31 días.
const MEDIADOS = { porcentajeTranscurrido: 48.4, diasRestantes: 17 }

describe('el estado de un sobre', () => {
  it('el disponible es lo asignado más lo arrastrado menos lo gastado', () => {
    const sobre = calcularSobre({ ...BASE, arrastrado: 5000, gastado: 12000 }, MEDIADOS)
    expect(sobre.presupuesto).toBe(45000)
    expect(sobre.disponible).toBe(33000)
  })

  it('lo previsto no se descuenta del disponible, se enseña aparte', () => {
    // Un recibo domiciliado que aún no ha pasado no se ha gastado, pero
    // tampoco está libre. Mezclarlos haría que el saldo del sobre mintiera.
    const sobre = calcularSobre({ ...BASE, gastado: 10000, previsto: 25000 }, MEDIADOS)
    expect(sobre.disponible).toBe(30000)
    expect(sobre.disponibleTrasPrevisto).toBe(5000)
  })

  it('juzga el gasto contra el calendario, no contra el total', () => {
    // 200 € de 400 el día 15 es ir al ritmo; el día 3 sería ir disparado.
    const aMitad = calcularSobre({ ...BASE, gastado: 20000 }, MEDIADOS)
    expect(aMitad.ritmo).toBe('holgado')

    const alPrincipio = calcularSobre(
      { ...BASE, gastado: 20000 },
      { porcentajeTranscurrido: 9.7, diasRestantes: 28 },
    )
    expect(alPrincipio.ritmo).toBe('justo')
  })

  it('pasarse del sobre manda sobre cualquier ritmo', () => {
    const sobre = calcularSobre(
      { ...BASE, gastado: 45000 },
      { porcentajeTranscurrido: 100, diasRestantes: 0 },
    )
    expect(sobre.ritmo).toBe('pasado')
    expect(sobre.disponible).toBe(-5000)
  })

  it('un sobre sin asignar se distingue de uno agotado', () => {
    expect(calcularSobre({ ...BASE, asignado: 0 }, MEDIADOS).ritmo).toBe('sin_asignar')
    expect(calcularSobre({ ...BASE, asignado: 0, gastado: 1000 }, MEDIADOS).ritmo).toBe('pasado')
  })

  it('dice cuánto queda por día, y calla cuando el número sería ruido', () => {
    // 330 € entre los 17 días que quedan.
    const sobre = calcularSobre({ ...BASE, gastado: 7000 }, MEDIADOS)
    expect(sobre.porDia).toBe(Math.floor(33000 / 17))

    // Mes terminado: no hay días por delante que repartir.
    expect(calcularSobre(BASE, { porcentajeTranscurrido: 100, diasRestantes: 0 }).porDia).toBeNull()
    // Sobre agotado: un «puedes gastar» negativo no es un consejo.
    expect(calcularSobre({ ...BASE, gastado: 45000 }, MEDIADOS).porDia).toBeNull()
  })

  it('el gasto diario descuenta lo previsto, o sería un consejo envenenado', () => {
    // Es el caso del alquiler domiciliado: 750 € en el sobre y 750 € a punto
    // de salir. Decir «58 €/día» ahí deja el recibo al descubierto.
    const vivienda = calcularSobre(
      { ...BASE, asignado: 75000, previsto: 75000 },
      { porcentajeTranscurrido: 61.3, diasRestantes: 13 },
    )
    expect(vivienda.disponible).toBe(75000)
    expect(vivienda.disponibleTrasPrevisto).toBe(0)
    expect(vivienda.porDia).toBeNull()
  })
})

describe('el resumen del mes', () => {
  const sobres = [
    calcularSobre({ ...BASE, asignado: 40000, gastado: 20000 }, MEDIADOS),
    calcularSobre(
      { ...BASE, categoriaId: 'c2', categoria: 'Ocio', asignado: 10000, gastado: 13000 },
      MEDIADOS,
    ),
    calcularSobre(
      { ...BASE, categoriaId: 'c3', categoria: 'Transporte', asignado: 15000, gastado: 12000, previsto: 6000 },
      MEDIADOS,
    ),
  ]

  it('lo que queda sin repartir es la cifra que manda', () => {
    const resumen = resumirPresupuesto(sobres, 250000)
    expect(resumen.asignado).toBe(65000)
    expect(resumen.sinAsignar).toBe(185000)
  })

  it('repartir más de lo que entra sale en negativo, no se esconde', () => {
    expect(resumirPresupuesto(sobres, 50000).sinAsignar).toBe(-15000)
  })

  it('cuenta los sobres pasados y los que no llegan a fin de mes', () => {
    const resumen = resumirPresupuesto(sobres, 250000)
    expect(resumen.sobresPasados).toBe(1)
    // Transporte va justo y lo previsto se lo come: 15.000 - 12.000 - 6.000.
    expect(resumen.sobresEnRiesgo).toBe(1)
  })
})

describe('el calendario del mes', () => {
  it('el día 15 de un mes de 31 va por la mitad y quedan 17 días', () => {
    const calendario = calendarioDelMes('2026-08-01', new Date(2026, 7, 15))
    expect(calendario.porcentajeTranscurrido).toBeCloseTo(48.39, 1)
    expect(calendario.diasRestantes).toBe(17)
  })

  it('el último día del mes todavía cuenta como día', () => {
    expect(calendarioDelMes('2026-08-01', new Date(2026, 7, 31)).diasRestantes).toBe(1)
  })

  it('un mes ya pasado está al 100 y un mes futuro al 0', () => {
    expect(calendarioDelMes('2026-07-01', new Date(2026, 7, 15))).toEqual({
      porcentajeTranscurrido: 100,
      diasRestantes: 0,
    })
    expect(calendarioDelMes('2026-09-01', new Date(2026, 7, 15))).toEqual({
      porcentajeTranscurrido: 0,
      diasRestantes: 30,
    })
  })
})

describe('el arrastre al mes siguiente', () => {
  it('arrastra lo que sobró cuando el sobre lo tiene activado', () => {
    const sobre = calcularSobre({ ...BASE, rollover: true, gastado: 30000 }, MEDIADOS)
    expect(calcularArrastre([sobre])[0]).toEqual({
      categoriaId: 'c1',
      arrastrado: 10000,
      motivo: 'sobro',
    })
  })

  it('arrastra también lo que faltó, que es lo que hace que el método sirva', () => {
    // Pasarse 80 € y empezar el mes siguiente como si nada convierte el
    // presupuesto en un marcador amable.
    const sobre = calcularSobre({ ...BASE, rollover: true, gastado: 48000 }, MEDIADOS)
    expect(calcularArrastre([sobre])[0]).toEqual({
      categoriaId: 'c1',
      arrastrado: -8000,
      motivo: 'se_paso',
    })
  })

  it('sin rollover no se lleva nada, ni bueno ni malo', () => {
    const sobre = calcularSobre({ ...BASE, gastado: 10000 }, MEDIADOS)
    expect(calcularArrastre([sobre])[0]).toMatchObject({ arrastrado: 0, motivo: 'no_arrastra' })
  })
})

describe('la propuesta para el mes que viene', () => {
  it('usa la mediana en los variables, para que un mes raro no mande', () => {
    // La revisión del coche en marzo no puede convertirse en el presupuesto
    // mensual de transporte.
    const propuesta = proponerAsignacion({ categoriaId: 'c1', tipo: 'variable' }, [
      9000, 9500, 62000, 8800,
    ])
    expect(propuesta.propuesto).toBe(9300)
    expect(propuesta.base).toBe('mediana')
    expect(propuesta.mesesMirados).toBe(4)
  })

  it('en los fijos usa el último mes: un recibo no es una distribución', () => {
    const propuesta = proponerAsignacion({ categoriaId: 'c1', tipo: 'fijo' }, [6000, 6100, 7350])
    expect(propuesta).toMatchObject({ propuesto: 7400, base: 'ultimo_mes' })
  })

  it('sin histórico propone cero y lo dice, en vez de inventarse una cifra', () => {
    expect(proponerAsignacion({ categoriaId: 'c1', tipo: 'variable' }, [])).toMatchObject({
      propuesto: 0,
      base: 'sin_historico',
    })
  })

  it('redondea al euro: un presupuesto con céntimos no se lo cree nadie', () => {
    const propuesta = proponerAsignacion({ categoriaId: 'c1', tipo: 'variable' }, [12345])
    expect(propuesta.propuesto).toBe(12400)
  })
})
