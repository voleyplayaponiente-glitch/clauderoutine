// Ficha de contratación de trabajador en Excel, siguiendo el modelo real del
// despacho (FORMULARIO_CONTRATACION_TRABAJADOR): se genera una plantilla
// rellenable para el trabajador nuevo y, al subirla, se crea el alta
// precargada. La lectura busca cada etiqueta en la columna B y su valor en la
// columna C, así tolera que se muevan filas.
import ExcelJS from 'exceljs'
import type { NuevoTrabajador } from '../../shared/types'

type TipoCampo = 'texto' | 'numero' | 'fecha'

interface Campo {
  etiqueta: string
  tipo: TipoCampo
  /** campo directo de la ficha del trabajador en la app */
  campo?: keyof NuevoTrabajador
  /** clave para el post-procesado (compuestos) o para volcar a observaciones */
  extra?: string
}

// Secciones y campos, en el orden del modelo del despacho. Los campos sin
// `campo` directo se recogen igualmente: los compuestos se combinan después y
// el resto se vuelca a Observaciones para que no se pierda nada.
const SECCIONES: Array<{ titulo: string; campos: Campo[] }> = [
  {
    titulo: '1. DATOS PERSONALES',
    campos: [
      { etiqueta: 'Nombre *', tipo: 'texto', campo: 'nombre' },
      { etiqueta: 'Primer apellido *', tipo: 'texto', extra: 'apellido1' },
      { etiqueta: 'Segundo apellido', tipo: 'texto', extra: 'apellido2' },
      { etiqueta: 'Sexo (H/M/Otro)', tipo: 'texto', extra: 'Sexo' },
      { etiqueta: 'Estado civil', tipo: 'texto', extra: 'Estado civil' },
      { etiqueta: 'DNI / NIE / Pasaporte *', tipo: 'texto', campo: 'dni_nie' },
      { etiqueta: 'Fecha caducidad DNI/NIE (dd/mm/aaaa)', tipo: 'fecha', extra: 'Caducidad DNI' },
      { etiqueta: 'Nº Seguridad Social (NUSS/NAF) *', tipo: 'texto', campo: 'nss' },
      { etiqueta: 'Fecha de nacimiento (dd/mm/aaaa)', tipo: 'fecha', extra: 'Fecha nacimiento' },
      { etiqueta: 'Nacionalidad', tipo: 'texto', extra: 'Nacionalidad' },
      { etiqueta: 'Permiso de trabajo (si extranjero)', tipo: 'texto', extra: 'Permiso de trabajo' }
    ]
  },
  {
    titulo: '2. DATOS DE CONTACTO Y DOMICILIO HABITUAL',
    campos: [
      { etiqueta: 'Domicilio (calle/avenida y número) *', tipo: 'texto', extra: 'dom_calle' },
      { etiqueta: 'Piso / Puerta / Escalera', tipo: 'texto', extra: 'dom_piso' },
      { etiqueta: 'Código Postal *', tipo: 'texto', extra: 'dom_cp' },
      { etiqueta: 'Municipio / Localidad *', tipo: 'texto', extra: 'dom_municipio' },
      { etiqueta: 'Provincia *', tipo: 'texto', extra: 'dom_provincia' },
      { etiqueta: 'Teléfono móvil *', tipo: 'texto', campo: 'telefono' },
      { etiqueta: 'Teléfono fijo', tipo: 'texto', extra: 'Teléfono fijo' },
      { etiqueta: 'Email personal *', tipo: 'texto', campo: 'email' }
    ]
  },
  {
    titulo: '3. DATOS BANCARIOS PARA EL ABONO DE LA NÓMINA',
    campos: [
      { etiqueta: 'IBAN (24 dígitos, ESxx...) *', tipo: 'texto', campo: 'iban' },
      { etiqueta: 'Entidad bancaria', tipo: 'texto', extra: 'Entidad bancaria' },
      { etiqueta: 'Titular de la cuenta', tipo: 'texto', extra: 'Titular cuenta' }
    ]
  },
  {
    titulo: '4. SITUACIÓN FAMILIAR — MODELO 145 IRPF',
    campos: [
      { etiqueta: 'Situación familiar (1, 2 ó 3)', tipo: 'texto', extra: 'Mod145 situación' },
      { etiqueta: 'DNI del cónyuge (si situación 2)', tipo: 'texto', extra: 'Mod145 DNI cónyuge' },
      {
        etiqueta: 'Discapacidad propia (No / 33% / 65% / 65%+ayuda)',
        tipo: 'texto',
        extra: 'Mod145 discapacidad'
      },
      {
        etiqueta: 'Hijos / descendientes a cargo (nombre y fecha nacimiento)',
        tipo: 'texto',
        extra: 'Mod145 descendientes'
      },
      {
        etiqueta: 'Ascendientes a cargo (nombre y fecha nacimiento)',
        tipo: 'texto',
        extra: 'Mod145 ascendientes'
      }
    ]
  },
  {
    titulo: '5. DATOS DEL CONTRATO Y PUESTO (a cumplimentar por la empresa)',
    campos: [
      { etiqueta: 'Puesto / Categoría profesional *', tipo: 'texto', campo: 'categoria' },
      { etiqueta: 'Centro de trabajo (tienda) *', tipo: 'texto', extra: 'centro' },
      { etiqueta: 'Tipo de contrato (indefinido/temporal) *', tipo: 'texto', campo: 'tipo_contrato' },
      { etiqueta: 'Horas semanales *', tipo: 'numero', campo: 'horas_contrato_semanales' },
      { etiqueta: 'Fecha de alta (dd/mm/aaaa) *', tipo: 'fecha', campo: 'fecha_alta' },
      { etiqueta: 'Fecha fin (si temporal)', tipo: 'fecha', campo: 'fecha_contrato_fin' },
      { etiqueta: 'Periodo de prueba (días)', tipo: 'numero', extra: 'prueba_dias' },
      { etiqueta: 'Salario bruto anual (€)', tipo: 'numero', extra: 'salario_anual' },
      { etiqueta: 'Nº de pagas', tipo: 'numero', extra: 'num_pagas' },
      { etiqueta: 'Convenio colectivo aplicable', tipo: 'texto', extra: 'Convenio' }
    ]
  },
  {
    titulo: '6. FORMACIÓN Y OTROS',
    campos: [
      { etiqueta: 'Nivel formativo / titulación', tipo: 'texto', extra: 'Formación' },
      { etiqueta: 'Idiomas y nivel', tipo: 'texto', extra: 'Idiomas' },
      { etiqueta: 'Carnet de conducir / vehículo propio', tipo: 'texto', extra: 'Carnet/vehículo' }
    ]
  },
  {
    titulo: '7. PERSONA DE CONTACTO EN CASO DE EMERGENCIA',
    campos: [
      { etiqueta: 'Nombre y apellidos (emergencia) *', tipo: 'texto', extra: 'Emergencia contacto' },
      { etiqueta: 'Parentesco', tipo: 'texto', extra: 'Emergencia parentesco' },
      { etiqueta: 'Teléfono (emergencia) *', tipo: 'texto', extra: 'Emergencia teléfono' }
    ]
  },
  {
    titulo: '8. OBSERVACIONES',
    campos: [
      { etiqueta: 'Observaciones / información adicional', tipo: 'texto', campo: 'observaciones' }
    ]
  }
]

