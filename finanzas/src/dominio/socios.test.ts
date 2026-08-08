import { describe, it, expect } from 'vitest'
import {
  capitalDeSocios,
  primaTotal,
  pendienteTotal,
  sociosVigentes,
  sociosDeBaja,
  validarSocio,
  capTable,
  resumenAccionariado,
  valorNominalUnitario,
  avisosAccionariado,
  type Socio,
} from './socios'
import type { Grupo, EmpresaResumen } from './grupo'

function empresa(id: string, razonSocial: string, capitalSocial?: number, esHolding = false): EmpresaResumen {
  return { id, razonSocial, cif: `B0000000${id}`, esHolding, creadaEn: '2026-01-01', capitalSocial }
}

function socio(p: Partial<Socio> & { id: string; nombre: string; capitalNominal: number }): Socio {
  return {
    empresaId: 'H',
    nifCif: '12345678Z',
    tipo: 'PERSONA_FISICA',
    ...p,
  } as Socio
}

/** Holding con 3.000 € de capital y dos socios personas físicas. */
function grupoBase(capital = 3000): Grupo {
  return {
    version: 1,
    nombre: 'Grupo',
    empresas: [empresa('H', 'Holding SL', capital, true), empresa('A', 'Tienda A SL', 3000)],
    participaciones: [],
    socios: [
      socio({ id: 's1', nombre: 'Ana', capitalNominal: 1800, numParticipaciones: 1800, esAdministrador: true }),
      socio({ id: 's2', nombre: 'Luis', capitalNominal: 1200, numParticipaciones: 1200 }),
    ],
    empresaActivaId: 'H',
  }
}

describe('libro registro de socios', () => {
  it('separa vigentes de bajas', () => {
    const g = grupoBase()
    g.socios.push(socio({ id: 's3', nombre: 'Antiguo', capitalNominal: 500, fechaBaja: '2025-06-30' }))
    expect(sociosVigentes(g.socios, 'H').map((s) => s.nombre)).toEqual(['Ana', 'Luis'])
    expect(sociosDeBaja(g.socios, 'H').map((s) => s.nombre)).toEqual(['Antiguo'])
  })

  it('no mezcla socios de otras empresas', () => {
    const g = grupoBase()
    g.socios.push(socio({ id: 's9', nombre: 'De la filial', capitalNominal: 999, empresaId: 'A' }))
    expect(sociosVigentes(g.socios, 'H')).toHaveLength(2)
    expect(sociosVigentes(g.socios, 'A')).toHaveLength(1)
  })

  it('suma el capital sin arrastrar decimales', () => {
    const socios = [
      socio({ id: 'a', nombre: 'A', capitalNominal: 0.1 }),
      socio({ id: 'b', nombre: 'B', capitalNominal: 0.2 }),
    ]
    expect(capitalDeSocios(socios)).toBe(0.3)
  })

  it('suma prima de emisión y pendiente de desembolso', () => {
    const socios = [
      socio({ id: 'a', nombre: 'A', capitalNominal: 1000, primaEmision: 500, pendienteDesembolso: 250 }),
      socio({ id: 'b', nombre: 'B', capitalNominal: 1000, primaEmision: 100 }),
    ]
    expect(primaTotal(socios)).toBe(600)
    expect(pendienteTotal(socios)).toBe(250)
  })
})

describe('validación del socio', () => {
  it('exige nombre', () => {
    expect(validarSocio(socio({ id: 'x', nombre: '   ', capitalNominal: 100 })).valido).toBe(false)
  })
  it('rechaza importes negativos', () => {
    expect(validarSocio(socio({ id: 'x', nombre: 'A', capitalNominal: -1 })).valido).toBe(false)
    expect(validarSocio(socio({ id: 'x', nombre: 'A', capitalNominal: 100, primaEmision: -1 })).valido).toBe(false)
    expect(validarSocio(socio({ id: 'x', nombre: 'A', capitalNominal: 100, pendienteDesembolso: -1 })).valido).toBe(false)
  })
  it('el pendiente de desembolso no puede superar lo suscrito', () => {
    const r = validarSocio(socio({ id: 'x', nombre: 'A', capitalNominal: 100, pendienteDesembolso: 150 }))
    expect(r.valido).toBe(false)
    expect(r.motivo).toMatch(/desembolso/)
  })
  it('acepta un socio correcto', () => {
    expect(validarSocio(socio({ id: 'x', nombre: 'Ana', capitalNominal: 1800, pendienteDesembolso: 1800 })).valido).toBe(true)
  })
})

