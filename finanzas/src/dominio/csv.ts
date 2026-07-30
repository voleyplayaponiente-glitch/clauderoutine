/**
 * Parser de CSV/TSV robusto: detecta el separador (coma, punto y coma o
 * tabulador), respeta comillas y campos con saltos de línea. Pensado para
 * ficheros españoles, donde el punto y coma es habitual (la coma es decimal).
 */

/** Detecta el separador más probable en la primera línea no vacía. */
export function detectarSeparador(texto: string): string {
  const primera = texto.split(/\r?\n/).find((l) => l.trim() !== '') ?? ''
  const candidatos = [';', '\t', ',']
  let mejor = ';'
  let max = -1
  for (const sep of candidatos) {
    const n = primera.split(sep).length
    if (n > max) {
      max = n
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