const TODOS_LOS_CAMPOS: Campo[] = SECCIONES.flatMap((s) => s.campos)

const AZUL = 'FF1E40AF'
const AMARILLO = 'FFFFF9C4'
const GRIS_BORDE = 'FFCBD5E1'

export async function bufferFichaAltaExcel(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Ficha de contratación')
  ws.columns = [{ width: 3 }, { width: 48 }, { width: 46 }, { width: 3 }]

  ws.mergeCells('B2:C2')
  ws.getCell('B2').value = 'FICHA DE CONTRATACIÓN DEL TRABAJADOR/A'
  ws.getCell('B2').font = { bold: true, size: 15, color: { argb: 'FF1D4ED8' } }
  ws.mergeCells('B3:C3')
  ws.getCell('B3').value =
    'Documento confidencial. Rellena las casillas amarillas con letra MAYÚSCULA; fechas en formato dd/mm/aaaa. ' +
    'Los campos con * son obligatorios. Al terminar, guarda el fichero y entrégalo al despacho junto a la documentación.'
  ws.getCell('B3').alignment = { wrapText: true }
  ws.getCell('B3').font = { italic: true, size: 9, color: { argb: 'FF6E6E73' } }
  ws.getRow(3).height = 30

  let fila = 5
  for (const seccion of SECCIONES) {
    ws.mergeCells(`B${fila}:C${fila}`)
    const cab = ws.getCell(`B${fila}`)
    cab.value = seccion.titulo
    cab.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
    cab.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } }
    fila++
    for (const c of seccion.campos) {
      ws.getCell(`B${fila}`).value = c.etiqueta
      ws.getCell(`B${fila}`).font = { size: 10.5 }
      ws.getCell(`B${fila}`).alignment = { wrapText: true }
      const input = ws.getCell(`C${fila}`)
      input.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMARILLO } }
      input.border = {
        top: { style: 'thin', color: { argb: GRIS_BORDE } },
        left: { style: 'thin', color: { argb: GRIS_BORDE } },
        bottom: { style: 'thin', color: { argb: GRIS_BORDE } },
        right: { style: 'thin', color: { argb: GRIS_BORDE } }
      }
      // Texto plano: evita que Excel "estropee" IBAN, NSS, teléfonos…
      input.numFmt = c.tipo === 'numero' ? 'General' : '@'
      if (c.campo === 'tipo_contrato') {
        input.dataValidation = { type: 'list', allowBlank: true, formulae: ['"indefinido,temporal"'] }
      }
      fila++
    }
    fila++ // separación entre secciones
  }

  // Bloque final de firma (como en el modelo del despacho; no se importa).
  ws.mergeCells(`B${fila}:C${fila}`)
  ws.getCell(`B${fila}`).value =
    'Declaro bajo mi responsabilidad que los datos aportados son ciertos. He sido informado/a del ' +
    'tratamiento de mis datos (RGPD 2016/679 y LOPDGDD 3/2018) con la finalidad de gestionar la ' +
    'relación laboral, y consiento su cesión a la asesoría/graduado social para nóminas y contratos.'
  ws.getCell(`B${fila}`).alignment = { wrapText: true }
  ws.getCell(`B${fila}`).font = { size: 9, color: { argb: 'FF444444' } }
  ws.getRow(fila).height = 40
  fila += 2
  ws.getCell(`B${fila}`).value = 'Lugar y fecha:'
  fila += 3
  ws.getCell(`B${fila}`).value = 'FIRMA DEL TRABAJADOR/A'
  ws.getCell(`C${fila}`).value = 'FIRMA Y SELLO DE LA EMPRESA'
  ws.getRow(fila).font = { bold: true, size: 10 }

  return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer)
}

