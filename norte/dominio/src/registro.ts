/**
 * Quién puede crearse una cuenta en esta instalación.
 *
 * Hasta ahora el registro estaba abierto: cualquiera que llegase a la
 * dirección del servidor podía crearse una cuenta. No veía datos ajenos —el
 * aislamiento entre espacios está probado— pero sobra, y en una app que además
 * se vende para autoalojar es de las primeras cosas que mira quien la instala.
 *
 * La regla es la clásica de las apps autoalojadas, y es la que menos
 * configuración pide: **la primera cuenta es libre** (quien instala, manda) y a
 * partir de ahí **hace falta invitación**. Sin panel de ajustes, sin un
 * interruptor que alguien pueda dejar abierto sin darse cuenta.
 */

export type MotivoRechazo =
  | 'cerrado'
  | 'invitacion_desconocida'
  | 'invitacion_caducada'
  | 'invitacion_usada'
  | 'invitacion_revocada'
  | 'correo_no_coincide'

export interface EstadoInvitacion {
  /** Si viene, la invitación es para esa persona y solo para ella. Si no,
   *  vale para quien tenga el enlace (un solo uso y con caducidad). */
  email?: string | null
  expiraEn: Date
  aceptadaEn?: Date | null
  revocadaEn?: Date | null
}

export type DecisionRegistro =
  | { permitido: true; primeraCuenta: boolean }
  | { permitido: false; motivo: MotivoRechazo; mensaje: string }

export function decidirRegistro(datos: {
  hayUsuarios: boolean
  email: string
  invitacion?: EstadoInvitacion | null
  ahora: Date
}): DecisionRegistro {
  // Instalación recién estrenada: quien llega primero es el dueño. Es el único
  // momento en que se puede entrar sin que nadie te abra la puerta.
  if (!datos.hayUsuarios) return { permitido: true, primeraCuenta: true }

  const invitacion = datos.invitacion
  if (!invitacion) {
    return {
      permitido: false,
      motivo: 'cerrado',
      mensaje:
        'Esta instalación de Norte no admite registros abiertos. Pide a quien la administra que te envíe una invitación.',
    }
  }
  if (invitacion.revocadaEn) {
    return {
      permitido: false,
      motivo: 'invitacion_revocada',
      mensaje: 'Esa invitación se anuló. Pide una nueva a quien te la envió.',
    }
  }
  if (invitacion.aceptadaEn) {
    return {
      permitido: false,
      motivo: 'invitacion_usada',
      // Una invitación es de un solo uso: si no, el enlace reenviado a un grupo
      // de WhatsApp se convierte en un registro abierto con pasos extra.
      mensaje: 'Esa invitación ya se usó. Si eres tú, entra con tu cuenta.',
    }
  }
  if (invitacion.expiraEn.getTime() <= datos.ahora.getTime()) {
    return {
      permitido: false,
      motivo: 'invitacion_caducada',
      mensaje: 'Esa invitación ha caducado. Pide una nueva a quien te la envió.',
    }
  }
  if (invitacion.email && !mismoCorreo(invitacion.email, datos.email)) {
    return {
      permitido: false,
      motivo: 'correo_no_coincide',
      mensaje: `Esa invitación es para ${invitacion.email}. Regístrate con ese correo o pide una invitación nueva.`,
    }
  }
  return { permitido: true, primeraCuenta: false }
}

export function mismoCorreo(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

/** Cuánto dura una invitación desde que se crea. Una semana: lo bastante para
 *  que a alguien le dé tiempo a verla, lo bastante poco para que un enlace
 *  olvidado en un chat no siga abriendo la puerta dentro de un año. */
export const DIAS_INVITACION = 7
