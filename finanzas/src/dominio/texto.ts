/**
 * Decodificación de ficheros de texto de origen bancario.
 *
 * Los extractos españoles (Norma 43, CSV de banca electrónica) suelen venir en
 * **Windows-1252 / ISO-8859-1**, no en UTF-8. Si se leen como UTF-8, las
 * vocales acentuadas y la ñ salen como «Aportaci�n». Aquí se intenta UTF-8 y,
 * en cuanto aparece un carácter de reemplazo, se vuelve a decodificar en
 * Windows-1252, que es lo que mandan los bancos.
 */

/** Carácter de reemplazo que produce el decodificador cuando el byte no es UTF-8 válido. */
const REEMPLAZO = '�'

export function decodificarTextoBancario(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)

  // BOM UTF-8 explícito: no hay duda.
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3))
  }

  const comoUtf8 = new TextDecoder('utf-8').decode(bytes)
  if (!comoUtf8.includes(REEMPLAZO)) return comoUtf8

  try {
    return new TextDecoder('windows-1252').decode(bytes)
  } catch {
    // Si el entorno no conoce windows-1252, latin1 cubre casi lo mismo.
    return new TextDecoder('iso-8859-1').decode(bytes)
  }
}
