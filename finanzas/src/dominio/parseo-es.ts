/**
 * Parseo de números en formato español, con detección heurística del separador
 * de millar. Es CRÍTICO para importar ficheros: "180.000" son ciento ochenta mil,
 * no 180,0. Ante la duda, se interpreta el punto como millar (criterio español).
 */

/**
 * Convierte un texto a número. Devuelve `null` si no es un número reconocible
 * (nunca inventa un valor: prefiere el hueco vacío).
 *
 * Reglas:
 *  - Se admiten € y espacios, que se ignoran.
 *  - Si hay coma, la coma es SIEMPRE el separador decimal y el punto es de millar.
 *  - Si solo hay puntos:
 *      · varios puntos            -> todos son de millar        ("1.234.567" = 1234567)
 *      · un punto con 3 decimales -> es de millar               ("180.000"   = 180000)
 *      · un punto seguido de 1,2 o 4+ dígitos -> es decimal      ("180.5" = 180,5; "1.2345" = 1.2345)
 */
export function parsearNumeroEs(entrada: string | number | null | undefined): number | null {
  if (entrada == null) return null
  if (typeof entrada === 'number') return Number.isFinite(entrada) ? entrada : null

  let s = entrada.trim()
  if (s === '') return null
  s = s.replace(/€/g, '').replace(/\s/g, '')

  // Signo
  let signo = 1
  if (/^-/.test(s)) {
    signo = -1
    s = s.slice(1)
  } else if (/^\+/.test(s)) {
    s = s.slice(1)
  }
  // Paréntesis contable: (1.234,56) = negativo
  if (/^\(.*\)$/.test(s)) {
    signo = -1
    s = s.slice(1, -1)
  }

  if (!/^[0-9.,]+$/.test(s)) return null

  const tieneComa = s.includes(',')
  const puntos = (s.match(/\./g) || []).length

  let normalizado: string
  if (tieneComa) {
    // La coma manda como decimal; los puntos son de millar.
    normalizado = s.replace(/\./g, '').replace(',', '.')
  } else if (puntos === 0) {
    normalizado = s
  } else if (puntos >= 2) {
    // Varios puntos => todos de millar.
    normalizado = s.replace(/\./g, '')
  } else {
    // Un único punto: decidir por el nº de dígitos tras él.
    const decimales = s.split('.')[1]
    if (decimales.length === 3) {
      normalizado = s.replace(/\./g, '') // millar: "180.000"
    } else {
      normalizado = s // decimal: "180.5", "1.2345"
    }
  }

  const n = Number(normalizado)
  return Number.isFinite(n) ? signo * n : null
}

/** Igual que parsearNumeroEs pero exige un número; lanza si no lo es. */
export function exigirNumeroEs(entrada: string | number, contexto = 'valor'): number {
  const n = parsearNumeroEs(entrada)
  if (n === null) throw new Error(`No se pudo leer ${contexto}: "${entrada}"`)
  return n
}
