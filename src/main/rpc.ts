// Tabla de manejadores de datos (electron-free) compartida por el IPC de
// escritorio y por el servidor web. Cada clave es un "canal" namespace:método.
import { empresas, centros, festivos, trabajadores, cuadrantes, vacaciones } from './db/repos'
import { rutaBaseDatos } from './db/database'
import type { FiltroTrabajadores } from './db/repos'
import type { NuevaEmpresa, NuevoCentro, NuevoTrabajador, Turno } from '../shared/types'

export type Manejador = (...args: any[]) => unknown

export const handlers: Record<string, Manejador> = {
  // Empresas
  'empresas:listar': () => empresas.listar(),
  'empresas:obtener': (id: number) => empresas.obtener(id),
  'empresas:crear': (data: NuevaEmpresa) => empresas.crear(data),
  'empresas:actualizar': (id: number, data: NuevaEmpresa) => empresas.actualizar(id, data),
  'empresas:borrar': (id: number) => empresas.borrar(id),

  // Centros
  'centros:listar': (empresaId?: number) => centros.listar(empresaId),
  'centros:obtener': (id: number) => centros.obtener(id),
  'centros:crear': (data: NuevoCentro) => centros.crear(data),
  'centros:actualizar': (id: number, data: NuevoCentro) => centros.actualizar(id, data),
  'centros:borrar': (id: number) => centros.borrar(id),

  // Festivos
  'festivos:listar': (centroId: number) => festivos.listar(centroId),
  'festivos:listarEmpresa': (empresaId: number) => festivos.listarPorEmpresa(empresaId),
  'festivos:crear': (centroId: number, fecha: string, desc: string) =>
    festivos.crear(centroId, fecha, desc),
  'festivos:borrar': (id: number) => festivos.borrar(id),

  // Trabajadores
  'trabajadores:listar': (f: FiltroTrabajadores) => trabajadores.listar(f),
  'trabajadores:obtener': (id: number) => trabajadores.obtener(id),
  'trabajadores:crear': (data: NuevoTrabajador) => trabajadores.crear(data),
  'trabajadores:actualizar': (id: number, data: NuevoTrabajador) => trabajadores.actualizar(id, data),
  'trabajadores:borrar': (id: number) => trabajadores.borrar(id),
  'trabajadores:centrosDe': (id: number) => trabajadores.centrosDe(id),
  'trabajadores:fijarCentros': (
    id: number,
    asignaciones: Array<{ centro_id: number; es_principal: boolean }>
  ) => trabajadores.fijarCentros(id, asignaciones),

  // Vacaciones (días disfrutados)
  'vacaciones:listar': (trabajadorId: number) => vacaciones.listar(trabajadorId),
  'vacaciones:fijar': (trabajadorId: number, fechas: string[]) =>
    vacaciones.fijar(trabajadorId, fechas),

  // Cuadrantes
  'cuadrante:obtenerOCrear': (trabId: number, anio: number, mes: number) =>
    cuadrantes.obtenerOCrear(trabId, anio, mes),
  'cuadrante:turnos': (cuadranteId: number) => cuadrantes.turnos(cuadranteId),
  'cuadrante:guardarTurno': (t: Turno) => cuadrantes.guardarTurno(t),
  'cuadrante:guardarTurnos': (lista: Turno[]) => cuadrantes.guardarTurnos(lista),
  'cuadrante:fijarEntrega': (cuadranteId: number, fecha: string | null) =>
    cuadrantes.fijarFechaEntrega(cuadranteId, fecha),
  'cuadrante:turnosMesEmpresa': (empresaId: number, anio: number, mes: number) =>
    cuadrantes.turnosMesEmpresa(empresaId, anio, mes),

  // Utilidades
  'app:rutaBaseDatos': () => rutaBaseDatos()
}

// --------------------------------------------------------------------------
// Validación ligera de argumentos por canal (defensa en profundidad para el
// servidor web: el IPC de escritorio ya es de confianza). Tipos admitidos:
//   num   número finito            num?  número o ausente
//   str   cadena                   str0  cadena o null
//   obj   objeto (no array)        obj?  objeto o ausente
//   arr   array
type TipoArg = 'num' | 'num?' | 'str' | 'str0' | 'obj' | 'obj?' | 'arr'

const FIRMAS: Record<string, TipoArg[]> = {
  'empresas:listar': [],
  'empresas:obtener': ['num'],
  'empresas:crear': ['obj'],
  'empresas:actualizar': ['num', 'obj'],
  'empresas:borrar': ['num'],
  'centros:listar': ['num?'],
  'centros:obtener': ['num'],
  'centros:crear': ['obj'],
  'centros:actualizar': ['num', 'obj'],
  'centros:borrar': ['num'],
  'festivos:listar': ['num'],
  'festivos:listarEmpresa': ['num'],
  'festivos:crear': ['num', 'str', 'str'],
  'festivos:borrar': ['num'],
  'trabajadores:listar': ['obj?'],
  'trabajadores:obtener': ['num'],
  'trabajadores:crear': ['obj'],
  'trabajadores:actualizar': ['num', 'obj'],
  'trabajadores:borrar': ['num'],
  'trabajadores:centrosDe': ['num'],
  'trabajadores:fijarCentros': ['num', 'arr'],
  'vacaciones:listar': ['num'],
  'vacaciones:fijar': ['num', 'arr'],
  'cuadrante:obtenerOCrear': ['num', 'num', 'num'],
  'cuadrante:turnos': ['num'],
  'cuadrante:guardarTurno': ['obj'],
  'cuadrante:guardarTurnos': ['arr'],
  'cuadrante:fijarEntrega': ['num', 'str0'],
  'cuadrante:turnosMesEmpresa': ['num', 'num', 'num'],
  'app:rutaBaseDatos': []
}

function tipoValido(v: unknown, t: TipoArg): boolean {
  switch (t) {
    case 'num':
      return typeof v === 'number' && Number.isFinite(v)
    case 'num?':
      return v == null || (typeof v === 'number' && Number.isFinite(v))
    case 'str':
      return typeof v === 'string'
    case 'str0':
      return v === null || typeof v === 'string'
    case 'obj':
      return typeof v === 'object' && v !== null && !Array.isArray(v)
    case 'obj?':
      return v == null || (typeof v === 'object' && !Array.isArray(v))
    case 'arr':
      return Array.isArray(v)
  }
}

/** Devuelve un mensaje de error si los argumentos no encajan con el canal, o null si son válidos. */
export function validarArgs(channel: string, args: unknown[]): string | null {
  const firma = FIRMAS[channel]
  if (!firma) return `Canal desconocido: ${channel}`
  if (args.length > firma.length) return `Demasiados argumentos para ${channel}`
  for (let i = 0; i < firma.length; i++) {
    if (!tipoValido(args[i], firma[i])) {
      return `Argumento ${i + 1} de ${channel} no es válido`
    }
  }
  return null
}
