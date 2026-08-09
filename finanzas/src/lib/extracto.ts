/**
 * Lectura de ficheros de extracto bancario (capa con efectos). Convierte cada
 * formato en algo que el motor puro sabe interpretar:
 *   · Norma 43 → texto de posiciones fijas
 *   · Excel / CSV → matriz de celdas
 *   · PDF → líneas de texto (solo si el PDF tiene capa de texto)
 *
 * Las librerías pesadas (SheetJS, pdf.js) van en carga diferida para no lastrar
 * el arranque de la app.
 */
import { decodificarTextoBancario } from '../dominio/texto'
import { parsearCSV, detectarSeparador } from '../dominio/csv'
import { parsearN43 } from '../dominio/n43'
import { leerHoja, lineasAMovimientos, type MovimientoExtracto, type ResultadoExtracto } from '../dominio/extracto'
import type { Celda } from '../dominio/prestamo-archivo'

export type FormatoExtracto = 'N43' | 'EXCEL' | 'CSV' | 'PDF' | 'DESCONOCIDO'

export interface LecturaExtracto extends ResultadoExtracto {
  formato: FormatoExtracto
  /** Avisos del propio fichero (descuadres del N43, PDF sin texto…). */
  errores: string[]
}

export function formatoDe(nombre: string): FormatoExtracto {
  const ext = nombre.toLowerCase().split('.').pop() ?? ''
  if (['n43', 'q43', 'c43', 'aeb', 'aeb43'].includes(ext)) return 'N43'
  if (['xlsx', 'xls', 'xlsm'].includes(ext)) return 'EXCEL'
  if (['csv', 'tsv'].includes(ext)) return 'CSV'
  if (ext === 'pdf') return 'PDF'
  if (ext === 'txt') return 'N43' // los bancos sirven el Norma 43 como .txt
  return 'DESCONOCIDO'
}

/** Lee cualquiera de los formatos admitidos y devuelve movimientos normalizados. */
export async function leerExtracto(fichero: File): Promise<LecturaExtracto> {
  const formato = formatoDe(fichero.name)
  switch (formato) {
    case 'N43':
      return leerN43(fichero)
    case 'EXCEL':
      return leerExcel(fichero)
    case 'CSV':
      return leerCsv(fichero)
    case 'PDF':
      return leerPdf(fichero)
    default:
      return {
        formato,
        movimientos: [],
        descartadas: [],
        errores: [`No se reconoce la extensión de "${fichero.name}". Admite Norma 43 (.n43/.txt), Excel, CSV y PDF.`],
      }
  }
}

async function leerN43(fichero: File): Promise<LecturaExtracto> {
  const texto = decodificarTextoBancario(await fichero.arrayBuffer())
  const r = parsearN43(texto)
  const movimientos: MovimientoExtracto[] = []
  for (const cuenta of r.cuentas) {
    for (const m of cuenta.movimientos) {
      movimientos.push({
        fecha: m.fechaOperacion,
        concepto: m.concepto,
        importe: m.importe,
        origen: `${m.fechaOperacion} · ${m.concepto} · ${m.referencia || m.documento}`,
      })
    }
  }
  const errores = [...r.errores]
  if (r.cuentas.length === 0) {
    errores.push('El fichero no contiene ninguna cabecera de cuenta (registro 11). ¿Seguro que es un Norma 43?')
  }
  return { formato: 'N43', movimientos, descartadas: [], errores }
}

async function leerCsv(fichero: File): Promise<LecturaExtracto> {
  const texto = decodificarTextoBancario(await fichero.arrayBuffer())
  const filas = parsearCSV(texto)
  return desdeFilas(filas, 'CSV')
}

async function leerExcel(fichero: File): Promise<LecturaExtracto> {
  const XLSX = await import('xlsx')
  const wb = XLSX.read(await fichero.arrayBuffer(), { type: 'array', cellDates: false, raw: false })
  const errores: string[] = []

  // Se prueba hoja por hoja: la primera que parezca un extracto es la buena.
  for (const nombre of wb.SheetNames) {
    const hoja = wb.Sheets[nombre]
    const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: false, defval: '' }) as string[][]
    const lectura = desdeFilas(filas, 'EXCEL')
    if (lectura.errores.length === 0) {
      if (wb.SheetNames.length > 1) errores.push(`Leída la hoja "${nombre}".`)
      return { ...lectura, errores: [...errores, ...lectura.errores] }
    }
  }
  return {
    formato: 'EXCEL',
    movimientos: [],
    descartadas: [],
    errores: ['No se ha encontrado ninguna hoja con columnas de fecha e importe reconocibles.'],
  }
}

function desdeFilas(filas: string[][], formato: FormatoExtracto): LecturaExtracto {
  const leida = leerHoja(filas)
  if (!leida) {
    return {
      formato,
      movimientos: [],
      descartadas: [],
      errores: [
        'No se reconocen las columnas del fichero. Debe tener una columna de fecha y otra de importe (o de cargo y abono).',
      ],
    }
  }
  return { formato, ...leida.resultado, errores: [] }
}

