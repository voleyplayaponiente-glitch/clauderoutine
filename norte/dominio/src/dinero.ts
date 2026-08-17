/**
 * Dinero. La regla número uno del proyecto: **todo importe es un entero de
 * céntimos**. Ni un `float` en toda la aplicación, ni siquiera «solo para
 * mostrar»: un 0,1 + 0,2 = 0,30000000000000004 en una suma de gastos es un
 * descuadre esperando su turno, y esta app no puede permitirse mentir.
 */

/** Importe en céntimos. Siempre entero; negativo = salida de dinero. */
export type Centimos = number

/** Tope seguro: 90.071.992.547.409,91 € en céntimos. Muy por encima de cualquier
 *  patrimonio personal, pero se comprueba igual: un desbordamiento silencioso
 *  es peor que un error. */
const MAXIMO = Number.MAX_SAFE_INTEGER

export class ErrorDinero extends Error {}

/** Valida que un número sea un importe en céntimos utilizable. */
export function comprobarCentimos(valor: number): Centimos {
  if (!Number.isFinite(valor)) throw new ErrorDinero('El importe no es un número')
  if (!Number.isInteger(valor)) {
    throw new ErrorDinero(`El importe debe estar en céntimos enteros, llegó ${valor}`)
  }
  if (Math.abs(valor) > MAXIMO) throw new ErrorDinero('El importe se sale de rango')
  return valor
}

/** Euros (número o texto ya limpio) → céntimos. Redondeo al céntimo más cercano. */
export function aCentimos(euros: number): Centimos {
  if (!Number.isFinite(euros)) throw new ErrorDinero('El importe no es un número')
  // Math.round(x * 100) falla en casos como 1,005 por la representación binaria;
  // el epsilon lo empuja al lado correcto sin afectar a los importes normales.
  const centimos = Math.round((euros + Number.EPSILON * Math.sign(euros)) * 100)
  return comprobarCentimos(centimos)
}

/** Céntimos → euros. Solo para mostrar o exportar; nunca para calcular. */
export function aEuros(centimos: Centimos): number {
  return comprobarCentimos(centimos) / 100
}

export function sumar(...importes: Centimos[]): Centimos {
  return comprobarCentimos(importes.reduce((total, i) => total + comprobarCentimos(i), 0))
}

export function restar(a: Centimos, b: Centimos): Centimos {
  return comprobarCentimos(comprobarCentimos(a) - comprobarCentimos(b))
}

export function negar(a: Centimos): Centimos {
  return comprobarCentimos(-comprobarCentimos(a))
}

/** Un porcentaje de un importe, redondeado al céntimo. `porcentaje(10000, 21)` → 2100. */
export function porcentaje(importe: Centimos, tantoPorCiento: number): Centimos {
  comprobarCentimos(importe)
  if (!Number.isFinite(tantoPorCiento)) throw new ErrorDinero('El porcentaje no es un número')
  return comprobarCentimos(Math.round((importe * tantoPorCiento) / 100))
}

/**
 * Reparte un importe entre varios pesos **sin perder ni inventarse un céntimo**.
 *
 * Es la pieza que sostiene los gastos compartidos: repartir 10 € entre 3 da
 * 3,33 + 3,33 + 3,33 = 9,99 y el céntimo que falta tiene que ir a alguien. Se
 * usa el método del resto mayor (a quien más parte decimal le tocaba), y en
 * caso de empate al primero, para que el resultado sea siempre el mismo con
 * las mismas entradas — una liquidación no puede cambiar entre dos pantallas.
 */
export function repartir(total: Centimos, pesos: number[]): Centimos[] {
  comprobarCentimos(total)
  if (pesos.length === 0) throw new ErrorDinero('Hay que repartir entre alguien')
  if (pesos.some((p) => !Number.isFinite(p) || p < 0)) {
    throw new ErrorDinero('Los pesos del reparto no pueden ser negativos')
  }
  const suma = pesos.reduce((a, b) => a + b, 0)
  if (suma <= 0) throw new ErrorDinero('Los pesos del reparto suman cero')

  const exactos = pesos.map((p) => (total * p) / suma)
  // Trunca hacia cero para que el reparto de un importe negativo (una devolución
  // compartida) se comporte igual que el de uno positivo.
  const base = exactos.map((e) => Math.trunc(e))
  let resto = total - base.reduce((a, b) => a + b, 0)

  const orden = exactos
    .map((e, i) => ({ i, resto: Math.abs(e - Math.trunc(e)) }))
    .sort((a, b) => b.resto - a.resto || a.i - b.i)

  const paso = resto >= 0 ? 1 : -1
  for (let k = 0; resto !== 0; k++) {
    base[orden[k % orden.length].i] += paso
    resto -= paso
  }
  return base
}

