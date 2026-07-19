import { ipcMain } from 'electron'
import { handlers } from './rpc'
import { exportarCopia, importarCopia } from './services/backup'
import {
  exportarCuadranteExcel,
  exportarResumenCentrosExcel,
  exportarRetribucionExcel
} from './services/export-excel'
import { exportarCuadrantePdf, exportarResumenCentrosPdf } from './services/export-pdf'

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

  // Copias de seguridad (diálogos nativos: solo escritorio).
  h('backup:exportar', () => exportarCopia())
  h('backup:importar', () => importarCopia())
}
