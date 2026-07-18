// Interfaz de la API expuesta a la interfaz (window.api). La implementan dos
// backends: el preload de Electron (IPC) y el cliente web (fetch). Definirla aquí,
// en el motor compartido, permite tipar ambos sin dependencias cruzadas.
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
} from './types'

export interface FiltroTrabajadores {
  empresaId?: number
  centroId?: number
  tipo?: string
  texto?: string
}

export interface ApiGestor {
  empresas: {
    listar(): Promise<Empresa[]>
    obtener(id: number): Promise<Empresa | undefined>
    crear(d: NuevaEmpresa): Promise<Empresa>
    actualizar(id: number, d: NuevaEmpresa): Promise<Empresa>
    borrar(id: number): Promise<void>
  }
  centros: {
    listar(empresaId?: number): Promise<Centro[]>
    obtener(id: number): Promise<Centro | undefined>
    crear(d: NuevoCentro): Promise<Centro>
    actualizar(id: number, d: NuevoCentro): Promise<Centro>
    borrar(id: number): Promise<void>
  }
  festivos: {
    listar(centroId: number): Promise<Festivo[]>
    listarEmpresa(empresaId: number): Promise<Festivo[]>
    crear(centroId: number, fecha: string, desc: string): Promise<Festivo>
    borrar(id: number): Promise<void>
  }
  trabajadores: {
    listar(f?: FiltroTrabajadores): Promise<Trabajador[]>
    obtener(id: number): Promise<Trabajador | undefined>
    crear(d: NuevoTrabajador): Promise<Trabajador>
    actualizar(id: number, d: NuevoTrabajador): Promise<Trabajador>
    borrar(id: number): Promise<void>
    centrosDe(id: number): Promise<TrabajadorCentro[]>
    fijarCentros(
      id: number,
      asignaciones: Array<{ centro_id: number; es_principal: boolean }>
    ): Promise<void>
  }
  cuadrante: {
    obtenerOCrear(trabId: number, anio: number, mes: number): Promise<Cuadrante>
    turnos(cuadranteId: number): Promise<Turno[]>
    guardarTurno(t: Turno): Promise<Turno>
    guardarTurnos(lista: Turno[]): Promise<void>
    fijarEntrega(cuadranteId: number, fecha: string | null): Promise<void>
    turnosMesEmpresa(
      empresaId: number,
      anio: number,
      mes: number
    ): Promise<Array<Turno & { trabajador_id: number }>>
  }
  exportar: {
    cuadrantePdf(trabId: number, anio: number, mes: number): Promise<ResultadoOperacion>
    cuadranteExcel(trabId: number, anio: number, mes: number): Promise<ResultadoOperacion>
    resumenPdf(empresaId: number, anio: number, mes: number): Promise<ResultadoOperacion>
    resumenExcel(empresaId: number, anio: number, mes: number): Promise<ResultadoOperacion>
  }
  backup: {
    exportar(): Promise<ResultadoOperacion>
    importar(): Promise<ResultadoOperacion>
  }
  app: {
    rutaBaseDatos(): Promise<string>
  }
}
