/**
 * Copias de seguridad **fuera del navegador**, contra tu propio servidor.
 *
 * El motivo es concreto: la app guarda todo en IndexedDB y el día que el
 * navegador limpia los datos del sitio no hay de dónde sacarlos. La copia
 * automática diaria tampoco salva, porque vive en el mismo sitio que los datos.
 * Esto los saca a un disco que es tuyo.
 *
 * Se reutiliza el servicio de `servidor/`, con el mismo secreto y las mismas
 * reglas de seguridad: solo HTTPS (o HTTP en red local, porque ahí el secreto no
 * sale de casa) y el JSON que entra se lee con `parseJsonSeguro`.
 */
import { construirBackup, verificarIntegridad, type Backup } from '../dominio/backup'
import { urlServidorSegura } from '../dominio/conectores'
import { parseJsonSeguro } from './backup'
import type { Configuracion, DatosOperativos, ServidorCopias } from '../dominio/tipos'
import type { Grupo } from '../dominio/grupo'

export interface CopiaRemota {
  fecha: string
  bytes: number
}

/** Valida la URL y devuelve la base sin barra final. Lanza si no es segura. */
function base(cfg: ServidorCopias | undefined): string {
  const v = urlServidorSegura(cfg?.url)
  if (!v.ok) throw new Error(v.motivo ?? 'URL del servidor no admitida')
  return (cfg!.url as string).replace(/\/$/, '')
}

function cabeceras(cfg: ServidorCopias): Record<string, string> {
  return { Authorization: `Bearer ${cfg.secreto ?? ''}`, 'Content-Type': 'application/json' }
}

async function pedir(cfg: ServidorCopias, ruta: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${base(cfg)}${ruta}`, { ...init, headers: { ...cabeceras(cfg), ...(init?.headers ?? {}) } })
  const texto = await res.text()
  if (!res.ok) {
    // El servidor explica el motivo en JSON; si no, se da el código tal cual.
    let motivo = `El servidor respondió ${res.status}`
    try {
      const cuerpo = parseJsonSeguro(texto) as { error?: string }
      if (cuerpo?.error) motivo = cuerpo.error
    } catch {
      /* respuesta sin JSON: se queda el código */
    }
    throw new Error(motivo)
  }
  return texto === '' ? undefined : parseJsonSeguro(texto)
}

/** ¿Responde el servidor y sabe guardar copias? */
export async function probarServidorCopias(cfg: ServidorCopias): Promise<{ ok: boolean; mensaje: string }> {
  try {
    const estado = (await pedir(cfg, '/api/estado')) as { ok?: boolean; copias?: boolean }
    if (!estado?.ok) return { ok: false, mensaje: 'El servidor ha respondido, pero no como se esperaba.' }
    if (!estado.copias) {
      return { ok: false, mensaje: 'El servidor funciona pero es una versión antigua, sin almacén de copias. Actualízalo.' }
    }
    return { ok: true, mensaje: 'Conectado. El servidor guarda copias.' }
  } catch (e) {
    return { ok: false, mensaje: e instanceof Error ? e.message : 'No se ha podido conectar' }
  }
}

/** Sube la copia del día de una empresa. */
export async function subirCopia(
  cfg: ServidorCopias,
  empresaId: string,
  config: Configuracion,
  datos: DatosOperativos,
  fecha: string,
  grupo?: Grupo,
): Promise<{ fecha: string; bytes: number }> {
  const backup = construirBackup(config, datos, fecha, grupo)
  const r = (await pedir(cfg, `/api/copias/${encodeURIComponent(empresaId)}`, {
    method: 'PUT',
    body: JSON.stringify(backup),
  })) as { fecha: string; bytes: number }
  return r
}

export async function listarCopiasRemotas(cfg: ServidorCopias, empresaId: string): Promise<CopiaRemota[]> {
  const r = (await pedir(cfg, `/api/copias/${encodeURIComponent(empresaId)}`)) as { copias?: CopiaRemota[] }
  return r?.copias ?? []
}

export interface EmpresaConCopia {
  empresaId: string
  copias: number
  ultima: string
  razonSocial: string
  cif: string
}

/**
 * Empresas que tienen copias en el servidor.
 *
 * **Es el punto de entrada de la recuperación.** Tras un borrado del navegador,
 * la app arranca con un id de empresa nuevo y las copias están bajo el viejo:
 * hay que ir por aquí, no por el id local, y por eso el servidor devuelve
 * también la razón social.
 */
export async function empresasConCopia(cfg: ServidorCopias): Promise<EmpresaConCopia[]> {
  const r = (await pedir(cfg, '/api/copias')) as { empresas?: EmpresaConCopia[] }
  return r?.empresas ?? []
}

/**
 * Descarga una copia del servidor **verificando su integridad**: se restaura
 * sobre los datos de verdad, así que un JSON manipulado o a medias no puede
 * entrar sin más.
 */
export async function descargarCopiaRemota(cfg: ServidorCopias, empresaId: string, fecha?: string): Promise<Backup> {
  const backup = await pedir(cfg, `/api/copias/${encodeURIComponent(empresaId)}/${encodeURIComponent(fecha ?? 'ultima')}`)
  const r = verificarIntegridad(backup)
  if (!r.valido) throw new Error(r.motivo ?? 'La copia del servidor no es válida')
  return backup as Backup
}

/**
 * ¿Merece la pena subir esto? **Nunca se sube una copia vacía**: si la app
 * arranca sin datos (el navegador limpió el sitio, otro perfil…), subirla
 * machacaría la copia buena del día en el servidor. Es el mismo cuidado que se
 * tiene con los snapshots locales, y por el mismo susto.
 */
export function mereceSubirse(config: Configuracion, datos: DatosOperativos): boolean {
  const hayOperaciones = Object.values(datos as unknown as Record<string, unknown>).some((v) => Array.isArray(v) && v.length > 0)
  const hayEmpresa = (config.empresa?.razonSocial ?? '').trim() !== '' || (config.empresa?.cif ?? '').trim() !== ''
  return hayOperaciones || hayEmpresa
}
