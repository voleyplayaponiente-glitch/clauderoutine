import { contextBridge, ipcRenderer } from 'electron'
import type {
  Empresa,
  NuevaEmpresa,
  Centro,
  NuevoCentro,
  Festivo,
  Trabajador,
  NuevoTrabajador,
  TrabajadorCentro,
  Cuadrante,
  Turno,
  ResultadoOperacion
} from '../shared/types'
import type { ApiGestor, FiltroTrabajadores } from '../shared/api'

const inv = ipcRenderer.invoke.bind(ipcRenderer)

export const api: ApiGestor = {
  empresas: {
    listar: (): Promise<Empresa[]> => inv('empresas:listar'),
    obtener: (id: number): Promise<Empresa | undefined> => inv('empresas:obtener', id),
    crear: (d: NuevaEmpresa): Promise<Empresa> => inv('empresas:crear', d),
    actualizar: (id: number, d: NuevaEmpresa): Promise<Empresa> => inv('empresas:actualizar', id, d),
    borrar: (id: number): Promise<void> => inv('empresas:borrar', id)
  },
  centros: {
    listar: (empresaId?: number): Promise<Centro[]> => inv('centros:listar', empresaId),
    obtener: (id: number): Promise<Centro | undefined> => inv('centros:obtener', id),
    crear: (d: NuevoCentro): Promise<Centro> => inv('centros:crear', d),
    actualizar: (id: number, d: NuevoCentro): Promise<Centro> => inv('centros:actualizar', id, d),
    borrar: (id: number): Promise<void> => inv('centros:borrar', id)
  },
  festivos: {
    listar: (centroId: number): Promise<Festivo[]> => inv('festivos:listar', centroId),
    listarEmpresa: (empresaId: number): Promise<Festivo[]> => inv('festivos:listarEmpresa', empresaId),
    crear: (centroId: number, fecha: string, desc: string): Promise<Festivo> =>
      inv('festivos:crear', centroId, fecha, desc),
    borrar: (id: number): Promise<void> => inv('festivos:borrar', id)
  },
  trabajadores: {
    listar: (f: FiltroTrabajadores = {}): Promise<Trabajador[]> => inv('trabajadores:listar', f),
    obtener: (id: number): Promise<Trabajador | undefined> => inv('trabajadores:obtener', id),
    crear: (d: NuevoTrabajador): Promise<Trabajador> => inv('trabajadores:crear', d),
    actualizar: (id: number, d: NuevoTrabajador): Promise<Trabajador> =>
      inv('trabajadores:actualizar', id, d),
    borrar: (id: number): Promise<void> => inv('trabajadores:borrar', id),
    centrosDe: (id: number): Promise<TrabajadorCentro[]> => inv('trabajadores:centrosDe', id),
    fijarCentros: (
      id: number,
      asignaciones: Array<{ centro_id: number; es_principal: boolean }>
    ): Promise<void> => inv('trabajadores:fijarCentros', id, asignaciones)
  },
  cuadrante: {
    obtenerOCrear: (trabId: number, anio: number, mes: number): Promise<Cuadrante> =>
      inv('cuadrante:obtenerOCrear', trabId, anio, mes),
    turnos: (cuadranteId: number): Promise<Turno[]> => inv('cuadrante:turnos', cuadranteId),
    guardarTurno: (t: Turno): Promise<Turno> => inv('cuadrante:guardarTurno', t),
    guardarTurnos: (lista: Turno[]): Promise<void> => inv('cuadrante:guardarTurnos', lista),
    fijarEntrega: (cuadranteId: number, fecha: string | null): Promise<void> =>
      inv('cuadrante:fijarEntrega', cuadranteId, fecha),
    turnosMesEmpresa: (
      empresaId: number,
      anio: number,
      mes: number
    ): Promise<Array<Turno & { trabajador_id: number }>> =>
      inv('cuadrante:turnosMesEmpresa', empresaId, anio, mes)
  },
  exportar: {
    cuadrantePdf: (trabId: number, anio: number, mes: number): Promise<ResultadoOperacion> =>
      inv('export:cuadrantePdf', trabId, anio, mes),
    cuadranteExcel: (trabId: number, anio: number, mes: number): Promise<ResultadoOperacion> =>
      inv('export:cuadranteExcel', trabId, anio, mes),
    resumenPdf: (empresaId: number, anio: number, mes: number): Promise<ResultadoOperacion> =>
      inv('export:resumenPdf', empresaId, anio, mes),
    resumenExcel: (empresaId: number, anio: number, mes: number): Promise<ResultadoOperacion> =>
      inv('export:resumenExcel', empresaId, anio, mes)
  },
  backup: {
    exportar: (): Promise<ResultadoOperacion> => inv('backup:exportar'),
    importar: (): Promise<ResultadoOperacion> => inv('backup:importar')
  },
  app: {
    rutaBaseDatos: (): Promise<string> => inv('app:rutaBaseDatos')
  }
}

export type { ApiGestor } from '../shared/api'

contextBridge.exposeInMainWorld('api', api)
