import { hash, verify } from '@node-rs/argon2'

/**
 * Hash de contraseñas con **Argon2id**, que es el algoritmo recomendado hoy
 * (OWASP) frente a bcrypt: penaliza tanto a las GPU como a los ASIC porque el
 * coste es de memoria, no solo de CPU.
 *
 * Los parámetros son los mínimos que recomienda OWASP para Argon2id: 19 MiB de
 * memoria, 2 iteraciones y 1 hilo. Bajarlos «porque el Umbrel es modesto» sería
 * ahorrar 40 ms al entrar a costa de abaratarle el trabajo a quien robe la base
 * de datos.
 */
const PARAMETROS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const
// El algoritmo no se pasa explícitamente porque `Algorithm` de @node-rs/argon2
// es un `const enum` y no se puede importar con `verbatimModuleSyntax`. Su
// valor por defecto ya es Argon2id, y hay un test que comprueba que el hash
// guardado empieza por `$argon2id$` — que es la garantía que importa.

export function cifrarContrasena(contrasena: string): Promise<string> {
  return hash(contrasena, PARAMETROS)
}

export async function comprobarContrasena(hashGuardado: string, contrasena: string): Promise<boolean> {
  try {
    return await verify(hashGuardado, contrasena, PARAMETROS)
  } catch {
    // Un hash corrupto o de otro formato no debe tumbar el login: es un «no».
    return false
  }
}
