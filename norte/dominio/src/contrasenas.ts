/**
 * Política de contraseñas.
 *
 * Deliberadamente corta: exigir mayúscula, número y símbolo empuja a la gente a
 * `Madrid2024!` —que es de las primeras que prueba cualquier ataque— y a
 * apuntarla en un papel. Lo que de verdad protege es la longitud y no repetir
 * una contraseña famosa, así que es lo único que se exige.
 */

export interface ResultadoContrasena {
  valida: boolean
  /** Mensaje en español que se le enseña tal cual al usuario. */
  mensaje?: string
}

export const LONGITUD_MINIMA = 10

/** Las que aparecen en cualquier lista de filtradas; no pretende ser exhaustiva. */
const DEMASIADO_COMUNES = new Set([
  '1234567890',
  'contrasena',
  'contraseña',
  'password',
  'password1',
  'qwertyuiop',
  'administrador',
  '12345678910',
  'iloveyou123',
])

export function evaluarContrasena(contrasena: string, datosDelUsuario: string[] = []): ResultadoContrasena {
  if (typeof contrasena !== 'string' || contrasena.length === 0) {
    return { valida: false, mensaje: 'Escribe una contraseña.' }
  }
  if (contrasena.length < LONGITUD_MINIMA) {
    return {
      valida: false,
      mensaje: `La contraseña necesita al menos ${LONGITUD_MINIMA} caracteres. Una frase que recuerdes vale más que un símbolo raro.`,
    }
  }
  if (contrasena.length > 200) {
    return { valida: false, mensaje: 'La contraseña no puede pasar de 200 caracteres.' }
  }
  const normalizada = contrasena.toLowerCase().trim()
  if (DEMASIADO_COMUNES.has(normalizada)) {
    return { valida: false, mensaje: 'Esa contraseña está en todas las listas. Elige otra.' }
  }
  // Usar el propio correo o el nombre como contraseña es sorprendentemente común.
  for (const dato of datosDelUsuario) {
    const limpio = dato?.toLowerCase().trim()
    if (limpio && limpio.length >= 4 && normalizada.includes(limpio)) {
      return {
        valida: false,
        mensaje: 'La contraseña no puede contener tu nombre ni tu correo.',
      }
    }
  }
  return { valida: true }
}
