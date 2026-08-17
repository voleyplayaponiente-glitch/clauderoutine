import { describe, expect, it } from 'vitest'
import { evaluarContrasena } from './contrasenas.js'

describe('evaluarContrasena', () => {
  it('acepta una frase larga y normal', () => {
    expect(evaluarContrasena('el gato duerme en el tejado')).toEqual({ valida: true })
  })

  it('exige longitud, que es lo que de verdad protege', () => {
    const corta = evaluarContrasena('Abc123!')
    expect(corta.valida).toBe(false)
    expect(corta.mensaje).toContain('10 caracteres')
  })

  it('rechaza las de la lista de siempre', () => {
    expect(evaluarContrasena('contraseña').valida).toBe(false)
    expect(evaluarContrasena('qwertyuiop').valida).toBe(false)
  })

  it('no deja usar el propio nombre ni el correo', () => {
    const conNombre = evaluarContrasena('ramoncito1985', ['Ramon', 'ramon@ejemplo.es'])
    expect(conNombre.valida).toBe(false)
    expect(conNombre.mensaje).toContain('tu nombre')
  })

  it('no se queja de datos del usuario muy cortos', () => {
    // Con un nombre de 2 letras, «contiene el nombre» sería casi siempre cierto.
    expect(evaluarContrasena('la casa azul del pueblo', ['Al']).valida).toBe(true)
  })

  it('pide algo antes que aceptar el vacío', () => {
    expect(evaluarContrasena('').valida).toBe(false)
    expect(evaluarContrasena(undefined as unknown as string).valida).toBe(false)
  })
})
