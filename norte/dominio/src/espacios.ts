/**
 * Espacios: la frontera de privacidad de la aplicación.
 *
 * Un espacio es un ámbito financiero (`personal`, `pareja`, `negocio`). La
 * promesa que le hacemos al usuario —«tu pareja ve lo compartido y nada más»—
 * se sostiene entera sobre las funciones de este fichero, así que la decisión
 * se toma **aquí, en código puro y con tests**, y no repartida por las rutas
 * del servidor donde nadie puede comprobarla de un vistazo.
 */

import type { Rol } from './roles.js'
import { alcanza } from './roles.js'

export type TipoEspacio = 'personal' | 'pareja' | 'negocio'

export const TIPOS_ESPACIO: readonly TipoEspacio[] = ['personal', 'pareja', 'negocio'] as const

export function esTipoEspacio(valor: unknown): valor is TipoEspacio {
  return typeof valor === 'string' && (TIPOS_ESPACIO as readonly string[]).includes(valor)
}

export interface Membresia {
  usuarioId: string
  espacioId: string
  rol: Rol
}

export type MotivoDenegado = 'no_encontrado' | 'sin_permiso'

export type Acceso =
  | { permitido: true; rol: Rol }
  | { permitido: false; motivo: MotivoDenegado; mensaje: string }

/**
 * ¿Puede este usuario tocar este espacio?
 *
 * Detalle que importa y no es paranoia: a quien **no es miembro** se le
 * responde `no_encontrado`, no «sin permiso». Distinguir las dos cosas le diría
 * a un extraño qué espacios existen, y con eso ya se puede ir tirando del hilo.
 * A un miembro con rol insuficiente sí se le dice la verdad: es su espacio y
 * necesita entender por qué no puede escribir.
 */
export function decidirAcceso(
  membresia: Membresia | null | undefined,
  exige: { espacioId: string; rolMinimo: Rol },
): Acceso {
  if (!membresia || membresia.espacioId !== exige.espacioId) {
    return {
      permitido: false,
      motivo: 'no_encontrado',
      mensaje: 'Ese espacio no existe o no tienes acceso.',
    }
  }
  if (!alcanza(membresia.rol, exige.rolMinimo)) {
    return {
      permitido: false,
      motivo: 'sin_permiso',
      mensaje:
        membresia.rol === 'lector'
          ? 'Tienes acceso de solo lectura en este espacio.'
          : 'Solo el propietario del espacio puede hacer esto.',
    }
  }
  return { permitido: true, rol: membresia.rol }
}

export interface CuentaVisible {
  propietarioId: string
  visibleEnEspacio: boolean
}

/**
 * Privacidad dentro de un espacio compartido: una cuenta marcada como no
 * visible **solo la ve quien la creó**, aunque el otro sea propietario del
 * espacio. Es el principio 5 del producto, y es la razón por la que alguien se
 * atreve a meter aquí su cuenta personal.
 */
export function esCuentaVisiblePara(cuenta: CuentaVisible, usuarioId: string): boolean {
  return cuenta.visibleEnEspacio || cuenta.propietarioId === usuarioId
}

/** Un espacio personal no admite invitados. Se comprueba al invitar. */
export function admiteMiembros(tipo: TipoEspacio): boolean {
  return tipo !== 'personal'
}