describe('cuadro de accionariado', () => {
  it('calcula el porcentaje desde el capital nominal', () => {
    const filas = capTable(grupoBase(), 'H', grupoBase().socios)
    expect(filas.map((f) => [f.nombre, f.porcentaje])).toEqual([
      ['Ana', 60],
      ['Luis', 40],
    ])
  })

  it('ordena de mayor a menor participación', () => {
    const g = grupoBase()
    g.socios = [
      socio({ id: 's1', nombre: 'Pequeño', capitalNominal: 300 }),
      socio({ id: 's2', nombre: 'Grande', capitalNominal: 2700 }),
    ]
    expect(capTable(g, 'H', g.socios)[0].nombre).toBe('Grande')
  })

  it('incluye a las empresas del grupo que participan, con su nominal deducido', () => {
    const g = grupoBase()
    g.participaciones = [{ id: 'p1', matrizId: 'H', participadaId: 'A', porcentaje: 75 }]
    const filas = capTable(g, 'A', g.socios)
    expect(filas).toHaveLength(1)
    expect(filas[0].origen).toBe('EMPRESA_GRUPO')
    expect(filas[0].nombre).toBe('Holding SL')
    expect(filas[0].porcentaje).toBe(75)
    expect(filas[0].capitalNominal).toBe(2250) // 75 % de 3.000 €
  })

  it('mezcla socios personas y empresas del grupo en el mismo cuadro', () => {
    const g = grupoBase()
    g.participaciones = [{ id: 'p1', matrizId: 'H', participadaId: 'A', porcentaje: 60 }]
    g.socios.push(socio({ id: 's5', nombre: 'Socio externo', capitalNominal: 1200, empresaId: 'A' }))
    const filas = capTable(g, 'A', g.socios)
    expect(filas.map((f) => [f.nombre, f.porcentaje])).toEqual([
      ['Holding SL', 60],
      ['Socio externo', 40],
    ])
  })

  it('sin capital escriturado usa lo aportado por los socios como referencia', () => {
    const g = grupoBase(0) // el holding no declara capital escriturado
    const filas = capTable(g, 'H', g.socios)
    expect(filas.map((f) => f.porcentaje)).toEqual([60, 40])
  })

  it('sin socios ni participaciones el cuadro está vacío', () => {
    const g = grupoBase()
    expect(capTable(g, 'A', g.socios)).toEqual([])
  })
})

