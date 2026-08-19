import type { Centimos } from '../dinero.js'
import type { FechaISO } from '../fechas.js'

/**
 * Lo que sale de leer un extracto, sea cual sea el formato de origen. Todos los
 * lectores (hoja de cálculo, PDF, Norma 43) desembocan aquí, y de aquí en
 * adelante la app ya no sabe de dónde vino.
 */
export interface ApunteExtraido {
  fecha: FechaISO
  /** Fecha valor cuando el banco la distingue de la de operación. */
  fechaValor?: FechaISO
  concepto: string
  /** Céntimos. Negativo = sale dinero, igual que en el resto de la app. */
  importe: Centimos
  /** Saldo tras el apunte, si el extracto lo trae. Sirve para cuadrar. */
  saldo?: Centimos
  divisa: string
  /**
   * Huella estable del apunte. Es lo que impide que volver a subir un extracto
   * solapado duplique medio mes: se guarda como `idExterno` y la base de datos
   * tiene un índice único por (cuenta, idExterno).
   */
  huella: string
  /** Fila o línea del fichero de la que salió, para poder señalarla. */
  origen: number
  /** Últimos cuatro de la tarjeta que aparecía en el concepto, si había. */
  tarjeta?: string
}

export interface CuentaDelExtracto {
  titular?: string
  /** Solo los cuatro últimos. El IBAN completo no se guarda nunca. */
  ibanUltimos4?: string
  entidad?: string
  saldoFinal?: Centimos
  divisa?: string
}

export interface LecturaExtracto {
  apuntes: ApunteExtraido[]
  cuenta: CuentaDelExtracto
  desde?: FechaISO
  hasta?: FechaISO
  /**
   * Lo que el lector no ha sabido interpretar. Se enseña siempre: un lector que
   * se come tres líneas en silencio es peor que uno que no lee nada, porque el
   * total parece correcto.
   */
  avisos: string[]
}

/** Hash FNV-1a de 32 bits en hexadecimal. No es criptográfico y no lo necesita:
 *  solo tiene que ser corto, estable y el mismo en cualquier máquina. */
export function huellaTexto(texto: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

function normalizarConcepto(concepto: string): string {
  return concepto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * La huella de un apunte.
 *
 * Lleva un ordinal porque dos recargas iguales el mismo día son dos apuntes
 * distintos, y sin él la segunda se tomaría por un duplicado de la primera y
 * desaparecería. El ordinal se calcula por posición dentro del grupo de
 * repetidos, así que un extracto que solape con otro produce las mismas huellas
 * para los mismos movimientos.
 */
export function huellaApunte(
  apunte: { fecha: FechaISO; importe: Centimos; concepto: string },
  ordinal = 0,
): string {
  const base = `${apunte.fecha}|${apunte.importe}|${normalizarConcepto(apunte.concepto)}`
  return `extracto:${apunte.fecha}:${huellaTexto(base)}${ordinal > 0 ? `:${ordinal}` : ''}`
}

/** Rellena las huellas de una lista ya ordenada, numerando los repetidos. */
export function ponerHuellas<T extends { fecha: FechaISO; importe: Centimos; concepto: string }>(
  apuntes: T[],
): (T & { huella: string })[] {
  const vistos = new Map<string, number>()
  return apuntes.map((apunte) => {
    const sinOrdinal = huellaApunte(apunte)
    const veces = vistos.get(sinOrdinal) ?? 0
    vistos.set(sinOrdinal, veces + 1)
    return { ...apunte, huella: huellaApunte(apunte, veces) }
  })
}
