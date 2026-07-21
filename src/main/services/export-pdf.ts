// Exportación PDF de escritorio: imprime el HTML compartido con printToPDF.
import { BrowserWindow, dialog } from 'electron'
import { writeFileSync } from 'fs'
import { datosCuadrante } from './export-data'
import { htmlCuadrante, htmlResumenCentros, htmlCuadranteCentros } from './html-docs'

async function generarPdf(html: string, defaultName: string) {
  const res = await dialog.showSaveDialog({
    title: 'Guardar PDF',
    defaultPath: defaultName,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  })
  if (res.canceled || !res.filePath) return { ok: false }

  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } })
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      margins: { marginType: 'default' },
      pageSize: 'A4'
    })
    writeFileSync(res.filePath, pdf)
    return { ok: true, ruta: res.filePath }
  } finally {
    win.destroy()
  }
}

export function exportarCuadrantePdf(trabajadorId: number, anio: number, mes: number) {
  const d = datosCuadrante(trabajadorId, anio, mes)
  const name = `cuadrante-${d.trabajador.apellidos}-${anio}-${String(mes).padStart(2, '0')}.pdf`
  return generarPdf(htmlCuadrante(trabajadorId, anio, mes), name)
}

export function exportarResumenCentrosPdf(empresaId: number, anio: number, mes: number) {
  return generarPdf(
    htmlResumenCentros(empresaId, anio, mes),
    `resumen-centros-${anio}-${String(mes).padStart(2, '0')}.pdf`
  )
}

export function exportarCuadranteCentrosPdf(empresaId: number, anio: number, mes: number) {
  const html = htmlCuadranteCentros(empresaId, anio, mes)
  return generarPdf(html, `cuadrante-centros-${anio}-${String(mes).padStart(2, '0')}.pdf`)
}
