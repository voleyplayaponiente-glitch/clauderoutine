import ExcelJS from 'exceljs'
import { dialog } from 'electron'
import { datosCuadrante, datosResumenCentros } from './export-data'
import { DIAS_SEMANA, MESES, isoALocal } from '../../shared/fechas'
import type { Turno } from '../../shared/types'

const SITUACIONES: Record<string, string> = {
  trabaja: 'Trabaja',
  libre: 'Libre',
  vacaciones: 'Vacaciones',
  baja: 'Baja',
  festivo: 'Festivo',
  permiso: 'Permiso'
}

function horario(t: Turno): string {
  const tr: string[] = []
  if (t.entrada1 && t.salida1) tr.push(`${t.entrada1}–${t.salida1}`)
  if (t.entrada2 && t.salida2) tr.push(`${t.entrada2}–${t.salida2}`)
  return tr.join('  /  ')
}

export async function exportarCuadranteExcel(trabajadorId: number, anio: number, mes: number) {
  const d = datosCuadrante(trabajadorId, anio, mes)
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(`${MESES[mes - 1]} ${anio}`)

  ws.columns = [
    { key: 'dia', width: 6 },
    { key: 'fecha', width: 14 },
    { key: 'diasem', width: 12 },
    { key: 'situacion', width: 12 },
    { key: 'centro', width: 22 },
    { key: 'horario', width: 22 },
    { key: 'horas', width: 8 }
  ]

  ws.mergeCells('A1:G1')
  ws.getCell('A1').value = d.empresa.razon_social
  ws.getCell('A1').font = { bold: true, size: 14 }
  ws.mergeCells('A2:G2')
  ws.getCell('A2').value = `Cuadrante horario — ${MESES[mes - 1]} ${anio}`
  ws.getCell('A2').font = { bold: true, size: 12 }
  ws.mergeCells('A3:G3')
  ws.getCell('A3').value = `Trabajador/a: ${d.trabajador.nombre} ${d.trabajador.apellidos}  ·  DNI/NIE: ${d.trabajador.dni_nie}`

  const headerRow = ws.addRow(['Día', 'Fecha', 'Día semana', 'Situación', 'Centro', 'Horario', 'Horas'])
  headerRow.font = { bold: true }
  headerRow.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }
    c.border = { bottom: { style: 'thin' } }
  })

  for (const t of d.turnos) {
    const h = d.horasDiaFn(t)
    ws.addRow([
      Number(t.fecha.slice(-2)),
      isoALocal(t.fecha),
      DIAS_SEMANA[t.dia_semana],
      SITUACIONES[t.situacion] ?? t.situacion,
      t.centro_id ? d.centrosPorId[t.centro_id]?.nombre ?? '' : '',
      horario(t),
      h > 0 ? Number(h.toFixed(2)) : ''
    ])
  }

  const total = ws.addRow(['', '', '', '', '', 'TOTAL', Number(d.resumen.horasRealizadas.toFixed(2))])
  total.font = { bold: true }

  ws.addRow([])
  ws.addRow(['', '', '', '', 'Media mensual teórica', '', Number(d.resumen.mediaMensualTeorica.toFixed(2))])
  ws.addRow(['', '', '', '', 'Horas contratadas (mes)', '', Number(d.resumen.horasContratadasMes.toFixed(2))])
  ws.addRow(['', '', '', '', 'Desviación vs. media', '', Number(d.resumen.desviacionVsMedia.toFixed(2))])
  if (d.trabajador.tipo === 'ajena') {
    ws.addRow(['', '', '', '', 'Horas complementarias', '', Number(d.resumen.horasComplementarias.toFixed(2))])
    ws.addRow(['', '', '', '', 'Valor complementarias (€)', '', Number(d.resumen.valorComplementarias.toFixed(2))])
  }

  const res = await dialog.showSaveDialog({
    title: 'Guardar cuadrante en Excel',
    defaultPath: `cuadrante-${d.trabajador.apellidos}-${anio}-${String(mes).padStart(2, '0')}.xlsx`,
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  })
  if (res.canceled || !res.filePath) return { ok: false }
  await wb.xlsx.writeFile(res.filePath)
  return { ok: true, ruta: res.filePath }
}

export async function exportarResumenCentrosExcel(empresaId: number, anio: number, mes: number) {
  const d = datosResumenCentros(empresaId, anio, mes)
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Resumen por centro')
  ws.columns = [
    { key: 'codigo', width: 12 },
    { key: 'centro', width: 28 },
    { key: 'trab', width: 14 },
    { key: 'horas', width: 12 }
  ]
  ws.mergeCells('A1:D1')
  ws.getCell('A1').value = `${d.empresa.razon_social} — Resumen de horas por centro — ${MESES[mes - 1]} ${anio}`
  ws.getCell('A1').font = { bold: true, size: 13 }
  const hr = ws.addRow(['Código', 'Centro', 'Nº trabajadores', 'Horas'])
  hr.font = { bold: true }
  for (const f of d.filas) {
    ws.addRow([f.centro.codigo, f.centro.nombre, f.trabajadores, Number(f.horas.toFixed(2))])
  }
  const tot = ws.addRow(['', 'TOTAL', '', Number(d.totalHoras.toFixed(2))])
  tot.font = { bold: true }

  const res = await dialog.showSaveDialog({
    title: 'Guardar resumen por centro',
    defaultPath: `resumen-centros-${anio}-${String(mes).padStart(2, '0')}.xlsx`,
    filters: [{ name: 'Excel', extensions: ['xlsx'] }]
  })
  if (res.canceled || !res.filePath) return { ok: false }
  await wb.xlsx.writeFile(res.filePath)
  return { ok: true, ruta: res.filePath }
}
