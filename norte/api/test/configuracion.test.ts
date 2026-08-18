import { describe, expect, it } from 'vitest'
import { componerUrl, leerConfiguracion } from '../src/configuracion.js'

const BASE = {
  NORTE_SECRETO_SESION: 'un secreto suficientemente largo para pasar 0123456789',
}

describe('conexión a la base de datos', () => {
  it('respeta DATABASE_URL si viene', () => {
    expect(componerUrl({ DATABASE_URL: 'postgresql://x@y:5432/z', NORTE_BD_PUERTO: 5432 })).toBe(
      'postgresql://x@y:5432/z',
    )
  })

  it('compone la URL a partir de las piezas', () => {
    expect(
      componerUrl({
        NORTE_BD_HOST: 'db',
        NORTE_BD_PUERTO: 5432,
        NORTE_BD_USUARIO: 'norte',
        NORTE_BD_CONTRASENA: 'sencilla',
        NORTE_BD_NOMBRE: 'norte',
      }),
    ).toBe('postgresql://norte:sencilla@db:5432/norte')
  })

  it('escapa la contraseña, que es para lo que existe', () => {
    // Umbrel genera la contraseña por su cuenta. Con una `@` sin escapar, la
    // URL se parte por el sitio equivocado y el servidor no arranca.
    const url = componerUrl({
      NORTE_BD_HOST: 'db',
      NORTE_BD_PUERTO: 5432,
      NORTE_BD_USUARIO: 'norte',
      NORTE_BD_CONTRASENA: 'a@b/c:d#e',
      NORTE_BD_NOMBRE: 'norte',
    })
    expect(url).toBe('postgresql://norte:a%40b%2Fc%3Ad%23e@db:5432/norte')
    // Y la URL resultante se puede analizar sin perder nada.
    const analizada = new URL(url!)
    expect(analizada.hostname).toBe('db')
    expect(decodeURIComponent(analizada.password)).toBe('a@b/c:d#e')
  })

  it('sin conexión de ninguna de las dos formas, no arranca y lo dice', () => {
    expect(componerUrl({ NORTE_BD_PUERTO: 5432 })).toBeNull()
    expect(() => leerConfiguracion({ ...BASE } as NodeJS.ProcessEnv)).toThrow(/PostgreSQL/)
  })

  it('avisa si falta el secreto de sesión en vez de arrancar a medias', () => {
    expect(() =>
      leerConfiguracion({ DATABASE_URL: 'postgresql://x@y/z', NORTE_SECRETO_SESION: 'corto' } as NodeJS.ProcessEnv),
    ).toThrow(/32 caracteres/)
  })
})
