/**
 * Parser de CSV/TSV robusto: detecta el separador (coma, punto y coma o
 * tabulador), respeta comillas y campos con saltos de línea. Pensado para
 * ficheros españoles, donde el punto y coma es habitual (la coma es decimal).
 */

/**
 * Detecta el separador contando cuántas veces aparece **fuera de comillas** en
 * el principio del fichero.
 *
 * Mirar solo la primera línea no vale: Square abre el fichero con un título
 * entrecomillado que ocupa dos líneas y no lleva ningún separador, así que
 * ganaba el `;` por descarte y el CSV entero se leía como una sola columna.
 * Y contar sin respetar las comillas tampoco: `"556,99 €"` está lleno de comas
 * decimales que no separan nada.
 */
export function detectarSeparador(texto: string): string {
  const candidatos = [';', '\t', ',']
  const cuenta: Record<string, number> = { ';': 0, '\t': 0, ',': 0 }
  const t = texto.slice(0, 20_000)
  let enComillas = false
  let lineas = 0

  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (c === '"') {
      // Comilla doblada dentro de un campo: no cambia el estado.
      if (enComillas && t[i + 1] === '"') i++
      else enComillas = !enComillas
      continue
    }
    if (enComillas) continue
    if (c === '\n') {
      if (++lineas >= 12) break
      continue
    }
    if (c in cuenta) cuenta[c]++
  }

  let mejor = ';'
  let max = 0
  for (const sep of candidatos) {
    if (cuenta[sep] > max) {
      max = cuenta[sep]
      mejor = sep
    }
  }
  return mejor
}

/** Parsea CSV/TSV a matriz de strings, respetando comillas dobles. */
export function parsearCSV(texto: string, separador?: string): string[][] {
  const sep = separador ?? detectarSeparador(texto)
  const filas: string[][] = []
  let campo = ''
  let fila: string[] = []
  let enComillas = false
  const t = texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (enComillas) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          campo += '"'
          i++
        } else {
          enComillas = false
        }
      } else {
        campo += c
      }
    } else if (c === '"') {
      enComillas = true
    } else if (c === sep) {
      fila.push(campo)
      campo = ''
    } else if (c === '\n') {
      fila.push(campo)
      filas.push(fila)
      fila = []
      campo = ''
    } else {
      campo += c
    }
  }
  // Último campo/fila si el fichero no acaba en salto.
  if (campo !== '' || fila.length > 0) {
    fila.push(campo)
    filas.push(fila)
  }
  // Descarta filas totalmente vacías.
  return filas.filter((f) => f.some((x) => x.trim() !== ''))
}
