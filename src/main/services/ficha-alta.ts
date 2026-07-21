// Ficha de alta de trabajador en Excel: se genera una plantilla rellenable
// (para dársela al trabajador nuevo) y se puede volver a subir para crear el
// alta precargada en la aplicación. La lectura busca las etiquetas en la
// columna B y el valor en la C, así tolera que se muevan filas.
import ExcelJS from 'exceljs'
import type { NuevoTrabajador } from '../../shared/types'

// etiqueta visible → campo del trabajador
const CAMPOS: Array<{ etiqueta: string; campo: keyof NuevoTrabajador; tipo: 'texto' | 'numero' | 'fecha' }> = [
  { etiqueta: 'Nombre', campo: 'nombre', tipo: 'texto' },
  { etiqueta: 'Apellidos', campo: 'apellidos', tipo: 'texto' },
  { etiqueta: 'DNI / NIE', campo: 'dni_nie', tipo: 'texto' },
  { etiqueta: 'Nº Seguridad Social (NSS)', campo: 'nss', tipo: 'texto' },
  { etiqueta: 'Dirección completa', campo: 'direccion', tipo: 'texto' },
  { etiqueta: 'Teléfono', campo: 'telefono', tipo: 'texto' },
  { etiqueta: 'Correo electrónico', campo: 'email', tipo: 'texto' },
  { etiqueta: 'IBAN (cuenta bancaria)', campo: 'iban', tipo: 'texto' },
  { etiqueta: 'Tipo (ajena / autonomo)', campo: 'tipo', tipo: 'texto' },
  { etiqueta: 'Categoría profesional', campo: 'categoria', tipo: 'texto' },
  { etiqueta: 'Tipo de contrato (indefinido / temporal)', campo: 'tipo_contrato', tipo: 'texto' },
  { etiqueta: 'Fecha inicio de contrato (dd/mm/aaaa)', campo: 'fecha_contrato_inicio', tipo: 'fecha' },
  { etiqueta: 'Fecha fin de contrato (si temporal)', campo: 'fecha_contrato_fin', tipo: 'fecha' },
  { etiqueta: 'Fecha de alta (dd/mm/aaaa)', campo: 'fecha_alta', tipo: 'fecha' },
  { etiqueta: 'Fin del periodo de prueba (dd/mm/aaaa)', campo: 'fecha_fin_periodo_prueba', tipo: 'fecha' },
  { etiqueta: 'Horas de contrato a la semana', campo: 'horas_contrato_semanales', tipo: 'numero' },
  { etiqueta: 'Jornada completa en la empresa (h/semana)', campo: 'jornada_completa_semanal', tipo: 'numero' },
  { etiqueta: 'Horas anuales del convenio (jornada completa)', campo: 'horas_convenio_completa', tipo: 'numero' },
  { etiqueta: 'Salario base según convenio (€/mes, jornada completa)', campo: 'sueldo_convenio_completo', tipo: 'numero' },
  { etiqueta: 'Plus de productividad (€/mes)', campo: 'plus_productividad', tipo: 'numero' },
  { etiqueta: 'Plus de transporte (€/mes)', campo: 'plus_transporte', tipo: 'numero' },
  { etiqueta: 'IRPF (%)', campo: 'irpf', tipo: 'numero' },
  { etiqueta: 'Precio hora complementaria (€)', campo: 'precio_hora_complementaria', tipo: 'numero' },
  { etiqueta: 'Vacaciones anuales (días)', campo: 'vacaciones_anuales', tipo: 'numero' },
  { etiqueta: 'Observaciones', campo: 'observaciones', tipo: 'texto' }
]

const SECCIONES: Record<number, string> = {
  0: 'DATOS PERSONALES',
  8: 'CONTRATO',
  15: 'JORNADA',
  18: 'RETRIBUCIÓN',
  23: 'OTROS'
}

