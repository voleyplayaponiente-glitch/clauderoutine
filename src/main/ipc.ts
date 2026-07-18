import { ipcMain } from 'electron'
import { empresas, centros, festivos, trabajadores, cuadrantes } from './db/repos'
import { rutaBaseDatos } from './db/database'
import { exportarCopia, importarCopia } from './services/backup'
import { exportarCuadranteExcel, exportarResumenCentrosExcel } from './services/export-excel'
import { exportarCuadrantePdf, exportarResumenCentrosPdf } from './services/export-pdf'
import type { NuevaEmpresa, NuevoCentro, NuevoTrabajador, Turno } from '../shared/types'
import type { FiltroTrabajadores } from './db/repos'

/** Registra todos los manejadores IPC. Cada uno envuelve una operación del repositorio. */
export function registrarIpc(): void {
  const h = ipcMain.handle.bind(ipcMain)

  // Empresas
  h('empresas:listar', () => empresas.listar())
  h('empresas:obtener', (_e, id: number) => empresas.obtener(id))
  h('empresas:crear', (_e, data: NuevaEmpresa) => empresas.crear(data))
  h('empresas:actualizar', (_e, id: number, data: NuevaEmpresa) => empresas.actualizar(id, data))
  h('empresas:borrar', (_e, id: number) => empresas.borrar(id))

  // Centros
  h('centros:listar', (_e, empresaId?: number) => centros.listar(empresaId))
  h('centros:obtener', (_e, id: number) => centros.obtener(id))
  h('centros:crear', (_e, data: NuevoCentro) => centros.crear(data))
  h('centros:actualizar', (_e, id: number, data: NuevoCentro) => centros.actualizar(id, data))
  h('centros:borrar', (_e, id: number) => centros.borrar(id))

  // Festivos
  h('festivos:listar', (_e, centroId: number) => festivos.listar(centroId))
  h('festivos:listarEmpresa', (_e, empresaId: number) => festivos.listarPorEmpresa(empresaId))
  h('festivos:crear', (_e, centroId: number, fecha: string, desc: string) =>
    festivos.crear(centroId, fecha, desc)
  )
  h('festivos:borrar', (_e, id: number) => festivos.borrar(id))

  // Trabajadores
  h('trabajadores:listar', (_e, f: FiltroTrabajadores) => trabajadores.listar(f))
  h('trabajadores:obtener', (_e, id: number) => trabajadores.obtener(id))
  h('trabajadores:crear', (_e, data: NuevoTrabajador) => trabajadores.crear(data))
  h('trabajadores:actualizar', (_e, id: number, data: NuevoTrabajador) =>
    trabajadores.actualizar(id, data)
  )
  h('trabajadores:borrar', (_e, id: number) => trabajadores.borrar(id))
  h('trabajadores:centrosDe', (_e, id: number) => trabajadores.centrosDe(id))
  h(
    'trabajadores:fijarCentros',
    (_e, id: number, asignaciones: Array<{ centro_id: number; es_principal: boolean }>) =>
      trabajadores.fijarCentros(id, asignaciones)
  )

  // Cuadrantes
  h('cuadrante:obtenerOCrear', (_e, trabId: number, anio: number, mes: number) =>
    cuadrantes.obtenerOCrear(trabId, anio, mes)
  )
  h('cuadrante:turnos', (_e, cuadranteId: number) => cuadrantes.turnos(cuadranteId))
  h('cuadrante:guardarTurno', (_e, t: Turno) => cuadrantes.guardarTurno(t))
  h('cuadrante:guardarTurnos', (_e, lista: Turno[]) => cuadrantes.guardarTurnos(lista))
  h('cuadrante:fijarEntrega', (_e, cuadranteId: number, fecha: string | null) =>
    cuadrantes.fijarFechaEntrega(cuadranteId, fecha)
  )
  h('cuadrante:turnosMesEmpresa', (_e, empresaId: number, anio: number, mes: number) =>
    cuadrantes.turnosMesEmpresa(empresaId, anio, mes)
  )

  // Exportación
  h('export:cuadrantePdf', (_e, trabId: number, anio: number, mes: number) =>
    exportarCuadrantePdf(trabId, anio, mes)
  )
  h('export:cuadranteExcel', (_e, trabId: number, anio: number, mes: number) =>
    exportarCuadranteExcel(trabId, anio, mes)
  )
  h('export:resumenPdf', (_e, empresaId: number, anio: number, mes: number) =>
    exportarResumenCentrosPdf(empresaId, anio, mes)
  )
  h('export:resumenExcel', (_e, empresaId: number, anio: number, mes: number) =>
    exportarResumenCentrosExcel(empresaId, anio, mes)
  )

  // Copias de seguridad
  h('backup:exportar', () => exportarCopia())
  h('backup:importar', () => importarCopia())

  // Utilidades
  h('app:rutaBaseDatos', () => rutaBaseDatos())
}
