// Generación de libros Excel (electron-free): devuelven un Buffer.
// Lo usan tanto la exportación de escritorio (guarda a fichero) como el servidor
// web (lo envía como descarga).
import ExcelJS from 'exceljs'
import { datosCuadrante, datosResumenCentros } from './export-data'
import { empresas, trabajadores } from '../db/repos'
import { calcRetribucion } from '../../shared/calculos'
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

export async function bufferCuadranteExcel(
  trabajadorId: number,
  anio: number,
  mes: number
): Promise<Buffer> {
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

  return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer)
}

export async function bufferResumenCentrosExcel(
  empresaId: number,
  anio: number,
  mes: number
): Promise<Buffer> {
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

  return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer)
}

export async function bufferRetribucionExcel(empresaId: number): Promise<Buffer> {
  const empresa = empresas.obtener(empresaId)
  const lista = trabajadores.listar({ empresaId })
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Retribuciones')
  ws.columns = [
    { key: 'cod', width: 10 },
    { key: 'trab', width: 26 },
    { key: 'tipo', width: 11 },
    { key: 'base', width: 14 },
    { key: 'plus', width: 15 },
    { key: 'transp', width: 14 },
    { key: 'prorr', width: 16 },
    { key: 'espsuj', width: 18 },
    { key: 'espexe', width: 20 },
    { key: 'devengado', width: 15 },
    { key: 'irpf', width: 9 },
    { key: 'retirpf', width: 15 },
    { key: 'dedesp', width: 16 },
    { key: 'dedsalud', width: 18 },
    { key: 'neto', width: 15 }
  ]
  ws.mergeCells('A1:O1')
  ws.getCell('A1').value = `${empresa?.razon_social ?? ''} — Retribuciones mensuales (€)`
  ws.getCell('A1').font = { bold: true, size: 13 }
  const hr = ws.addRow([
    'Código',
    'Trabajador',
    'Tipo',
    'Salario base',
    'Plus productividad',
    'Plus transporte',
    'Prorrateo 3 pagas',
    'Especie sujeta IRPF',
    'Especie exenta (seguro)',
    'Total devengado',
    'IRPF %',
    'Retención IRPF',
    'Deduc. especie',
    'Deduc. seguro salud',
    'Neto a percibir'
  ])
  hr.font = { bold: true }
  const n2 = (v: number): number => Number((v || 0).toFixed(2))
  for (const t of lista) {
    const r = calcRetribucion(t)
    ws.addRow([
      t.codigo,
      `${t.apellidos}, ${t.nombre}`,
      t.tipo === 'ajena' ? 'Ajena' : 'Autónomo',
      n2(t.sueldo_convenio_completo),
      n2(t.plus_productividad),
      n2(t.plus_transporte),
      n2(r.prorrateoPagas),
      n2(t.retribucion_especie),
      n2(t.retribucion_especie_exenta),
      n2(r.totalDevengado),
      n2(t.irpf),
      n2(r.retencionIrpf),
      n2(t.deduccion_especie),
      n2(t.deduccion_seguro_salud),
      n2(r.neto)
    ])
  }
  return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer)
}
