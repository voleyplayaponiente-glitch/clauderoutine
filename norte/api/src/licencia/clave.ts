import { createPublicKey, sign, verify, type KeyObject } from 'node:crypto'
import { PLANES, type CargaLicencia, type PlanLicencia } from '@norte/dominio'

/**
 * Lectura y comprobación de una clave de licencia.
 *
 * Formato: `NORTE-1.<carga>.<firma>`, las dos partes en base64url. La carga es
 * el JSON de `CargaLicencia` y la firma es **Ed25519** sobre esos bytes.
 *
 * Se firma la carga codificada, no el objeto: reserializar un JSON antes de
 * comprobar la firma es la forma clásica de que dos implementaciones ordenen
 * las claves distinto y una firma buena parezca mala.
 *
 * La clave pública va en el código porque es pública. La privada no está en
 * este repositorio ni tiene por qué estarlo: quien vende licencias la guarda
 * él, y `npm run licencia` firma con ella sin que salga de su máquina.
 */

/** Clave pública Ed25519 en crudo (32 bytes), en base64url. */
const PUBLICA_POR_DEFECTO = 'ijAKfbGkwFwzrfEcaXTxNtqtqYeF5O_J6tPBp4S8gbI'

/** Prefijo DER de una clave pública Ed25519 en formato SPKI. */
const CABECERA_SPKI = Buffer.from('302a300506032b6570032100', 'hex')

export class ErrorClave extends Error {}

export function clavePublica(desde: string | undefined = process.env.NORTE_CLAVE_LICENCIAS) {
  const bruta = Buffer.from(desde?.trim() || PUBLICA_POR_DEFECTO, 'base64url')
  if (bruta.length !== 32) {
    throw new ErrorClave('La clave pública de licencias no mide 32 bytes.')
  }
  return createPublicKey({
    key: Buffer.concat([CABECERA_SPKI, bruta]),
    format: 'der',
    type: 'spki',
  })
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/

/**
 * Devuelve la carga si la clave está bien firmada, y **`null` si no**. No
 * lanza: una clave mal escrita es un caso normal, no un fallo del servidor.
 */
export function leerClave(clave: string, publica = clavePublica()): CargaLicencia | null {
  const partes = clave.trim().split('.')
  if (partes.length !== 3 || partes[0] !== 'NORTE-1') return null

  let carga: unknown
  try {
    const firmaOk = verify(
      null,
      Buffer.from(partes[1]!, 'base64url'),
      publica,
      Buffer.from(partes[2]!, 'base64url'),
    )
    if (!firmaOk) return null
    carga = JSON.parse(Buffer.from(partes[1]!, 'base64url').toString('utf8'))
  } catch {
    return null
  }

  return comprobarForma(carga)
}

/**
 * Una firma buena no garantiza una carga con sentido: el que firma podría
 * equivocarse. Se comprueba la forma antes de dejarla entrar.
 */
function comprobarForma(valor: unknown): CargaLicencia | null {
  if (typeof valor !== 'object' || valor === null) return null
  const c = valor as Record<string, unknown>

  const cadena = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 200
  if (!cadena(c.id) || !cadena(c.titular)) return null
  if (!PLANES.includes(c.plan as PlanLicencia)) return null
  if (typeof c.emitidaEn !== 'string' || !FECHA.test(c.emitidaEn)) return null
  if (c.caducaEn !== null && (typeof c.caducaEn !== 'string' || !FECHA.test(c.caducaEn))) return null
  if (typeof c.maxUsuarios !== 'number' || !Number.isInteger(c.maxUsuarios)) return null
  if (c.maxUsuarios < 1 || c.maxUsuarios > 1000) return null
  if (c.email !== undefined && !cadena(c.email)) return null

  return {
    id: c.id as string,
    plan: c.plan as PlanLicencia,
    titular: c.titular as string,
    email: c.email as string | undefined,
    emitidaEn: c.emitidaEn,
    caducaEn: c.caducaEn as string | null,
    maxUsuarios: c.maxUsuarios,
  }
}

/** Firma una carga. Solo lo usa la herramienta de emitir licencias. */
export function firmarClave(carga: CargaLicencia, privada: KeyObject): string {
  const cuerpo = Buffer.from(JSON.stringify(carga), 'utf8').toString('base64url')
  const firma = sign(null, Buffer.from(cuerpo, 'base64url'), privada).toString('base64url')
  return `NORTE-1.${cuerpo}.${firma}`
}
