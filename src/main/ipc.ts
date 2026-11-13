import { ipcMain } from 'electron'
import { handlers } from './rpc'
import { exportarCopia, importarCopia } from './services/backup'
import {
  exportarCuadranteExcel,
  exportarResumenCentrosExcel,
  exportarRetribucionExcel,
  exportarCuadranteCentrosExcel,
  exportarListadoTrabajadoresExcel
} from './services/export-excel'
import {
  exportarCuadrantePdf,
  exportarResumenCentrosPdf,
  exportarCuadranteCentrosPdf,
  exportarListadoTrabajadoresPdf
} from './services/export-pdf'

/** Registra todos los manejadores IPC (datos compartidos + específicos de escritorio). */
export function registrarIpc(): void {
  // Canales de datos compartidos con el servidor web.
  for (const [canal, fn] of Object.entries(handlers)) {
    ipcMain.handle(canal, (_e, ...args) => fn(...args))
  }

  const h = ipcMain.handle.bind(ipcMain)

  // Exportación (con diálogos nativos: solo escritorio).
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
  h('export:retribucionExcel', (_e, empresaId: number) => exportarRetribucionExcel(empresaId))
  h('export:cuadranteCentrosPdf', (_e, empresaId: number, anio: number, mes: number, centroId?: number) =>
    exportarCuadranteCentrosPdf(empresaId, anio, mes, centroId)
  )
  h('export:cuadranteCentrosExcel', (_e, empresaId: number, anio: number, mes: number, centroId?: number) =>
    exportarCuadranteCentrosExcel(empresaId, anio, mes, centroId)
  )
  h('export:listadoTrabajadoresPdf', (_e, empresaId: number, filtro?: 'alta' | 'baja' | 'todos') =>
    exportarListadoTrabajadoresPdf(empresaId, filtro)
  )
  h('export:listadoTrabajadoresExcel', (_e, empresaId: number, filtro?: 'alta' | 'baja' | 'todos') =>
    exportarListadoTrabajadoresExcel(empresaId, filtro)
  )

  // Copias de seguridad (diálogos nativos: solo escritorio).
  h('backup:exportar', () => exportarCopia())
  h('backup:importar', () => importarCopia())
}