describe('resumen del accionariado', () => {
  it('cuadra cuando lo repartido coincide con lo escriturado', () => {
    const g = grupoBase()
    const r = resumenAccionariado(g, 'H', g.socios)
    expect(r.capitalEscriturado).toBe(3000)
    expect(r.capitalRepartido).toBe(3000)
    expect(r.descuadre).toBe(0)
    expect(r.cuadra).toBe(true)
    expect(r.porcentajeCubierto).toBe(100)
    expect(r.numTitulares).toBe(2)
  })

  it('detecta el descuadre y NO lo esconde', () => {
    const g = grupoBase()
    g.socios = [socio({ id: 's1', nombre: 'Ana', capitalNominal: 2000 })]
    const r = resumenAccionariado(g, 'H', g.socios)
    expect(r.cuadra).toBe(false)
    expect(r.descuadre).toBe(1000)
  })

  it('detecta capital repartido de más', () => {
    const g = grupoBase()
    g.socios.push(socio({ id: 's3', nombre: 'Extra', capitalNominal: 500 }))
    const r = resumenAccionariado(g, 'H', g.socios)
    expect(r.cuadra).toBe(false)
    expect(r.descuadre).toBe(-500)
  })

  it('identifica al socio mayoritario', () => {
    const g = grupoBase()
    expect(resumenAccionariado(g, 'H', g.socios).socioMayoritario?.nombre).toBe('Ana')
  })

  it('con el capital al 50/50 no hay mayoritario', () => {
    const g = grupoBase()
    g.socios = [
      socio({ id: 's1', nombre: 'Ana', capitalNominal: 1500 }),
      socio({ id: 's2', nombre: 'Luis', capitalNominal: 1500 }),
    ]
    expect(resumenAccionariado(g, 'H', g.socios).socioMayoritario).toBeUndefined()
  })

  it('detecta la sociedad unipersonal', () => {
    const g = grupoBase()
    g.socios = [socio({ id: 's1', nombre: 'Ana', capitalNominal: 3000 })]
    const r = resumenAccionariado(g, 'H', g.socios)
    expect(r.esUnipersonal).toBe(true)
    expect(r.socioMayoritario?.nombre).toBe('Ana')
  })

  it('dos socios nunca son unipersonal', () => {
    expect(resumenAccionariado(grupoBase(), 'H', grupoBase().socios).esUnipersonal).toBe(false)
  })

  it('acumula prima y pendiente de desembolso', () => {
    const g = grupoBase()
    g.socios[0].primaEmision = 5000
    g.socios[1].pendienteDesembolso = 600
    const r = resumenAccionariado(g, 'H', g.socios)
    expect(r.primaEmision).toBe(5000)
    expect(r.pendienteDesembolso).toBe(600)
  })
})

describe('valor nominal por participación', () => {
  it('lo deduce del nº de participaciones', () => {
    expect(valorNominalUnitario(socio({ id: 'a', nombre: 'A', capitalNominal: 1800, numParticipaciones: 1800 }))).toBe(1)
    expect(valorNominalUnitario(socio({ id: 'a', nombre: 'A', capitalNominal: 3000, numParticipaciones: 300 }))).toBe(10)
  })
  it('sin nº de participaciones no lo inventa', () => {
    expect(valorNominalUnitario(socio({ id: 'a', nombre: 'A', capitalNominal: 1800 }))).toBeUndefined()
    expect(valorNominalUnitario(socio({ id: 'a', nombre: 'A', capitalNominal: 1800, numParticipaciones: 0 }))).toBeUndefined()
  })
})

describe('avisos del accionariado', () => {
  it('un accionariado correcto no genera avisos', () => {
    expect(avisosAccionariado(grupoBase(), 'H', grupoBase().socios)).toEqual([])
  })

  it('avisa si no hay socios', () => {
    const g = grupoBase()
    expect(avisosAccionariado(g, 'A', g.socios)[0]).toMatch(/ningún socio/)
  })

  it('avisa del capital sin repartir', () => {
    const g = grupoBase()
    g.socios = [socio({ id: 's1', nombre: 'Ana', capitalNominal: 2000 })]
    expect(avisosAccionariado(g, 'H', g.socios).some((a) => /Faltan 1\.000,00/.test(a))).toBe(true)
  })

  it('avisa del capital pendiente de desembolsar', () => {
    const g = grupoBase()
    g.socios[0].pendienteDesembolso = 900
    expect(avisosAccionariado(g, 'H', g.socios).some((a) => /900,00/.test(a))).toBe(true)
  })

  it('avisa de la unipersonalidad', () => {
    const g = grupoBase()
    g.socios = [socio({ id: 's1', nombre: 'Ana', capitalNominal: 3000 })]
    expect(avisosAccionariado(g, 'H', g.socios).some((a) => /unipersonal/.test(a))).toBe(true)
  })

  it('avisa si los nominales unitarios no coinciden', () => {
    const g = grupoBase()
    g.socios[0].numParticipaciones = 180 // 10 €/participación
    g.socios[1].numParticipaciones = 1200 // 1 €/participación
    expect(avisosAccionariado(g, 'H', g.socios).some((a) => /valor nominal/.test(a))).toBe(true)
  })
})
