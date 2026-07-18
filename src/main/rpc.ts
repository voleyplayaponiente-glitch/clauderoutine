// Tabla de manejadores de datos (electron-free) compartida por el IPC de
// escritorio y por el servidor web. Cada clave es un "canal" namespace:método.
import { empresas, centros, festivos, trabajadores, cuadrantes } from './db/repos'
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
