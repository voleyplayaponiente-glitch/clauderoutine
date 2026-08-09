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
  // Símbolo o código de moneda pegado al importe: «1.234,56 €», «15000 EUR».
  s = s.replace(/€/g, '').replace(/eur\b/gi, '').replace(/\s/g, '')

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

// ─────────────────── Importes de ficheros bancarios ───────────────────

/**
 * Convención de separadores de un fichero. Los bancos españoles no se ponen de
 * acuerdo: CaixaBank exporta el Excel en anglosajón (`3,000.00`) y el PDF de la
 * misma cuenta en español (`3.000,00`). Suponer una de las dos convierte tres
 * mil euros en tres, así que hay que deducirla del propio fichero.
 */
export type ConvencionNumerica = 'ES' | 'EN' | 'AUTO'

/** Quita €, espacios y el signo, dejando solo dígitos y separadores. */
function nucleoNumerico(entrada: string): { cuerpo: string; signo: number } | null {
  let s = (entrada ?? '').trim()
  if (s === '') return null
  // Símbolo o código de moneda pegado al importe: «1.234,56 €», «15000 EUR».
  s = s.replace(/€/g, '').replace(/eur\b/gi, '').replace(/\s/g, '')

  let signo = 1
  if (/^-/.test(s)) {
    signo = -1
    s = s.slice(1)
  } else if (/^\+/.test(s)) {
    s = s.slice(1)
  }
  if (/^\(.*\)$/.test(s)) {
    signo = -1
    s = s.slice(1, -1)
  }
  if (!/^[0-9.,]+$/.test(s) || !/[0-9]/.test(s)) return null
  return { cuerpo: s, signo }
}

/**
 * Deduce la convención mirando los valores que traen los DOS separadores: en
 * ellos el que va más a la derecha es el decimal, sin ambigüedad posible.
 * Devuelve 'AUTO' si el fichero no da ninguna pista.
 */
export function detectarConvencionNumerica(valores: (string | number | null | undefined)[]): ConvencionNumerica {
  let es = 0
  let en = 0
  for (const v of valores) {
    if (typeof v !== 'string') continue
    const n = nucleoNumerico(v)
    if (!n) continue
    const ultimaComa = n.cuerpo.lastIndexOf(',')
    const ultimoPunto = n.cuerpo.lastIndexOf('.')
    if (ultimaComa === -1 || ultimoPunto === -1) continue
    if (ultimaComa > ultimoPunto) es++
    else en++
  }
  if (es === 0 && en === 0) return 'AUTO'
  return es >= en ? 'ES' : 'EN'
}

/**
 * Parsea un importe de extracto bancario. Admite el signo separado del número
 * (`- 30,00 €`), paréntesis contables y el símbolo del euro.
 *
 * Con los dos separadores presentes no hay duda: manda el de más a la derecha.
 * Con uno solo se aplica la convención indicada y, si no se conoce, la
 * heurística española de `parsearNumeroEs`.
 */
export function parsearImporte(entrada: string | number | null | undefined, convencion: ConvencionNumerica = 'AUTO'): number | null {
  if (entrada == null) return null
  if (typeof entrada === 'number') return Number.isFinite(entrada) ? entrada : null

  const n = nucleoNumerico(entrada)
  if (!n) return null
  const { cuerpo, signo } = n

  const ultimaComa = cuerpo.lastIndexOf(',')
  const ultimoPunto = cuerpo.lastIndexOf('.')

  let normalizado: string
  if (ultimaComa !== -1 && ultimoPunto !== -1) {
    // Los dos: el de la derecha es el decimal.
    const decimal = ultimaComa > ultimoPunto ? ',' : '.'
    const millar = decimal === ',' ? '.' : ','
    normalizado = cuerpo.split(millar).join('').replace(decimal, '.')
  } else if (convencion === 'EN') {
    // El punto es decimal y la coma de millar.
    normalizado = cuerpo.split(',').join('')
  } else if (convencion === 'ES') {
    normalizado = cuerpo.split('.').join('').replace(',', '.')
  } else {
    return parsearNumeroEs(entrada)
  }

  const valor = Number(normalizado)
  return Number.isFinite(valor) ? signo * valor : null
}
