/**
 * Enmascarar lo que no debe guardarse.
 *
 * Esto no es una precaución teórica: el primer extracto real que se usó para
 * escribir este lector traía el **número de tarjeta completo** metido dentro
 * del concepto de cada recarga («Recarga de tarjetas prepago 4532…0445»). Si el
 * lector copiase el concepto tal cual a la base de datos, Norte estaría
 * guardando PAN completos sin que nadie lo hubiera decidido.
 *
 * La regla del proyecto es que de una tarjeta solo se guardan alias y últimos
 * cuatro; aquí se cumple **en el punto de entrada**, antes de que el texto
 * llegue a ninguna tabla.
 *
 * El fichero original sí se conserva entero en el servidor del usuario: es su
 * extracto, en su máquina, y es lo que permite volver a leerlo si mañana el
 * lector mejora. Lo que se enmascara es lo que se copia a la base de datos y se
 * enseña en pantalla.
 */

/** IBAN: dos letras, dos dígitos de control y de 11 a 30 alfanuméricos. */
const PATRON_IBAN = /\b[A-Z]{2}\d{2}(?:[ -]?[A-Z0-9]){11,30}\b/g
/** Una tarjeta escrita del tirón: 13 a 19 dígitos seguidos. */
const PATRON_SEGUIDA = /\d{13,19}/g
/** Una tarjeta escrita en grupos de cuatro: «4532 0300 0413 0445». */
const PATRON_AGRUPADA = /\b\d{4}(?:[ -]\d{4}){2,3}(?:[ -]\d{1,3})?\b/g

/** Luhn. Sin esto, un «Adeudo nº 2026215000596874» acabaría censurado como si
 *  fuera una tarjeta, y el concepto quedaría inservible. */
export function pasaLuhn(digitos: string): boolean {
  let suma = 0
  let doble = false
  for (let i = digitos.length - 1; i >= 0; i--) {
    let d = digitos.charCodeAt(i) - 48
    if (d < 0 || d > 9) return false
    if (doble) {
      d *= 2
      if (d > 9) d -= 9
    }
    suma += d
    doble = !doble
  }
  return suma % 10 === 0
}

export function ultimos4(numero: string): string {
  const digitos = numero.replace(/\D/g, '')
  return digitos.slice(-4)
}

/** ¿Esta ristra de dígitos parece una tarjeta de verdad? */
export function pareceTarjeta(texto: string): boolean {
  const digitos = texto.replace(/\D/g, '')
  if (digitos.length < 13 || digitos.length > 19) return false
  if (!'3456'.includes(digitos[0]!)) return false
  return pasaLuhn(digitos)
}

/**
 * Sustituye tarjetas e IBAN por su forma corta. Devuelve también lo que ha
 * encontrado, porque saber «esto es de la tarjeta acabada en 0445» sirve para
 * proponer la cuenta correcta en la pantalla de revisión.
 */
export function enmascararSensibles(texto: string): {
  texto: string
  tarjetas: string[]
  ibanes: string[]
} {
  const tarjetas: string[] = []
  const ibanes: string[] = []

  let salida = texto.replace(PATRON_IBAN, (coincidencia) => {
    const limpio = coincidencia.replace(/[ -]/g, '')
    // Un IBAN español son 24 caracteres. Fuera de las longitudes válidas (15 a
    // 34) es otra cosa que empieza por dos letras y no hay que tocarla.
    if (limpio.length < 15 || limpio.length > 34) return coincidencia
    const cuatro = limpio.slice(-4)
    ibanes.push(cuatro)
    return `${limpio.slice(0, 2)}** **** ${cuatro}`
  })

  // Dos pasadas y no una expresión que lo abarque todo: un patrón goloso que
  // admita separadores se come «4532015112830366 01827013 716» entero, falla
  // Luhn sobre el conjunto y deja la tarjeta sin tapar justo donde estaba.
  for (const patron of [PATRON_AGRUPADA, PATRON_SEGUIDA]) {
    salida = salida.replace(patron, (coincidencia) => {
      if (!pareceTarjeta(coincidencia)) return coincidencia
      const cuatro = ultimos4(coincidencia)
      tarjetas.push(cuatro)
      return `**** ${cuatro}`
    })
  }

  return { texto: salida, tarjetas, ibanes }
}

/** El IBAN que aparezca en la cabecera de un extracto, en corto. */
export function buscarIban(texto: string): string | null {
  const encontrados = texto.match(PATRON_IBAN)
  if (!encontrados) return null
  for (const bruto of encontrados) {
    const limpio = bruto.replace(/[ -]/g, '')
    if (limpio.length >= 15 && limpio.length <= 34) return limpio
  }
  return null
}
