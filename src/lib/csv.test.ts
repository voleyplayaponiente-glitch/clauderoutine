import { describe, it, expect } from 'vitest'
import type { Team } from '@/types'
import { teamsToCSV, csvToTeams } from './csv'
import { uid } from '@/engine/id'

function team(numero: number, nombre: string, jugadores: string[], extra: Partial<Team> = {}): Team {
  return {
    id: uid('t'),
    numero,
    nombre,
    jugadores: jugadores.map((n) => ({ id: uid('p'), nombre: n })),
    cabezaSerie: false,
    estadoInscripcion: 'inscrito',
    ...extra,
  }
}

describe('CSV round-trip', () => {
  it('exports and re-imports 5 players + subcategoría', () => {
    const teams = [
      team(1, 'Los Tiburones', ['A', 'B', 'C', 'D', 'E'], { subcategoria: 'SUB-17', telefono: '600', importePagado: 30 }),
      team(2, 'Sol y Arena', ['F', 'G', 'H', 'I', 'J'], { subcategoria: 'SUB-15', cabezaSerie: true }),
    ]
    const csv = teamsToCSV(teams)
    expect(csv.split('\n')[0]).toContain('Jugador5')
    expect(csv.split('\n')[0]).toContain('Subcategoria')

    const back = csvToTeams(csv)
    expect(back).toHaveLength(2)
    expect(back[0].jugadores.map((j) => j.nombre)).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(back[0].subcategoria).toBe('SUB-17')
    expect(back[1].subcategoria).toBe('SUB-15')
    expect(back[1].cabezaSerie).toBe(true)
  })

  it('handles a 2x2 team (2 players)', () => {
    const csv = teamsToCSV([team(1, 'Dúo', ['Ana', 'Bea'])])
    const back = csvToTeams(csv)
    expect(back[0].jugadores.map((j) => j.nombre)).toEqual(['Ana', 'Bea'])
  })

  it('still imports a legacy 2-player CSV with header', () => {
    const legacy = 'Numero;Equipo;Jugador1;Jugador2;Telefono;CabezaSerie;Estado;ImportePagado;Observaciones\n1;Viejo;Uno;Dos;600;No;inscrito;0;'
    const back = csvToTeams(legacy)
    expect(back[0].nombre).toBe('Viejo')
    expect(back[0].jugadores.map((j) => j.nombre)).toEqual(['Uno', 'Dos'])
    expect(back[0].telefono).toBe('600')
  })
})
