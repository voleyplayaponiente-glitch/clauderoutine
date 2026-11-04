import { describe, it, expect } from 'vitest'
import { marcarCambio, marcarSubida, marcarError, descartarCambio, empresasPorSubir, marcarNuncaSubidas, retrasoCopias } from './copias-pendientes'

const T = (h: string) => `2026-11-04T${h}:00.000Z`

describe('copias pendientes de subir', () => {
  it('el cambio guarda el MÁS ANTIGUO, que es el que mide el retraso', () => {
    let e = marcarCambio({}, 'a', T('10:00'))
    e = marcarCambio(e, 'a', T('11:00'))
    expect(e.a.cambio).toBe(T('10:00'))
  })

  it('una subida borra la marca solo si nada cambió después de leer los datos', () => {
    const e = marcarCambio({}, 'a', T('10:00'))
    expect(marcarSubida(e, 'a', T('10:05'), T('10:06'), T('10:00')).a).toEqual({ subida: T('10:06') })
    // Cambio a las 10:07, con la subida ya en marcha desde las 10:05: sigue pendiente.
    expect(marcarSubida(e, 'a', T('10:05'), T('10:06'), T('10:07')).a.cambio).toBe(T('10:00'))
  })

  it('un fallo deja la marca y apunta el motivo; la subida buena lo limpia', () => {
    let e = marcarError(marcarCambio({}, 'a', T('10:00')), 'a', 'Failed to fetch')
    expect(e.a).toEqual({ cambio: T('10:00'), error: 'Failed to fetch' })
    e = marcarSubida(e, 'a', T('10:10'), T('10:11'))
    expect(e.a.error).toBeUndefined()
    expect(e.a.cambio).toBeUndefined()
  })

  it('solo se suben empresas que existen, la más atrasada primero', () => {
    let e = marcarCambio({}, 'b', T('11:00'))
    e = marcarCambio(e, 'a', T('10:00'))
    e = marcarCambio(e, 'borrada', T('09:00'))
    expect(empresasPorSubir(e, ['a', 'b'])).toEqual(['a', 'b'])
  })

  it('los datos que nunca se han subido se marcan; los ya subidos no', () => {
    const e = marcarNuncaSubidas({ b: { subida: T('09:00') } }, ['a', 'b'], T('10:00'))
    expect(e.a.cambio).toBe(T('10:00'))
    expect(e.b.cambio).toBeUndefined()
  })

  it('descartar quita la marca de una empresa vacía', () => {
    expect(descartarCambio(marcarCambio({}, 'a', T('10:00')), 'a').a).toEqual({})
  })

  it('retraso: un cambio reciente no es alarma; uno de hace más de una hora, o con fallo, sí', () => {
    const e = marcarCambio({}, 'a', T('10:00'))
    expect(retrasoCopias(e, ['a'], T('10:30'))).toBeUndefined()
    expect(retrasoCopias(e, ['a'], T('11:30'))).toEqual({ empresas: ['a'], desde: T('10:00') })
    expect(retrasoCopias(marcarError(e, 'a', 'No autorizado'), ['a'], T('10:01'))?.error).toBe('No autorizado')
  })
})
