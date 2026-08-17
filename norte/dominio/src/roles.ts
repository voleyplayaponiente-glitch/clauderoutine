/**
 * Quién puede hacer qué dentro de un espacio.
 *
 * Vive en el dominio (puro y testeable) a propósito: es la regla de la que
 * cuelga la privacidad de toda la app, y no puede estar repartida en `if`s por
 * las rutas del servidor. El servidor pregunta aquí; aquí no se sabe qué es una
 * petición HTTP.
 */

export type Rol = 'propietario' | 'editor' | 'lector'

export const ROLES: readonly Rol[] = ['propietario', 'editor', 'lector'] as const

/** Mayor número = más permisos. */
const NIVEL: Record<Rol, number> = { lector: 1, editor: 2, propietario: 3 }

export function esRol(valor: unknown): valor is Rol {
  return typeof valor === 'string' && valor in NIVEL
}

/** ¿El rol llega al mínimo exigido? */
export function alcanza(rol: Rol, minimo: Rol): boolean {
  return NIVEL[rol] >= NIVEL[minimo]
}

export function puedeLeer(rol: Rol): boolean {
  return alcanza(rol, 'lector')
}

export function puedeEscribir(rol: Rol): boolean {
  return alcanza(rol, 'editor')
}

/** Invitar, expulsar, cambiar roles y borrar el espacio. */
export function puedeAdministrar(rol: Rol): boolean {
  return alcanza(rol, 'propietario')
}

/** Para los mensajes de la interfaz, en español y en minúscula. */
export function nombreDeRol(rol: Rol): string {
  return { propietario: 'propietario', editor: 'editor', lector: 'solo lectura' }[rol]
}