/**
 * Extrae las líneas de texto de un PDF respetando la disposición visual:
 * los fragmentos se agrupan por su coordenada vertical, que es lo que convierte
 * un amasijo de trozos en filas de tabla legibles.
 */
export async function lineasDePdf(buffer: ArrayBuffer): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist')
  // El worker se sirve desde el propio bundle (la CSP no permite CDN externos).
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

  const tarea = pdfjs.getDocument({ data: new Uint8Array(buffer) })
  const doc = await tarea.promise
  const lineas: string[] = []

  /** Dos fragmentos pertenecen a la misma fila si su Y no difiere más que esto. */
  const TOLERANCIA_Y = 4

  for (let p = 1; p <= doc.numPages; p++) {
    const pagina = await doc.getPage(p)
    const contenido = await pagina.getTextContent()

    // Muchos PDF de banca dibujan cada celda DOS VECES en la misma posición
    // (una capa visible y otra de accesibilidad). Sin quitar los repetidos, el
    // importe aparecía duplicado y la línea quedaba ilegible.
    const vistos = new Set<string>()
    const trozos: { x: number; y: number; texto: string }[] = []
    for (const item of contenido.items as { str: string; transform: number[] }[]) {
      if (!item.str || item.str.trim() === '') continue
      const x = item.transform[4]
      const y = item.transform[5]
      const huella = `${Math.round(x)}|${Math.round(y)}|${item.str}`
      if (vistos.has(huella)) continue
      vistos.add(huella)
      trozos.push({ x, y, texto: item.str })
    }

    // Agrupación por cercanía vertical: la fecha y el resto de la fila pueden
    // ir a uno o dos puntos de distancia, y un redondeo fijo las separaba.
    trozos.sort((a, b) => b.y - a.y || a.x - b.x)
    let grupo: typeof trozos = []
    let yGrupo = Number.NaN

    const cerrarGrupo = () => {
      if (grupo.length === 0) return
      const texto = grupo
        .sort((a, b) => a.x - b.x)
        .map((t) => t.texto)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (texto !== '') lineas.push(texto)
      grupo = []
    }

    for (const t of trozos) {
      if (grupo.length === 0 || Math.abs(t.y - yGrupo) <= TOLERANCIA_Y) {
        if (grupo.length === 0) yGrupo = t.y
        grupo.push(t)
      } else {
        cerrarGrupo()
        yGrupo = t.y
        grupo.push(t)
      }
    }
    cerrarGrupo()
  }
  await tarea.destroy()
  return lineas
}

async function leerPdf(fichero: File): Promise<LecturaExtracto> {
  let lineas: string[]
  try {
    lineas = await lineasDePdf(await fichero.arrayBuffer())
  } catch (e) {
    return {
      formato: 'PDF',
      movimientos: [],
      descartadas: [],
      errores: [`No se ha podido abrir el PDF: ${e instanceof Error ? e.message : 'error desconocido'}`],
    }
  }

  if (lineas.length === 0) {
    return {
      formato: 'PDF',
      movimientos: [],
      descartadas: [],
      errores: [
        'El PDF no tiene texto seleccionable: es una imagen escaneada. No se puede leer sin inventar datos; introduce los movimientos a mano o pide el extracto en Excel o Norma 43.',
      ],
    }
  }

  const r = lineasAMovimientos(lineas)
  const errores: string[] = []
  if (r.movimientos.length === 0) {
    errores.push(
      'Se ha leído el texto del PDF pero ninguna línea tiene el formato «fecha … importe». Revisa el fichero o usa el Excel del banco.',
    )
  }
  return { formato: 'PDF', ...r, errores }
}

/**
 * Filas de un fichero de préstamo: Excel del banco o PDF. Devuelve la matriz
 * tal cual, sin interpretar: de eso se encarga `dominio/prestamo-archivo`.
 * En el PDF cada línea se parte por dos o más espacios, que es como quedan las
 * columnas al extraer el texto.
 */
export async function filasDePrestamo(fichero: File): Promise<Celda[][]> {
  const ext = (fichero.name.split('.').pop() ?? '').toLowerCase()

  if (['xlsx', 'xls', 'xlsm'].includes(ext)) {
    const XLSX = await import('xlsx')
    const wb = XLSX.read(await fichero.arrayBuffer(), { type: 'array' })
    const hoja = wb.Sheets[wb.SheetNames[0]]
    return XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '' }) as Celda[][]
  }

  if (ext === 'pdf') {
    const lineas = await lineasDePdf(await fichero.arrayBuffer())
    return lineas.map((l) => l.split(/\s{2,}/).map((c) => c.trim()))
  }

  if (['csv', 'tsv', 'txt'].includes(ext)) {
    const texto = decodificarTextoBancario(await fichero.arrayBuffer())
    return parsearCSV(texto, detectarSeparador(texto)) as Celda[][]
  }

  throw new Error(`No se sabe leer un fichero «${ext}». Usa el Excel o el PDF que descarga el banco.`)
}