export async function bufferFichaAltaExcel(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Ficha de alta')
  ws.columns = [{ width: 3 }, { width: 46 }, { width: 42 }, { width: 3 }]

  ws.mergeCells('B2:C2')
  ws.getCell('B2').value = 'FICHA DE ALTA DE TRABAJADOR/A'
  ws.getCell('B2').font = { bold: true, size: 16, color: { argb: 'FF1D4ED8' } }
  ws.mergeCells('B3:C3')
  ws.getCell('B3').value =
    'Rellena las casillas amarillas. Fechas en formato dd/mm/aaaa. Al terminar, guarda el fichero y entrégalo al despacho.'
  ws.getCell('B3').font = { italic: true, size: 10, color: { argb: 'FF6E6E73' } }

  let fila = 5
  CAMPOS.forEach((c, i) => {
    const seccion = SECCIONES[i]
    if (seccion) {
      ws.mergeCells(`B${fila}:C${fila}`)
      const celda = ws.getCell(`B${fila}`)
      celda.value = seccion
      celda.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
      celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } }
      fila++
    }
    ws.getCell(`B${fila}`).value = c.etiqueta
    ws.getCell(`B${fila}`).font = { size: 11 }
    const input = ws.getCell(`C${fila}`)
    input.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } }
    input.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    }
    // El texto plano evita sorpresas con formatos automáticos de Excel (IBAN, NSS…)
    input.numFmt = c.tipo === 'numero' ? 'General' : '@'
    if (c.campo === 'tipo') {
      ws.getCell(`C${fila}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"ajena,autonomo"']
      }
    }
    if (c.campo === 'tipo_contrato') {
      ws.getCell(`C${fila}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"indefinido,temporal"']
      }
    }
    fila++
  })

  return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer)
}

// ---- Lectura ----

function normaliza(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 /()]/g, '')
    .trim()
}

function comoTexto(v: ExcelJS.CellValue): string {
  if (v == null) return ''
  if (typeof v === 'object' && 'richText' in (v as object)) {
    return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join('')
  }
  if (v instanceof Date) return v.toISOString()
  return String(v).trim()
}

function comoNumero(v: ExcelJS.CellValue): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return v
  const s = String(v).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function comoFechaIso(v: ExcelJS.CellValue): string | null {
  if (v == null || v === '') return null
  if (v instanceof Date) {
    // exceljs entrega las fechas de Excel en UTC
    return v.toISOString().slice(0, 10)
  }
  const s = String(v).trim()
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (m) {
    const anio = m[3].length === 2 ? '20' + m[3] : m[3]
    return `${anio}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return null
}

/** Lee una ficha de alta rellenada y devuelve los campos encontrados. */
export async function parseFichaAlta(buf: Buffer): Promise<Partial<NuevoTrabajador>> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as unknown as ArrayBuffer)
  const ws = wb.worksheets[0]
  if (!ws) throw new Error('El fichero no tiene ninguna hoja')

  const porEtiqueta = new Map(CAMPOS.map((c) => [normaliza(c.etiqueta), c]))
  const resultado: Record<string, unknown> = {}
  let encontrados = 0

  ws.eachRow((row) => {
    const etiqueta = normaliza(comoTexto(row.getCell(2).value))
    if (!etiqueta) return
    const def = porEtiqueta.get(etiqueta)
    if (!def) return
    const bruto = row.getCell(3).value
    if (def.tipo === 'numero') {
      const n = comoNumero(bruto)
      if (n !== null) {
        resultado[def.campo] = n
        encontrados++
      }
    } else if (def.tipo === 'fecha') {
      const f = comoFechaIso(bruto)
      if (f) {
        resultado[def.campo] = f
        encontrados++
      }
    } else {
      const t = comoTexto(bruto)
      if (t) {
        resultado[def.campo] = def.campo === 'tipo' || def.campo === 'tipo_contrato' ? normaliza(t) : t
        encontrados++
      }
    }
  })

  if (!encontrados) {
    throw new Error(
      'No se ha reconocido ninguna casilla de la ficha. ¿Es el fichero de la plantilla "Ficha de alta"?'
    )
  }
  // Normaliza los desplegables por si se escribieron a mano
  if (resultado.tipo && resultado.tipo !== 'ajena' && resultado.tipo !== 'autonomo') {
    resultado.tipo = String(resultado.tipo).startsWith('aut') ? 'autonomo' : 'ajena'
  }
  if (
    resultado.tipo_contrato &&
    resultado.tipo_contrato !== 'indefinido' &&
    resultado.tipo_contrato !== 'temporal'
  ) {
    resultado.tipo_contrato = String(resultado.tipo_contrato).startsWith('tem')
      ? 'temporal'
      : 'indefinido'
  }
  return resultado as Partial<NuevoTrabajador>
}