const FORMATO = new Map<string, Intl.NumberFormat>()

/** El único formateador de dinero de la aplicación. Nadie escribe `€` a mano. */
export function formatearDinero(
  centimos: Centimos,
  opciones: { divisa?: string; conSigno?: boolean; sinDecimales?: boolean } = {},
): string {
  comprobarCentimos(centimos)
  const divisa = opciones.divisa ?? 'EUR'
  const clave = `${divisa}|${opciones.sinDecimales ? 0 : 2}`
  let formato = FORMATO.get(clave)
  if (!formato) {
    formato = new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: divisa,
      minimumFractionDigits: opciones.sinDecimales ? 0 : 2,
      maximumFractionDigits: opciones.sinDecimales ? 0 : 2,
      // El español no separa los millares en los números de cuatro cifras
      // («1234,56 €»), y es correcto según la RAE. Aquí se fuerza igualmente:
      // en una columna de importes alineados a la derecha, que unas cifras
      // lleven punto y otras no hace que los números bailen justo donde el
      // diseño promete que no lo harán.
      useGrouping: 'always',
    })
    FORMATO.set(clave, formato)
  }
  const texto = formato.format(aEuros(centimos))
  // El «+» solo cuando se pide: en una variación de patrimonio importa, en un
  // saldo normal es ruido.
  return opciones.conSigno && centimos > 0 ? `+${texto}` : texto
}

/**
 * Lee un importe escrito por una persona o sacado de un extracto: «1.234,56»,
 * «1234.56», «3,40 €», «-12,00», «(45,00)», «180.000».
 *
 * La heurística del punto es la que más cuesta y la que más se agradece: en
 * España `180.000` son ciento ochenta mil, no ciento ochenta con cero céntimos.
 * Devuelve `null` si no hay forma de leerlo — inventarse un número aquí sería
 * exactamente el tipo de mentira que la app no se permite.
 */
export function parsearImporte(texto: string): Centimos | null {
  if (typeof texto !== 'string') return null
  let limpio = texto
    .replace(/ | /g, ' ')
    .replace(/[€$£]|eur|euros?|usd/gi, '')
    .trim()
  if (limpio === '') return null

  // Contabilidad y algunos bancos marcan el negativo con paréntesis o con el
  // signo detrás del número.
  let negativo = false
  if (/^\(.*\)$/.test(limpio)) {
    negativo = true
    limpio = limpio.slice(1, -1).trim()
  }
  if (/-\s*$/.test(limpio)) {
    negativo = true
    limpio = limpio.replace(/-\s*$/, '').trim()
  }
  if (/^-/.test(limpio)) {
    negativo = true
    limpio = limpio.slice(1).trim()
  }
  if (/^\+/.test(limpio)) limpio = limpio.slice(1).trim()

  limpio = limpio.replace(/\s/g, '')
  if (!/^[\d.,]+$/.test(limpio)) return null

  const comas = (limpio.match(/,/g) ?? []).length
  const puntos = (limpio.match(/\./g) ?? []).length

  let normalizado: string
  if (comas > 0 && puntos > 0) {
    // Manda el último separador que aparece: es el decimal.
    const decimal = limpio.lastIndexOf(',') > limpio.lastIndexOf('.') ? ',' : '.'
    const millar = decimal === ',' ? '.' : ','
    normalizado = limpio.split(millar).join('').replace(decimal, '.')
  } else if (comas > 0) {
    // La coma en español es el decimal. Con varias, son separadores de millar.
    normalizado = comas > 1 ? limpio.split(',').join('') : limpio.replace(',', '.')
  } else if (puntos > 0) {
    const trozos = limpio.split('.')
    const ultimo = trozos[trozos.length - 1]
    // `180.000` → millar. `3.40` → decimal. La frontera son 3 dígitos exactos
    // detrás del último punto y más de un dígito delante.
    const esMillar = puntos > 1 || (ultimo.length === 3 && trozos[0].length > 0)
    normalizado = esMillar ? trozos.join('') : limpio
  } else {
    normalizado = limpio
  }

  const valor = Number(normalizado)
  if (!Number.isFinite(valor)) return null
  const centimos = aCentimos(valor)
  return negativo ? -centimos : centimos
}
