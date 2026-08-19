import type { Celda } from '@norte/dominio'

/**
 * CSV, con las dos costumbres que hay que respetar en España: el separador es
 * el punto y coma (porque la coma es el decimal) y el fichero suele venir en
 * Windows-1252 en vez de UTF-8.
 */

/** Se cuenta cuál de los candidatos aparece más veces fuera de comillas: es más
 *  fiable que suponer, y los bancos usan los tres. */
function detectarSeparador(texto: string): string {
  const muestra = texto.split(/\r?\n/).slice(0, 10).join('\n')
  const candidatos = [';', ',', '\t', '|']
  let mejor = ';'
  let mejorCuenta = -1
  for (const separador of candidatos) {
    const cuenta = muestra.split(separador).length - 1
    if (cuenta > mejorCuenta) {
      mejorCuenta = cuenta
      mejor = separador
    }
  }
  return mejor
}

export function leerCsv(texto: string): Celda[][] {
  const separador = detectarSeparador(texto)
  const filas: string[][] = []
  let fila: string[] = []
  let campo = ''
  let entreComillas = false

  for (let i = 0; i < texto.length; i++) {
    const caracter = texto[i]!
    if (entreComillas) {
      if (caracter === '"') {
        if (texto[i + 1] === '"') {
          campo += '"'
          i++
        } else entreComillas = false
      } else campo += caracter
      continue
    }
    if (caracter === '"') entreComillas = true
    else if (caracter === separador) {
      fila.push(campo)
      campo = ''
    } else if (caracter === '\n') {
      fila.push(campo.replace(/\r$/, ''))
      filas.push(fila)
      fila = []
      campo = ''
    } else campo += caracter
  }
  if (campo !== '' || fila.length > 0) {
    fila.push(campo.replace(/\r$/, ''))
    filas.push(fila)
  }
  return filas.map((f) => f.map((c) => c.trim()))
}
