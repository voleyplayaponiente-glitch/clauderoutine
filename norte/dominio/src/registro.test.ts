import { describe, expect, it } from 'vitest'
import { decidirRegistro, mismoCorreo } from './registro.js'

const AHORA = new Date('2026-08-18T10:00:00Z')
const MANANA = new Date('2026-08-19T10:00:00Z')
const AYER = new Date('2026-08-17T10:00:00Z')

describe('la primera cuenta', () => {
  it('entra sin invitación: quien instala, manda', () => {
    expect(
      decidirRegistro({ hayUsuarios: false, email: 'ana@ejemplo.es', ahora: AHORA }),
    ).toEqual({ permitido: true, primeraCuenta: true })
  })

  it('deja de ser libre en cuanto hay alguien', () => {
    const decision = decidirRegistro({ hayUsuarios: true, email: 'otro@ejemplo.es', ahora: AHORA })
    expect(decision).toMatchObject({ permitido: false, motivo: 'cerrado' })
    // El mensaje tiene que decir qué hacer, no solo que no.
    expect(decision.permitido === false && decision.mensaje).toContain('invitación')
  })
})

describe('con invitación', () => {
  const valida = { expiraEn: MANANA }

  it('deja pasar a quien trae una en regla', () => {
    expect(
      decidirRegistro({
        hayUsuarios: true,
        email: 'berta@ejemplo.es',
        invitacion: valida,
        ahora: AHORA,
      }),
    ).toEqual({ permitido: true, primeraCuenta: false })
  })

  it('no vale dos veces', () => {
    const decision = decidirRegistro({
      hayUsuarios: true,
      email: 'berta@ejemplo.es',
      invitacion: { ...valida, aceptadaEn: AYER },
      ahora: AHORA,
    })
    // Si valiera más de una vez, el enlace reenviado a un grupo sería un
    // registro abierto con pasos extra.
    expect(decision).toMatchObject({ permitido: false, motivo: 'invitacion_usada' })
  })

  it('caduca', () => {
    expect(
      decidirRegistro({
        hayUsuarios: true,
        email: 'berta@ejemplo.es',
        invitacion: { expiraEn: AYER },
        ahora: AHORA,
      }),
    ).toMatchObject({ permitido: false, motivo: 'invitacion_caducada' })
  })

  it('se puede anular antes de que la usen', () => {
    expect(
      decidirRegistro({
        hayUsuarios: true,
        email: 'berta@ejemplo.es',
        invitacion: { ...valida, revocadaEn: AYER },
        ahora: AHORA,
      }),
    ).toMatchObject({ permitido: false, motivo: 'invitacion_revocada' })
  })

  it('si va dirigida a alguien, solo vale para esa persona', () => {
    const decision = decidirRegistro({
      hayUsuarios: true,
      email: 'otra@ejemplo.es',
      invitacion: { ...valida, email: 'berta@ejemplo.es' },
      ahora: AHORA,
    })
    expect(decision).toMatchObject({ permitido: false, motivo: 'correo_no_coincide' })
    // Y dice para quién es, o el que la recibe no sabe qué corregir.
    expect(decision.permitido === false && decision.mensaje).toContain('berta@ejemplo.es')
  })

  it('sin correo, vale para quien tenga el enlace', () => {
    expect(
      decidirRegistro({
        hayUsuarios: true,
        email: 'quiensea@ejemplo.es',
        invitacion: valida,
        ahora: AHORA,
      }),
    ).toMatchObject({ permitido: true })
  })

  it('no se lía con mayúsculas ni espacios en el correo', () => {
    expect(
      decidirRegistro({
        hayUsuarios: true,
        email: '  Berta@Ejemplo.ES ',
        invitacion: { ...valida, email: 'berta@ejemplo.es' },
        ahora: AHORA,
      }),
    ).toMatchObject({ permitido: true })
    expect(mismoCorreo(' A@B.es', 'a@b.ES ')).toBe(true)
  })

  it('una invitación anulada Y caducada se rechaza igual', () => {
    // El orden de las comprobaciones no puede dejar pasar a nadie por un
    // resquicio: lo importante es que el resultado sea «no».
    expect(
      decidirRegistro({
        hayUsuarios: true,
        email: 'berta@ejemplo.es',
        invitacion: { expiraEn: AYER, revocadaEn: AYER },
        ahora: AHORA,
      }).permitido,
    ).toBe(false)
  })
})
