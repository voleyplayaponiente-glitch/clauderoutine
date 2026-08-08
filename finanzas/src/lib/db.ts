/**
 * Persistencia local con IndexedDB (idb-keyval). Todo queda en el dispositivo;
 * offline-first. La exportación completa en JSON garantiza que nunca haya
 * dependencia del proveedor.
 *
 * MULTI-EMPRESA: cada empresa del grupo tiene su propio espacio de claves
 * (`finanzas:config:<id>` y `finanzas:datos:<id>`), de modo que los datos de
 * dos sociedades NUNCA pueden mezclarse. El índice del grupo (qué empresas hay
 * y quién participa en quién) vive aparte, en `finanzas:grupo`.
 */
import { get, set, del, keys } from 'idb-keyval'
import type { Configuracion, DatosOperativos, ID } from '../dominio/tipos'
import type { Backup } from '../dominio/backup'
import type { Grupo } from '../dominio/grupo'

const CLAVE_TEMA = 'finanzas:tema'
const CLAVE_SNAPSHOTS = 'finanzas:snapshots'
const CLAVE_GRUPO = 'finanzas:grupo'

/** Claves de la versión de una sola empresa, anteriores al grupo. */
const CLAVE_CONFIG_LEGADO = 'finanzas:configuracion'
const CLAVE_DATOS_LEGADO = 'finanzas:datos'

const claveConfig = (empresaId: ID) => `finanzas:config:${empresaId}`
const claveDatos = (empresaId: ID) => `finanzas:datos:${empresaId}`

export async function cargarSnapshots(): Promise<Backup[]> {
  return (await get<Backup[]>(CLAVE_SNAPSHOTS)) ?? []
}

export async function guardarSnapshots(snapshots: Backup[]): Promise<void> {
  await set(CLAVE_SNAPSHOTS, snapshots)
}

export async function cargarGrupo(): Promise<Grupo | undefined> {
  return get<Grupo>(CLAVE_GRUPO)
}

export async function guardarGrupo(grupo: Grupo): Promise<void> {
  await set(CLAVE_GRUPO, grupo)
}

export async function cargarDatos(empresaId: ID): Promise<DatosOperativos | undefined> {
  return get<DatosOperativos>(claveDatos(empresaId))
}

export async function guardarDatos(empresaId: ID, datos: DatosOperativos): Promise<void> {
  await set(claveDatos(empresaId), datos)
}

export async function cargarConfig(empresaId: ID): Promise<Configuracion | undefined> {
  return get<Configuracion>(claveConfig(empresaId))
}

export async function guardarConfig(empresaId: ID, config: Configuracion): Promise<void> {
  await set(claveConfig(empresaId), config)
}

/** Borra por completo el espacio de una empresa (tras confirmación explícita). */
export async function borrarEspacioEmpresa(empresaId: ID): Promise<void> {
  await del(claveConfig(empresaId))
  await del(claveDatos(empresaId))
}

export async function cargarTema(): Promise<'claro' | 'oscuro' | undefined> {
  return get<'claro' | 'oscuro'>(CLAVE_TEMA)
}

export async function guardarTema(tema: 'claro' | 'oscuro'): Promise<void> {
  await set(CLAVE_TEMA, tema)
}

export async function borrarTodo(): Promise<void> {
  const todas = await keys()
  for (const k of todas) {
    if (typeof k === 'string' && k.startsWith('finanzas:')) await del(k)
  }
}

/**
 * Migración de la versión de una sola empresa: mueve `finanzas:configuracion` y
 * `finanzas:datos` al espacio de la primera empresa del grupo. Solo borra las
 * claves antiguas después de comprobar que las nuevas se han escrito bien: si
 * algo fallara, los datos originales siguen intactos.
 *
 * Devuelve la configuración y los datos legados si había algo que migrar.
 */
export async function migrarDesdeEmpresaUnica(
  empresaId: ID,
): Promise<{ config?: Configuracion; datos?: DatosOperativos } | undefined> {
  const config = await get<Configuracion>(CLAVE_CONFIG_LEGADO)
  const datos = await get<DatosOperativos>(CLAVE_DATOS_LEGADO)
  if (!config && !datos) return undefined

  if (config) await set(claveConfig(empresaId), config)
  if (datos) await set(claveDatos(empresaId), datos)

  // Verificación antes de borrar nada.
  const configOk = !config || (await get<Configuracion>(claveConfig(empresaId))) !== undefined
  const datosOk = !datos || (await get<DatosOperativos>(claveDatos(empresaId))) !== undefined
  if (configOk && datosOk) {
    await del(CLAVE_CONFIG_LEGADO)
    await del(CLAVE_DATOS_LEGADO)
  }
  return { config, datos }
}
