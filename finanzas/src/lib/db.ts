/**
 * Persistencia local con IndexedDB (idb-keyval). Todo queda en el dispositivo;
 * offline-first. La exportación completa en JSON (Fase 10) garantiza que nunca
 * haya dependencia del proveedor.
 */
import { get, set, del } from 'idb-keyval'
import type { Configuracion, DatosOperativos } from '../dominio/tipos'

const CLAVE_CONFIG = 'finanzas:configuracion'
const CLAVE_TEMA = 'finanzas:tema'
const CLAVE_DATOS = 'finanzas:datos'

export async function cargarDatos(): Promise<DatosOperativos | undefined> {
  return get<DatosOperativos>(CLAVE_DATOS)
}

export async function guardarDatos(datos: DatosOperativos): Promise<void> {
  await set(CLAVE_DATOS, datos)
}

export async function cargarConfig(): Promise<Configuracion | undefined> {
  return get<Configuracion>(CLAVE_CONFIG)
}

export async function guardarConfig(config: Configuracion): Promise<void> {
  await set(CLAVE_CONFIG, config)
}

export async function cargarTema(): Promise<'claro' | 'oscuro' | undefined> {
  return get<'claro' | 'oscuro'>(CLAVE_TEMA)
}

export async function guardarTema(tema: 'claro' | 'oscuro'): Promise<void> {
  await set(CLAVE_TEMA, tema)
}

export async function borrarTodo(): Promise<void> {
  await del(CLAVE_CONFIG)
  await del(CLAVE_TEMA)
  await del(CLAVE_DATOS)
}
