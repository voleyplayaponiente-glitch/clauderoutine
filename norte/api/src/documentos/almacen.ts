import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

/**
 * Dónde viven los ficheros que sube el usuario.
 *
 * En disco, dentro del volumen de datos de la app en el Umbrel — el mismo sitio
 * que sobrevive a reinstalar la app. **No** en la base de datos: un PDF de
 * varios megas dentro de una columna hace que cada copia de seguridad de la
 * base pese lo que pese la bandeja de entrada, y el backup de PostgreSQL es
 * justo lo que tiene que ser pequeño y frecuente.
 *
 * El nombre del fichero en disco es el SHA-256 de su contenido, así que nada de
 * lo que escriba el usuario acaba formando parte de una ruta.
 */

const EXTENSIONES = new Set([
  '.pdf', '.xlsx', '.xls', '.xlsm', '.csv', '.tsv', '.txt',
  '.q43', '.n43', '.c43', '.aeb43', '.ods',
])

/** El tamaño máximo de un fichero. Un extracto de un año no llega a 1 MB; 15
 *  deja sitio de sobra para un PDF con logotipos y cierra la puerta a llenar el
 *  disco del Umbrel subiendo vídeos. */
export const TAMANO_MAXIMO = 15 * 1024 * 1024

export function extensionDe(nombre: string): string {
  const punto = nombre.lastIndexOf('.')
  const extension = punto === -1 ? '' : nombre.slice(punto).toLowerCase()
  return EXTENSIONES.has(extension) ? extension : ''
}

export function esExtensionAdmitida(nombre: string): boolean {
  return extensionDe(nombre) !== ''
}

export function extensionesAdmitidas(): string[] {
  return [...EXTENSIONES].sort()
}

export function huellaContenido(datos: Buffer): string {
  return createHash('sha256').update(datos).digest('hex')
}

export interface Almacen {
  guardar(espacioId: string, datos: Buffer, nombreOriginal: string): Promise<string>
  leer(ruta: string): Promise<Buffer>
  borrar(ruta: string): Promise<void>
}

export function crearAlmacen(datosDir: string): Almacen {
  const raiz = resolve(datosDir, 'documentos')

  /** Comprobación de cinturón y tirantes: aunque la ruta se construye a partir
   *  de un hash y de un id de la base de datos, nunca se lee ni se borra nada
   *  fuera de la carpeta de documentos. */
  function rutaAbsoluta(relativa: string): string {
    const destino = resolve(raiz, relativa)
    if (destino !== raiz && !destino.startsWith(raiz + '/')) {
      throw new Error('Ruta de documento fuera del almacén.')
    }
    return destino
  }

  return {
    async guardar(espacioId, datos, nombreOriginal) {
      const extension = extensionDe(nombreOriginal)
      const relativa = join(espacioId, `${huellaContenido(datos)}${extension}`)
      const destino = rutaAbsoluta(relativa)
      await mkdir(join(raiz, espacioId), { recursive: true })
      await writeFile(destino, datos)
      return relativa
    },
    async leer(ruta) {
      return readFile(rutaAbsoluta(ruta))
    },
    async borrar(ruta) {
      await rm(rutaAbsoluta(ruta), { force: true })
    },
  }
}
