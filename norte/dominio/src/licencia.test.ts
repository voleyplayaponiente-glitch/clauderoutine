import { describe, expect, it } from 'vitest'
import {
  decidirLicencia,
  HEREDADOS_HASTA,
  puedeEscribirConLicencia,
  type CargaLicencia,
} from './licencia.js'

const AHORA = new Date('2026-08-19T12:00:00.000Z')

/** Alguien que se dio de alta hoy: cuenta para el cupo. */
const nuevo = (id: string) => ({ id, creadoEn: '2026-09-01' })
/** Alguien que ya estaba antes de que existieran las licencias. */
const antiguo = (id: string) => ({ id, creadoEn: '2026-08-01' })

const licencia = (extra: Partial<CargaLicencia> = {}): CargaLicencia => ({
  id: 'lic_1',
  plan: 'pareja',
  titular: 'Julio',
  emitidaEn: '2026-01-01',
  caducaEn: '2027-01-01',
  maxUsuarios: 2,
  ...extra,
})

describe('sin licencia', () => {
  it('una persona usa Norte entero, para siempre', () => {
    const estado = decidirLicencia(null, { usuarios: [nuevo('dueno')], ahora: AHORA })
    expect(estado.valida).toBe(false)
    expect(estado.salud).toBe('ok')
    expect(estado.soloLectura).toEqual([])
    expect(estado.titulo).toBe('Instalación personal')
  })

  it('el segundo en entrar pasa a solo lectura, y NUNCA el dueño', () => {
    const estado = decidirLicencia(null, { usuarios: [nuevo('dueno'), nuevo('marta')], ahora: AHORA })
    expect(estado.soloLectura).toEqual(['marta'])
    expect(puedeEscribirConLicencia(estado, 'dueno')).toBe(true)
    expect(puedeEscribirConLicencia(estado, 'marta')).toBe(false)
    expect(estado.salud).toBe('mal')
  })
})

describe('con licencia en vigor', () => {
  it('el cupo lo pone la licencia', () => {
    const estado = decidirLicencia(licencia({ maxUsuarios: 3 }), {
      usuarios: [nuevo('dueno'), nuevo('marta'), nuevo('luis')],
      ahora: AHORA,
    })
    expect(estado.valida).toBe(true)
    expect(estado.soloLectura).toEqual([])
    expect(estado.salud).toBe('ok')
    expect(estado.plan).toBe('pareja')
  })

  it('quien pasa del cupo es el último en entrar', () => {
    const estado = decidirLicencia(licencia({ maxUsuarios: 2 }), {
      usuarios: [nuevo('dueno'), nuevo('marta'), nuevo('luis')],
      ahora: AHORA,
    })
    expect(estado.soloLectura).toEqual(['luis'])
  })

  it('avisa cuando quedan menos de 30 días, sin dar la lata antes', () => {
    const pronto = decidirLicencia(licencia({ caducaEn: '2026-09-01' }), {
      usuarios: [nuevo('dueno')],
      ahora: AHORA,
    })
    expect(pronto.salud).toBe('aviso')
    expect(pronto.diasRestantes).toBe(13)

    const lejos = decidirLicencia(licencia({ caducaEn: '2027-01-01' }), {
      usuarios: [nuevo('dueno')],
      ahora: AHORA,
    })
    expect(lejos.salud).toBe('ok')
    expect(lejos.diasRestantes).toBe(135)
  })

  it('una licencia perpetua no cuenta días', () => {
    const estado = decidirLicencia(licencia({ caducaEn: null }), {
      usuarios: [nuevo('dueno')],
      ahora: AHORA,
    })
    expect(estado.diasRestantes).toBeNull()
    expect(estado.detalle).toMatch(/sin caducidad/i)
  })
})

describe('cuando caduca', () => {
  it('NO cierra la puerta: el cupo vuelve a una persona y nadie pierde datos', () => {
    const estado = decidirLicencia(licencia({ caducaEn: '2026-08-18' }), {
      usuarios: [nuevo('dueno')],
      ahora: AHORA,
    })
    expect(estado.valida).toBe(false)
    expect(estado.soloLectura).toEqual([])
    expect(puedeEscribirConLicencia(estado, 'dueno')).toBe(true)
    expect(estado.titulo).toBe('Licencia caducada')
  })

  it('con dos personas, la segunda pasa a solo lectura y se explica que no se ha borrado nada', () => {
    const estado = decidirLicencia(licencia({ caducaEn: '2026-08-18' }), {
      usuarios: [nuevo('dueno'), nuevo('marta')],
      ahora: AHORA,
    })
    expect(estado.soloLectura).toEqual(['marta'])
    expect(estado.detalle).toMatch(/nadie ha perdido el acceso ni un solo dato/i)
    expect(estado.detalle).toMatch(/leer y exportar/i)
  })

  it('el día exacto de caducidad todavía vale', () => {
    const estado = decidirLicencia(licencia({ caducaEn: '2026-08-19' }), {
      usuarios: [nuevo('dueno'), nuevo('marta')],
      ahora: AHORA,
    })
    expect(estado.valida).toBe(true)
    expect(estado.soloLectura).toEqual([])
  })
})

describe('quien ya estaba antes de que hubiera licencias', () => {
  it('no cuenta para el cupo, ni siquiera con la licencia caducada', () => {
    const estado = decidirLicencia(licencia({ caducaEn: '2026-08-18' }), {
      usuarios: [antiguo('julio'), antiguo('marta')],
      ahora: AHORA,
    })
    expect(estado.soloLectura).toEqual([])
    expect(puedeEscribirConLicencia(estado, 'marta')).toBe(true)
  })

  it('la tarjeta no dice «gratis para una persona» cuando ya sois dos', () => {
    const estado = decidirLicencia(null, {
      usuarios: [antiguo('julio'), antiguo('marta')],
      ahora: AHORA,
    })
    expect(estado.heredados).toBe(2)
    expect(estado.detalle).toMatch(/Sois 2/)
    expect(estado.detalle).not.toMatch(/para una persona/)
  })

  it('los heredados no le gastan el hueco gratis a quien llega después', () => {
    const estado = decidirLicencia(null, {
      usuarios: [antiguo('julio'), antiguo('marta'), nuevo('luis'), nuevo('sara')],
      ahora: AHORA,
    })
    // Luis coge el hueco gratis; Sara es la única que se queda sin escribir.
    expect(estado.soloLectura).toEqual(['sara'])
  })

  it('la frontera de anterioridad no se mueve sin querer', () => {
    // Si alguien cambia esta fecha, clientes que ya pagaban con su uso pasarían
    // a solo lectura de un despliegue para otro.
    expect(HEREDADOS_HASTA).toBe('2026-08-20')
  })
})
