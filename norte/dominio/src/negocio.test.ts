import { describe, expect, it } from 'vitest'
import { comprobarParticipaciones, cuentasDeSocios, ErrorNegocio } from './negocio.js'

const SOCIOS = [
  { usuarioId: 'ana', participacion: 60 },
  { usuarioId: 'luis', participacion: 40 },
]

describe('la cuenta corriente de cada socio', () => {
  it('aportado menos retirado, más lo que le toca del resultado', () => {
    const cuentas = cuentasDeSocios(
      SOCIOS,
      [
        { usuarioId: 'ana', tipo: 'aportacion', importe: 3_000_000 },
        { usuarioId: 'luis', tipo: 'aportacion', importe: 2_000_000 },
        { usuarioId: 'luis', tipo: 'retirada', importe: 500_000 },
      ],
      10_000_000,
    )

    expect(cuentas[0]).toEqual({
      usuarioId: 'ana', participacion: 60,
      aportado: 3_000_000, retirado: 0,
      beneficioAsignado: 6_000_000, beneficioCobrado: 0,
      saldo: 9_000_000,
    })
    expect(cuentas[1]).toEqual({
      usuarioId: 'luis', participacion: 40,
      aportado: 2_000_000, retirado: 500_000,
      beneficioAsignado: 4_000_000, beneficioCobrado: 0,
      saldo: 5_500_000,
    })
  })

  it('lo ya repartido en metálico deja de contar como pendiente', () => {
    const cuentas = cuentasDeSocios(
      SOCIOS,
      [{ usuarioId: 'ana', tipo: 'reparto_beneficios', importe: 6_000_000 }],
      10_000_000,
    )
    expect(cuentas[0]!.beneficioCobrado).toBe(6_000_000)
    expect(cuentas[0]!.saldo).toBe(0)
  })

  it('una pérdida se reparte igual que un beneficio', () => {
    const cuentas = cuentasDeSocios(SOCIOS, [], -1_000_000)
    expect(cuentas.map((c) => c.beneficioAsignado)).toEqual([-600_000, -400_000])
    expect(cuentas.map((c) => c.saldo)).toEqual([-600_000, -400_000])
  })

  it('el resultado se reparte al céntimo aunque no sea divisible', () => {
    const cuentas = cuentasDeSocios(
      [
        { usuarioId: 'ana', participacion: 100 / 3 },
        { usuarioId: 'luis', participacion: 100 / 3 },
        { usuarioId: 'sara', participacion: 100 / 3 },
      ],
      [],
      1_000,
    )
    expect(cuentas.reduce((t, c) => t + c.beneficioAsignado, 0)).toBe(1_000)
  })

  it('las participaciones tienen que sumar 100', () => {
    expect(() => comprobarParticipaciones([{ usuarioId: 'ana', participacion: 90 }])).toThrow(
      ErrorNegocio,
    )
    expect(() => comprobarParticipaciones(SOCIOS)).not.toThrow()
  })

  it('un negocio sin socios no es un negocio', () => {
    expect(() => comprobarParticipaciones([])).toThrow(/al menos un socio/i)
  })
})
