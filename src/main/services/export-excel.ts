// Exportación Excel de escritorio: genera el buffer y lo guarda con un diálogo.
import { dialog } from 'electron'
import { writeFile } from 'fs/promises'
import { bufferCuadranteExcel, bufferResumenCentrosExcel, bufferRetribucionExcel } from './generate-excel'
import { datosCuadrante } from './export-data'

export async function exportarCuadranteExcel(trabajadorId: number, anio: number, mes: number) {
  const d = datosCuadrante(trabajadorId, anio, mes)
  const res = await dialog.showSaveDialog({
    title: 'Guardar cuadrante en Excel',
    defaultPath: `cuadrante-${d.trabajador.apellidos}-${anio}-${String(mes).padStart(2, '0')}.xlsx`,
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  })
  if (res.canceled || !res.filePath) return { ok: false }
  await writeFile(res.filePath, await bufferCuadranteExcel(trabajadorId, anio, mes))
  return { ok: true, ruta: res.filePath }
}

export async function exportarResumenCentrosExcel(empresaId: number, anio: number, mes: number) {
  const res = await dialog.showSaveDialog({
    title: 'Guardar resumen por centro',
    defaultPath: `resumen-centros-${anio}-${String(mes).padStart(2, '0')}.xlsx`,
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  })
  if (res.canceled || !res.filePath) return { ok: false }
  await writeFile(res.filePath, await bufferResumenCentrosExcel(empresaId, anio, mes))
  return { ok: true, ruta: res.filePath }
}

export async function exportarRetribucionExcel(empresaId: number) {
  const res = await dialog.showSaveDialog({
    title: 'Guardar retribuciones en Excel',
    defaultPath: `retribuciones.xlsx`,
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  })
  if (res.canceled || !res.filePath) return { ok: false }
  await writeFile(res.filePath, await bufferRetribucionExcel(empresaId))
  return { ok: true, ruta: res.filePath }
}
