/**
 * Archivo de documentos (las facturas en PDF que se suben en Compras).
 *
 * El contenido NO se guarda dentro del objeto de datos de la empresa: iría en
 * cada escritura y con unos cuantos meses de facturas la haría lentísima. Cada
 * fichero vive en su propia clave de IndexedDB, y la compra solo guarda el id.
 *
 * Como el resto de la app, esto es del dispositivo: un archivo local. Para
 * llevárselo a otro sitio está la descarga en ZIP de la carpeta del mes.
 */
import { get, set, del, keys } from 'idb-keyval'
import type { ID } from '../dominio/tipos'

const clave = (empresaId: ID, adjuntoId: ID) => `finanzas:adjunto:${empresaId}:${adjuntoId}`

export interface Adjunto {
  nombre: string
  tipo: string
  datos: ArrayBuffer
}

export async function guardarAdjunto(empresaId: ID, adjuntoId: ID, a: Adjunto): Promise<void> {
  await set(clave(empresaId, adjuntoId), a)
}

export async function leerAdjunto(empresaId: ID, adjuntoId: ID): Promise<Adjunto | undefined> {
  return get<Adjunto>(clave(empresaId, adjuntoId))
}

export async function borrarAdjunto(empresaId: ID, adjuntoId: ID): Promise<void> {
  await del(clave(empresaId, adjuntoId))
}

/** Cuántos documentos hay guardados y cuánto ocupan, para poder decirlo. */
export async function resumenArchivo(empresaId: ID): Promise<{ numero: number; bytes: number }> {
  const todas = await keys()
  const prefijo = `finanzas:adjunto:${empresaId}:`
  let numero = 0
  let bytes = 0
  for (const k of todas) {
    if (typeof k !== 'string' || !k.startsWith(prefijo)) continue
    const a = await get<Adjunto>(k)
    if (!a) continue
    numero++
    bytes += a.datos.byteLength
  }
  return { numero, bytes }
}

/** Abre el documento en una pestaña nueva. El objeto URL se libera después. */
export function abrirAdjunto(a: Adjunto): void {
  const url = URL.createObjectURL(new Blob([a.datos], { type: a.tipo || 'application/octet-stream' }))
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export function descargarBytes(nombre: string, datos: Uint8Array | ArrayBuffer, tipo: string): void {
  const url = URL.createObjectURL(new Blob([datos as BlobPart], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