// ---- Lectura ----

function normaliza(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
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
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  const s = String(v).trim()
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (m) {
    const anio = m[3].length === 2 ? '20' + m[3] : m[3]
    return `${anio}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return null
}

function sumarDias(iso: string, dias: number): string {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

export interface FichaLeida {
  trabajador: Partial<NuevoTrabajador>
  /** nombre del centro de trabajo escrito en la ficha (para asignarlo si existe) */
  centro?: string
}

/** Lee una ficha de contratación rellenada y devuelve los campos de la app. */
export async function parseFichaAlta(buf: Buffer): Promise<FichaLeida> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as unknown as ArrayBuffer)
  const ws = wb.worksheets[0]
  if (!ws) throw new Error('El fichero no tiene ninguna hoja')

  const porEtiqueta = new Map(TODOS_LOS_CAMPOS.map((c) => [normaliza(c.etiqueta), c]))
  const directos: Record<string, unknown> = {}
  const extras: Record<string, string | number> = {}
  let encontrados = 0

  ws.eachRow((row) => {
    const etiqueta = normaliza(comoTexto(row.getCell(2).value))
    if (!etiqueta) return
    const def = porEtiqueta.get(etiqueta)
    if (!def) return
    const bruto = row.getCell(3).value
    let valor: string | number | null = null
    if (def.tipo === 'numero') valor = comoNumero(bruto)
    else if (def.tipo === 'fecha') valor = comoFechaIso(bruto)
    else {
      const t = comoTexto(bruto)
      valor = t || null
    }
    if (valor === null) return
    encontrados++
    if (def.campo) directos[def.campo] = valor
    else if (def.extra) extras[def.extra] = valor
  })

  if (!encontrados) {
    throw new Error(
      'No se ha reconocido ninguna casilla. ¿Es el fichero de la plantilla «Ficha de contratación» descargada de la app?'
    )
  }

  const t = directos as Partial<NuevoTrabajador>

  // Compuestos: apellidos y dirección completa.
  const apellidos = [extras.apellido1, extras.apellido2].filter(Boolean).join(' ')
  if (apellidos) t.apellidos = apellidos
  const dir = [
    extras.dom_calle,
    extras.dom_piso,
    [extras.dom_cp, extras.dom_municipio].filter(Boolean).join(' '),
    extras.dom_provincia
  ]
    .filter(Boolean)
    .join(', ')
  if (dir) t.direccion = dir

  // Contrato: normaliza el tipo, fecha de inicio = alta, y periodo de prueba en días.
  if (t.tipo_contrato) {
    const v = normaliza(String(t.tipo_contrato))
    t.tipo_contrato = v.startsWith('tem') || v.startsWith('form') ? 'temporal' : 'indefinido'
  }
  if (t.fecha_alta && !t.fecha_contrato_inicio) t.fecha_contrato_inicio = t.fecha_alta
  if (t.fecha_alta && typeof extras.prueba_dias === 'number' && extras.prueba_dias > 0) {
    t.fecha_fin_periodo_prueba = sumarDias(String(t.fecha_alta), extras.prueba_dias)
  }

  // Salario: de bruto anual + nº de pagas → importe mensual por paga.
  const anual = typeof extras.salario_anual === 'number' ? extras.salario_anual : null
  const pagas = typeof extras.num_pagas === 'number' && extras.num_pagas > 0 ? extras.num_pagas : null
  if (anual && pagas) t.sueldo_convenio_completo = Math.round((anual / pagas) * 100) / 100

  // Todo lo demás se conserva en Observaciones (nada se pierde).
  const NO_VOLCAR = new Set([
    'apellido1',
    'apellido2',
    'dom_calle',
    'dom_piso',
    'dom_cp',
    'dom_municipio',
    'dom_provincia',
    'centro',
    'prueba_dias',
    'salario_anual',
    'num_pagas'
  ])
  const lineas = Object.entries(extras)
    .filter(([k, v]) => !NO_VOLCAR.has(k) && v !== '' && v != null)
    .map(([k, v]) => `${k}: ${v}`)
  if (anual && pagas) lineas.unshift(`Salario bruto anual: ${anual} € en ${pagas} pagas`)
  if (lineas.length) {
    t.observaciones = [t.observaciones, ...lineas].filter(Boolean).join('\n')
  }

  return { trabajador: t, centro: extras.centro ? String(extras.centro) : undefined }
}
