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

/**
 * Topes contra una bomba de descompresión. Este lector procesa ficheros que
 * llegan de fuera, y `deflate` comprime ceros mejor que 1000:1: sin tope, un
 * `.xlsx` de 15 MB puede pedir gigas de memoria al inflarse y tirar el
 * servidor entero. Los límites están muy por encima de cualquier extracto
 * real —el `sheet1.xml` de un año de movimientos no llega a 10 MB— y muy por
 * debajo de lo que hace daño.
 */
const MAX_ENTRADAS = 1_000
const MAX_DESCOMPRIMIDO_ENTRADA = 64 * 1024 * 1024
const MAX_DESCOMPRIMIDO_TOTAL = 128 * 1024 * 1024

export class ErrorZipDesmedido extends Error {
  constructor() {
    super(
      'El fichero se expande muchísimo al descomprimirlo, que es lo que hacen los ficheros ' +
        'preparados para agotar la memoria del servidor. No se sigue leyendo.',
    )
  }
}

export function abrirZip(datos: Buffer): Map<string, Buffer> {
  const fin = buscarFinDeDirectorio(datos)
  if (fin === -1) throw new Error('El fichero no es un ZIP válido (no encuentro el directorio central).')

  const entradas = Math.min(datos.readUInt16LE(fin + 10), MAX_ENTRADAS)
  let cursor = datos.readUInt32LE(fin + 16)
  const ficheros = new Map<string, Buffer>()
  let totalDescomprimido = 0

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

    if (metodo === 0) {
      ficheros.set(nombre, Buffer.from(bruto))
      totalDescomprimido += bruto.length
    } else if (metodo === 8) {
      let inflado: Buffer
      try {
        inflado = inflateRawSync(bruto, { maxOutputLength: MAX_DESCOMPRIMIDO_ENTRADA })
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ERR_BUFFER_TOO_LARGE') {
          throw new ErrorZipDesmedido()
        }
        throw error
      }
      ficheros.set(nombre, inflado)
      totalDescomprimido += inflado.length
    }
    // Cualquier otro método de compresión no lo produce ningún Excel: se ignora
    // la entrada en vez de fingir que se ha leído.

    if (totalDescomprimido > MAX_DESCOMPRIMIDO_TOTAL) throw new ErrorZipDesmedido()

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
