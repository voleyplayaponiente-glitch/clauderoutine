import { inflateRawSync } from 'node:zlib'

/**
 * Lo justo del formato ZIP para abrir un `.xlsx`.
 *
 * Un `.xlsx` es un ZIP con XML dentro, y Node ya trae el `inflate`. Traer una
 * librería entera de hojas de cálculo para esto significaba, en la práctica,
 * meter la única versión que hay en el registro público de npm —con dos
 * vulnerabilidades conocidas sin parchear— en el camino que procesa ficheros.
 * Esto son ochenta líneas y hace exactamente lo que hace falta.
 */

const FIN_DIRECTORIO = 0x06054b50
const ENTRADA_DIRECTORIO = 0x02014b50

export function abrirZip(datos: Buffer): Map<string, Buffer> {
  const fin = buscarFinDeDirectorio(datos)
  if (fin === -1) throw new Error('El fichero no es un ZIP válido (no encuentro el directorio central).')

  const entradas = datos.readUInt16LE(fin + 10)
  let cursor = datos.readUInt32LE(fin + 16)
  const ficheros = new Map<string, Buffer>()

  for (let i = 0; i < entradas; i++) {
    if (datos.readUInt32LE(cursor) !== ENTRADA_DIRECTORIO) break
    const metodo = datos.readUInt16LE(cursor + 10)
    const comprimido = datos.readUInt32LE(cursor + 20)
    const largoNombre = datos.readUInt16LE(cursor + 28)
    const largoExtra = datos.readUInt16LE(cursor + 30)
    const largoComentario = datos.readUInt16LE(cursor + 32)
    const desplazamiento = datos.readUInt32LE(cursor + 42)
    const nombre = datos.toString('utf8', cursor + 46, cursor + 46 + largoNombre)

    // La cabecera local repite el nombre y los extras con longitudes propias:
    // hay que leerlas de ahí, no del directorio, o el contenido sale corrido.
    const localNombre = datos.readUInt16LE(desplazamiento + 26)
    const localExtra = datos.readUInt16LE(desplazamiento + 28)
    const inicio = desplazamiento + 30 + localNombre + localExtra
    const bruto = datos.subarray(inicio, inicio + comprimido)

    if (metodo === 0) ficheros.set(nombre, Buffer.from(bruto))
    else if (metodo === 8) ficheros.set(nombre, inflateRawSync(bruto))
    // Cualquier otro método de compresión no lo produce ningún Excel: se ignora
    // la entrada en vez de fingir que se ha leído.

    cursor += 46 + largoNombre + largoExtra + largoComentario
  }
  return ficheros
}

/** El directorio central está al final, detrás de un comentario de longitud
 *  variable, así que se busca la firma hacia atrás. */
function buscarFinDeDirectorio(datos: Buffer): number {
  const minimo = Math.max(0, datos.length - 66_000)
  for (let i = datos.length - 22; i >= minimo; i--) {
    if (datos.readUInt32LE(i) === FIN_DIRECTORIO) return i
  }
  return -1
}
