import { describe, it, expect } from 'vitest'
import { validarNifCif } from './validacion'

describe('validación de identificadores fiscales', () => {
  it('valida DNI correctos y rechaza la letra errónea', () => {
    expect(validarNifCif('12345678Z')).toEqual({ valido: true, tipo: 'DNI' })
    expect(validarNifCif('12345678A').valido).toBe(false)
  })
  it('valida NIE', () => {
    expect(validarNifCif('X1234567L')).toEqual({ valido: true, tipo: 'NIE' })
    expect(validarNifCif('Z1234567R').valido).toBe(true)
  })
  it('valida CIF con dígito de control', () => {
    expect(validarNifCif('A58818501')).toEqual({ valido: true, tipo: 'CIF' })
    expect(validarNifCif('A58818502').valido).toBe(false)
  })
  it('normaliza espacios, guiones y minúsculas', () => {
    expect(validarNifCif(' 12345678-z ').valido).toBe(true)
  })
  it('vacío o basura no es válido', () => {
    expect(validarNifCif('')).toEqual({ valido: false, tipo: 'DESCONOCIDO' })
    expect(validarNifCif('???').valido).toBe(false)
  })
})
