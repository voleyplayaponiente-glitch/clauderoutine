// Generación de libros Excel (electron-free): devuelven un Buffer.
// Lo usan tanto la exportación de escritorio (guarda a fichero) como el servidor
// web (lo envía como descarga).
import ExcelJS from 'exceljs'
import { datosCuadrante, datosResumenCentros, datosCuadranteCentros } from './export-data'
import { empresas, trabajadores } from '../db/repos'
import { calcRetribucion } from '../../shared/calculos'
import { DIAS_SEMANA, DIAS_SEMANA_CORTO, MESES, isoALocal, diaSemanaIso } from '../../shared/fechas'
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
    // Centro y horario solo cuando trabaja; en Libre/Vacaciones/etc. se dejan vacíos.
    const trabaja = t.situacion === 'trabaja'
    ws.addRow([
      Number(t.fecha.slice(-2)),
      isoALocal(t.fecha),
      DIAS_SEMANA[t.dia_semana],
      SITUACIONES[t.situacion] ?? t.situacion,
      trabaja && t.centro_id ? d.centrosPorId[t.centro_id]?.nombre ?? '' : '',
      trabaja ? horario(t) : '',
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
    { key: 'ss', width: 16 },
    { key: 'neto', width: 15 }
  ]
  ws.mergeCells('A1:P1')
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
    'Seguridad Social',
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
      n2(r.totalSeguridadSocial),
      n2(r.neto)
    ])
  }
  return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer)
}

/** Calendario mensual por centros (la vista por centro), con cada trabajador en su color. */
export async function bufferCuadranteCentrosExcel(
  empresaId: number,
  anio: number,
  mes: number,
  centroId?: number
): Promise<Buffer> {
  const d = datosCuadranteCentros(empresaId, anio, mes, centroId)
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Cuadrante por centros', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  })

  ws.columns = [
    { key: 'dia', width: 10 },
    ...d.centros.map((c) => ({ key: `c${c.id}`, width: 42 }))
  ]

  ws.mergeCells(1, 1, 1, d.centros.length + 1)
  ws.getCell('A1').value = `${d.empresa.razon_social} — Cuadrante mensual por centros — ${MESES[mes - 1]} ${anio}`
  ws.getCell('A1').font = { bold: true, size: 13 }

  const cab = ws.addRow(['Día', ...d.centros.map((c) => c.nombre)])
  cab.font = { bold: true }
  cab.alignment = { vertical: 'middle', wrapText: true }

  const mm = String(mes).padStart(2, '0')
  const totalDias = new Date(anio, mes, 0).getDate()
  for (let dia = 1; dia <= totalDias; dia++) {
    const fecha = `${anio}-${mm}-${String(dia).padStart(2, '0')}`
    const dw = diaSemanaIso(fecha)
    const finde = dw === 0 || dw === 6
    const fila = ws.addRow([`${dia} ${DIAS_SEMANA_CORTO[dw]}`])
    fila.alignment = { vertical: 'top', wrapText: true }
    d.centros.forEach((c, i) => {
      const lst = d.porDiaCentro.get(`${fecha}|${c.id}`) ?? []
      if (!lst.length) return
      // Texto enriquecido: el nombre de cada trabajador en su color, horario al lado.
      const richText: ExcelJS.RichText[] = []
      lst.forEach((t, j) => {
        const info = d.trabajadoresPorId[t.trabajador_id]
        const horas = [
          t.entrada1 && t.salida1 ? `${t.entrada1}–${t.salida1}` : '',
          t.entrada2 && t.salida2 ? `${t.entrada2}–${t.salida2}` : ''
        ]
          .filter(Boolean)
          .join(' / ')
        richText.push({
          text: (j > 0 ? '\n' : '') + (info?.nombre ?? '?'),
          font: { bold: true, color: { argb: 'FF' + (info?.color ?? '#57534e').slice(1).toUpperCase() } }
        })
        richText.push({ text: `  ${horas}`, font: { color: { argb: 'FF444444' } } })
      })
      fila.getCell(i + 2).value = { richText }
    })
    if (finde) {
      for (let col = 1; col <= d.centros.length + 1; col++) {
        fila.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
      }
    }
  }

  const tot = ws.addRow([
    'TOTAL h',
    ...d.centros.map((c) => Number((d.horasPorCentro[c.id] ?? 0).toFixed(2)))
  ])
  tot.font = { bold: true }

  // Bordes finos en toda la tabla
  for (let r = 2; r <= ws.rowCount; r++) {
    for (let col = 1; col <= d.centros.length + 1; col++) {
      ws.getRow(r).getCell(col).border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      }
    }
  }

  return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer)
}
