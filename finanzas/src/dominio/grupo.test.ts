import { describe, it, expect } from 'vitest'
import {
  grupoInicial,
  validarParticipacion,
  porcentajeEfectivo,
  porcentajeAsignado,
  relacionPorPorcentaje,
  organigrama,
  filasOrganigrama,
  agregarGrupo,
  alcanza,
  type Grupo,
  type EmpresaResumen,
  type Participacion,
} from './grupo'

function empresa(id: string, razonSocial: string, esHolding = false): EmpresaResumen {
  return { id, razonSocial, cif: `B0000000${id}`, esHolding, creadaEn: '2026-01-01' }
}

function part(id: string, matrizId: string, participadaId: string, porcentaje: number): Participacion {
  return { id, matrizId, participadaId, porcentaje }
}

/** Holding H con el 100 % de A y el 60 % de B; A con el 50 % de C. */
function grupoEjemplo(): Grupo {
  return {
    version: 1,
    nombre: 'Grupo',
    empresas: [empresa('H', 'Holding SL', true), empresa('A', 'Tienda A SL'), empresa('B', 'Tienda B SL'), empresa('C', 'Online C SL')],
    participaciones: [part('p1', 'H', 'A', 100), part('p2', 'H', 'B', 60), part('p3', 'A', 'C', 50)],
    socios: [],
    empresaActivaId: 'H',
  }
}

describe('alta del grupo', () => {
  it('arranca con la empresa creada como activa y sin participaciones', () => {
    const g = grupoInicial(empresa('E1', 'Mi empresa SL'))
    expect(g.empresas).toHaveLength(1)
    expect(g.empresaActivaId).toBe('E1')
    expect(g.participaciones).toEqual([])
  })
})

describe('relación según el porcentaje (umbrales del PGC)', () => {
  it('más del 50 % es dependiente', () => {
    expect(relacionPorPorcentaje(50.01)).toBe('DEPENDIENTE')
    expect(relacionPorPorcentaje(100)).toBe('DEPENDIENTE')
  })
  it('el 50 % exacto no da control', () => {
    expect(relacionPorPorcentaje(50)).toBe('ASOCIADA')
  })
  it('desde el 20 % hay influencia significativa', () => {
    expect(relacionPorPorcentaje(20)).toBe('ASOCIADA')
    expect(relacionPorPorcentaje(19.99)).toBe('PARTICIPADA')
  })
})

describe('validación de participaciones', () => {
  it('acepta una participación normal', () => {
    const g = grupoEjemplo()
    expect(validarParticipacion(g, part('nuevo', 'H', 'C', 25)).valido).toBe(true)
  })

  it('rechaza que una empresa participe en sí misma', () => {
    const g = grupoEjemplo()
    const r = validarParticipacion(g, part('nuevo', 'A', 'A', 10))
    expect(r.valido).toBe(false)
    expect(r.motivo).toMatch(/sí misma/)
  })

  it('rechaza porcentajes fuera de rango', () => {
    const g = grupoEjemplo()
    expect(validarParticipacion(g, part('nuevo', 'B', 'C', 0)).valido).toBe(false)
    expect(validarParticipacion(g, part('nuevo', 'B', 'C', -5)).valido).toBe(false)
    expect(validarParticipacion(g, part('nuevo', 'B', 'C', 100.5)).valido).toBe(false)
  })

  it('impide repartir más del 100 % del capital de una participada', () => {
    const g = grupoEjemplo() // H ya tiene el 60 % de B
    const r = validarParticipacion(g, part('nuevo', 'A', 'B', 50))
    expect(r.valido).toBe(false)
    expect(r.motivo).toMatch(/100 %/)
    // El 40 % restante sí cabe.
    expect(validarParticipacion(g, part('nuevo', 'A', 'B', 40)).valido).toBe(true)
  })

  it('al editar una participación no la cuenta contra sí misma', () => {
    const g = grupoEjemplo()
    // p2 es el 60 % de H sobre B; subirlo al 100 % debe caber.
    expect(validarParticipacion(g, part('p2', 'H', 'B', 100)).valido).toBe(true)
  })

  it('rechaza duplicar la participación entre las mismas empresas', () => {
    const g = grupoEjemplo()
    const r = validarParticipacion(g, part('otra', 'H', 'A', 5))
    expect(r.valido).toBe(false)
    expect(r.motivo).toMatch(/Ya existe/)
  })

  it('rechaza los círculos entre empresas', () => {
    const g = grupoEjemplo() // H → A → C
    const r = validarParticipacion(g, part('nuevo', 'C', 'H', 10))
    expect(r.valido).toBe(false)
    expect(r.motivo).toMatch(/círculo/)
  })

  it('rechaza un círculo directo de vuelta a la matriz', () => {
    const g = grupoEjemplo()
    expect(validarParticipacion(g, part('nuevo', 'A', 'H', 10)).valido).toBe(false)
  })

  it('rechaza empresas que no existen', () => {
    const g = grupoEjemplo()
    expect(validarParticipacion(g, part('nuevo', 'Z', 'A', 10)).valido).toBe(false)
    expect(validarParticipacion(g, part('nuevo', 'A', 'Z', 10)).valido).toBe(false)
  })
})

describe('alcance entre empresas', () => {
  it('detecta el camino indirecto', () => {
    const g = grupoEjemplo()
    expect(alcanza(g, 'H', 'C')).toBe(true)
    expect(alcanza(g, 'C', 'H')).toBe(false)
    expect(alcanza(g, 'B', 'C')).toBe(false)
  })
})

