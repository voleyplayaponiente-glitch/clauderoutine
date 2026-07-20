// Sesiones del servidor web: token → fecha de caducidad. Se guardan en un
// fichero JSON dentro de la carpeta de datos (mismo volumen que la base de
// datos) para que sobrevivan a reinicios del contenedor: antes se perdían
// y había que volver a introducir la contraseña tras cada actualización.
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { carpetaDatos } from '../main/db/database'

// Igual que el Max-Age de la cookie: 30 días.
export const DURACION_SESION_MS = 30 * 24 * 60 * 60 * 1000

const rutaFichero = (): string => join(carpetaDatos(), 'sesiones.json')

let sesiones = new Map<string, number>()

export function cargarSesiones(): void {
  try {
    const datos = JSON.parse(readFileSync(rutaFichero(), 'utf8')) as Record<string, number>
    sesiones = new Map(Object.entries(datos).filter(([, exp]) => typeof exp === 'number'))
  } catch {
    sesiones = new Map() // primera ejecución o fichero ilegible
  }
  purgarCaducadas()
}

function guardar(): void {
  try {
    writeFileSync(rutaFichero(), JSON.stringify(Object.fromEntries(sesiones)))
  } catch {
    // Si no se puede escribir (disco lleno…), la sesión sigue valiendo en memoria.
  }
}

function purgarCaducadas(): void {
  const ahora = Date.now()
  let cambio = false
  for (const [tok, exp] of sesiones) {
    if (exp <= ahora) {
      sesiones.delete(tok)
      cambio = true
    }
  }
  if (cambio) guardar()
}

export function crearSesion(token: string): void {
  purgarCaducadas()
  sesiones.set(token, Date.now() + DURACION_SESION_MS)
  guardar()
}

export function sesionValida(token: string | null | undefined): boolean {
  if (!token) return false
  const exp = sesiones.get(token)
  if (!exp) return false
  if (exp <= Date.now()) {
    sesiones.delete(token)
    guardar()
    return false
  }
  return true
}

export function borrarSesion(token: string): void {
  if (sesiones.delete(token)) guardar()
}
