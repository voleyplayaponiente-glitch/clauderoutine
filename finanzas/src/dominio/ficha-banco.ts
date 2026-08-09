/**
 * Lectura de las «fichas de contrato» que imprime la banca digital.
 *
 * No son tablas de cuadro (fila = cuota) sino pares **rótulo → valor**
 * repartidos en columnas: una fila con los rótulos y la siguiente con sus
 * valores, en el mismo orden de izquierda a derecha. Cuando un rótulo no cabe,
 * el PDF lo parte y la continuación aparece en la fila de abajo:
 *
 *   Fianza:  Periodicidad de las cuotas:  Importe de la cuota
 *   periódica:
 *   0,00 €  MENSUAL
 *   319,00 €
 *
 * Así que se recorre el documento en orden de lectura con una **cola de rótulos
 * pendientes**: cada rótulo entra en la cola y cada valor la va vaciando por el
 * principio. Un rótulo suelto al final de una fila que ya trae rótulos es una
 * continuación y se pega al primer rótulo de la fila siguiente.
 *
 * **El primer valor gana**: la segunda página de estas fichas trae rótulos
 * partidos de mala manera y no debe pisar lo leído en la primera.
 */

import { parsearImporte } from './parseo-es'
import { aplanar } from './prestamo-archivo'

/** Texto de una celda, venga de Excel (número, fecha) o de PDF (string). */
function texto(c: unknown): string {
  if (c === null || c === undefined) return ''
  return String(c).trim()
}

/** Un rótulo es una celda que termina en dos puntos. */
function esRotulo(s: string): boolean {
  return s.endsWith(':')
}

/**
 * ¿La celda parece un valor y no un trozo de rótulo?
 * Un valor de estas fichas es una cifra, una fecha, un importe o una palabra
 * suelta («MENSUAL», «Vigente», «IVA»). La continuación de un rótulo partido es
 * prosa: varias palabras en minúscula («cambiar en toda la duración»).
 */
function pareceValor(s: string): boolean {
  return /^[\d-]/.test(s) || !/\s/.test(s) || s === s.toUpperCase()
}

/** Quita los dos puntos finales y normaliza para poder comparar. */
export function claveRotulo(s: string): string {
  return aplanar(s.replace(/:\s*$/, '')).replace(/\s+/g, ' ').trim()
}

/**
 * Convierte las filas de la ficha en un mapa `rótulo normalizado → valor`.
 * Devuelve además el orden en que aparecieron, que es lo que permite depurar
 * una ficha nueva sin adivinar.
 */
export function leerFicha(filas: unknown[][]): Map<string, string> {
  const ficha = new Map<string, string>()
  const pendientes: string[] = []
  /** Continuación de un rótulo partido, a la espera de la fila siguiente. */
  let continuacion = ''

  for (const fila of filas) {
    const celdas = fila.map(texto).filter((c) => c !== '')
    if (celdas.length === 0) continue

    const traeRotulos = celdas.some(esRotulo)
    // Dónde empieza la ristra de celdas sin dos puntos con la que acaba la fila:
    // en una fila de rótulos, ahí es donde el PDF parte los que no caben.
    let inicioCola = celdas.length
    while (inicioCola > 0 && !esRotulo(celdas[inicioCola - 1])) inicioCola--

    // Fila que alterna rótulo, valor, rótulo, valor…: se basta a sí misma, no
    // hay nada partido. Es como imprime la ficha de la póliza, mientras que la
    // del renting pone los rótulos arriba y los valores debajo.
    const alterna =
      celdas.length % 2 === 0 && celdas.every((c, i) => (i % 2 === 0 ? esRotulo(c) : !esRotulo(c) && pareceValor(c)))
    if (alterna) inicioCola = celdas.length

    for (let i = 0; i < celdas.length; i++) {
      let celda = celdas[i]

      if (esRotulo(celda)) {
        if (continuacion) {
          celda = `${continuacion} ${celda}`
          continuacion = ''
        }
        pendientes.push(celda)
        continue
      }

      // Trozo sin dos puntos al final de una fila de rótulos: es un rótulo
      // partido por el ancho de la columna, no un valor. Se distingue por el
      // contenido, porque «Fecha impresión: 09/08/2026» también acaba en algo
      // sin dos puntos: **un valor empieza por cifra**, un rótulo por letra.
      if (traeRotulos && i >= inicioCola && !pareceValor(celda)) {
        continuacion = continuacion ? `${continuacion} ${celda}` : celda
        continue
      }

      // Valor: se lo lleva el primer rótulo pendiente. Sin rótulos pendientes
      // es un titular de sección o un pie de página; se descarta.
      const rotulo = pendientes.shift()
      if (!rotulo) continue
      const clave = claveRotulo(rotulo)
      if (!ficha.has(clave)) ficha.set(clave, celda)
    }
  }

  return ficha
}

/**
 * Busca un valor por cualquiera de sus rótulos posibles, admitiendo que el
 * banco lo escriba con más palabras de las esperadas (coincidencia por
 * contenido, después de probar la exacta).
 */
export function valorFicha(ficha: Map<string, string>, ...rotulos: string[]): string | undefined {
  for (const r of rotulos) {
    const clave = claveRotulo(r)
    const exacto = ficha.get(clave)
    if (exacto !== undefined) return exacto
  }
  for (const r of rotulos) {
    const clave = claveRotulo(r)
    for (const [k, v] of ficha) if (k.includes(clave)) return v
  }
  return undefined
}

// ─────────────────────── Lectura de los valores ───────────────────────
// Estas fichas siempre vienen en convención española (1.234,56). No se
// «autodetecta»: un «0,00 €» suelto es ambiguo y la heurística podría leerlo mal.

/** Importe en euros de un rótulo («28.000,00 euros» → 28000). */
export function importeFicha(ficha: Map<string, string>, ...rotulos: string[]): number | undefined {
  const v = valorFicha(ficha, ...rotulos)
  if (v === undefined) return undefined
  const n = parsearImporte(v.replace(/euros?/gi, ''), 'ES')
  return n === null ? undefined : n
}

/** Porcentaje de un rótulo («6,500%» → 6.5). */
export function porcentajeFicha(ficha: Map<string, string>, ...rotulos: string[]): number | undefined {
  const v = valorFicha(ficha, ...rotulos)
  if (v === undefined || !/\d/.test(v)) return undefined
  const n = parsearImporte(v.replace('%', ''), 'ES')
  return n === null ? undefined : n
}

/** Entero de un rótulo («48» → 48). Ignora lo que no sea un número limpio. */
export function enteroFicha(ficha: Map<string, string>, ...rotulos: string[]): number | undefined {
  const v = valorFicha(ficha, ...rotulos)
  if (v === undefined) return undefined
  const m = /^-?\d+$/.exec(v.replace(/[.\s]/g, ''))
  return m ? Number(m[0]) : undefined
}

/** Fecha `dd/mm/aaaa` (o con guiones o puntos) a ISO. No adivina otros formatos. */
export function fechaFicha(ficha: Map<string, string>, ...rotulos: string[]): string | undefined {
  const v = valorFicha(ficha, ...rotulos)
  if (v === undefined) return undefined
  const m = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(v)
  if (!m) return undefined
  const [, d, mes, a] = m
  if (Number(mes) < 1 || Number(mes) > 12 || Number(d) < 1 || Number(d) > 31) return undefined
  return `${a}-${mes.padStart(2, '0')}-${d.padStart(2, '0')}`
}