describe('porcentaje asignado', () => {
  it('suma el capital ya repartido de una participada', () => {
    expect(porcentajeAsignado(grupoEjemplo(), 'B')).toBe(60)
    expect(porcentajeAsignado(grupoEjemplo(), 'A')).toBe(100)
    expect(porcentajeAsignado(grupoEjemplo(), 'H')).toBe(0)
  })
})

describe('porcentaje efectivo', () => {
  it('la participación directa se mantiene', () => {
    expect(porcentajeEfectivo(grupoEjemplo(), 'H', 'B')).toBe(60)
  })

  it('multiplica a lo largo de la cadena', () => {
    // H tiene el 100 % de A y A el 50 % de C → 50 % efectivo.
    expect(porcentajeEfectivo(grupoEjemplo(), 'H', 'C')).toBe(50)
  })

  it('encadena varios niveles', () => {
    const g = grupoEjemplo()
    g.participaciones = [part('p1', 'H', 'A', 60), part('p3', 'A', 'C', 50)]
    expect(porcentajeEfectivo(g, 'H', 'C')).toBe(30) // 60 % × 50 %
  })

  it('suma los caminos cuando se llega por dos vías', () => {
    const g: Grupo = {
      version: 1,
      nombre: 'G',
      empresas: [empresa('H', 'H', true), empresa('A', 'A'), empresa('B', 'B'), empresa('C', 'C')],
      participaciones: [
        part('p1', 'H', 'A', 60),
        part('p2', 'H', 'B', 40),
        part('p3', 'A', 'C', 50),
        part('p4', 'B', 'C', 50),
      ],
      socios: [],
      empresaActivaId: 'H',
    }
    // 60 %×50 % + 40 %×50 % = 30 + 20 = 50
    expect(porcentajeEfectivo(g, 'H', 'C')).toBe(50)
  })

  it('una empresa se posee a sí misma al 100 %', () => {
    expect(porcentajeEfectivo(grupoEjemplo(), 'A', 'A')).toBe(100)
  })

  it('devuelve 0 si no hay relación', () => {
    expect(porcentajeEfectivo(grupoEjemplo(), 'B', 'A')).toBe(0)
  })
})

describe('organigrama', () => {
  it('cuelga todo del holding y respeta los niveles', () => {
    const raices = organigrama(grupoEjemplo())
    expect(raices).toHaveLength(1)
    expect(raices[0].empresa.id).toBe('H')
    expect(raices[0].nivel).toBe(0)
    const hijos = raices[0].hijos.map((h) => h.empresa.id).sort()
    expect(hijos).toEqual(['A', 'B'])
    const a = raices[0].hijos.find((h) => h.empresa.id === 'A')!
    expect(a.porcentaje).toBe(100)
    expect(a.relacion).toBe('DEPENDIENTE')
    expect(a.hijos[0].empresa.id).toBe('C')
    expect(a.hijos[0].nivel).toBe(2)
  })

  it('una empresa suelta aparece como raíz y no se pierde', () => {
    const g = grupoEjemplo()
    g.empresas.push(empresa('X', 'Independiente SL'))
    const ids = organigrama(g).map((n) => n.empresa.id).sort()
    expect(ids).toEqual(['H', 'X'])
    expect(filasOrganigrama(g)).toHaveLength(5)
  })

  it('aplana en el orden de lectura del árbol', () => {
    expect(filasOrganigrama(grupoEjemplo()).map((f) => f.empresa.id)).toEqual(['H', 'A', 'C', 'B'])
  })
})

describe('vista agregada (suma, no consolidación)', () => {
  const cifras = [
    { empresaId: 'H', razonSocial: 'Holding SL', tesoreria: 10000, ventaMes: 0, resultadoMes: -1500, deudaTotal: 0, stockValorado: 0 },
    { empresaId: 'A', razonSocial: 'Tienda A SL', tesoreria: 5000, ventaMes: 30000, resultadoMes: 4000, deudaTotal: 20000, stockValorado: 12000 },
    { empresaId: 'B', razonSocial: 'Tienda B SL', tesoreria: 2500.5, ventaMes: 18000, resultadoMes: 1200, deudaTotal: 8000, stockValorado: 7000 },
  ]

  it('suma cada magnitud de todas las empresas', () => {
    const a = agregarGrupo(cifras)
    expect(a.tesoreria).toBe(17500.5)
    expect(a.ventaMes).toBe(48000)
    expect(a.resultadoMes).toBe(3700)
    expect(a.deudaTotal).toBe(28000)
    expect(a.stockValorado).toBe(19000)
  })

  it('conserva el detalle por empresa', () => {
    expect(agregarGrupo(cifras).empresas).toHaveLength(3)
  })

  it('con el grupo vacío devuelve ceros', () => {
    const a = agregarGrupo([])
    expect(a.tesoreria).toBe(0)
    expect(a.ventaMes).toBe(0)
  })

  it('no arrastra error de coma flotante', () => {
    const a = agregarGrupo([
      { empresaId: '1', razonSocial: 'A', tesoreria: 0.1, ventaMes: 0, resultadoMes: 0, deudaTotal: 0, stockValorado: 0 },
      { empresaId: '2', razonSocial: 'B', tesoreria: 0.2, ventaMes: 0, resultadoMes: 0, deudaTotal: 0, stockValorado: 0 },
    ])
    expect(a.tesoreria).toBe(0.3)
  })
})
