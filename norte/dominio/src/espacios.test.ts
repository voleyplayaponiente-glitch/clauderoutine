import { describe, expect, it } from 'vitest'
import { admiteMiembros, decidirAcceso, esCuentaVisiblePara } from './espacios.js'
import { alcanza, nombreDeRol, puedeAdministrar, puedeEscribir } from './roles.js'

const miembro = (rol: 'propietario' | 'editor' | 'lector', espacioId = 'esp-1') => ({
  usuarioId: 'u-1',
  espacioId,
  rol,
})

describe('decidirAcceso', () => {
  it('deja pasar al que tiene rol de sobra', () => {
    expect(decidirAcceso(miembro('propietario'), { espacioId: 'esp-1', rolMinimo: 'editor' })).toEqual({
      permitido: true,
      rol: 'propietario',
    })
  })

  it('a quien no es miembro le dice «no existe», no «no puedes»', () => {
    // Si respondiéramos «sin permiso» estaríamos confirmando que el espacio
    // existe, y eso ya es información que un extraño no debería sacar.
    const fuera = decidirAcceso(null, { espacioId: 'esp-1', rolMinimo: 'lector' })
    expect(fuera).toMatchObject({ permitido: false, motivo: 'no_encontrado' })

    const otroEspacio = decidirAcceso(miembro('propietario', 'esp-2'), {
      espacioId: 'esp-1',
      rolMinimo: 'lector',
    })
    expect(otroEspacio).toMatchObject({ permitido: false, motivo: 'no_encontrado' })
  })

  it('al lector le explica por qué no puede escribir', () => {
    const decision = decidirAcceso(miembro('lector'), { espacioId: 'esp-1', rolMinimo: 'editor' })
    expect(decision).toMatchObject({ permitido: false, motivo: 'sin_permiso' })
    expect(decision.permitido === false && decision.mensaje).toContain('solo lectura')
  })

  it('el editor no administra', () => {
    const decision = decidirAcceso(miembro('editor'), { espacioId: 'esp-1', rolMinimo: 'propietario' })
    expect(decision).toMatchObject({ permitido: false, motivo: 'sin_permiso' })
    expect(decision.permitido === false && decision.mensaje).toContain('propietario')
  })
})

describe('roles', () => {
  it('ordena los permisos de menor a mayor', () => {
    expect(alcanza('propietario', 'lector')).toBe(true)
    expect(alcanza('editor', 'editor')).toBe(true)
    expect(alcanza('lector', 'editor')).toBe(false)
    expect(puedeEscribir('lector')).toBe(false)
    expect(puedeAdministrar('editor')).toBe(false)
    expect(nombreDeRol('lector')).toBe('solo lectura')
  })
})

describe('privacidad dentro del espacio compartido', () => {
  it('una cuenta no compartida solo la ve su dueño', () => {
    const personal = { propietarioId: 'u-1', visibleEnEspacio: false }
    expect(esCuentaVisiblePara(personal, 'u-1')).toBe(true)
    expect(esCuentaVisiblePara(personal, 'u-2')).toBe(false)
  })

  it('lo marcado como compartido lo ve todo el espacio', () => {
    const comun = { propietarioId: 'u-1', visibleEnEspacio: true }
    expect(esCuentaVisiblePara(comun, 'u-2')).toBe(true)
  })

  it('un espacio personal no admite invitados', () => {
    expect(admiteMiembros('personal')).toBe(false)
    expect(admiteMiembros('pareja')).toBe(true)
    expect(admiteMiembros('negocio')).toBe(true)
  })
})
