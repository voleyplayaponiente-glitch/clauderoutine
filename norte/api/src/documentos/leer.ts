import {
  detectarDocumento,
  leerExtractoDeTexto,
  leerNomina,
  leerNorma43,
  leerTablaDeApuntes,
  type Celda,
  type Deteccion,
  type LecturaExtracto,
  type LecturaNomina,
} from '@norte/dominio'
import { leerCsv } from './csv.js'
import { esXlsAntiguo, leerXls } from './hoja-xls.js'
import { leerXlsx, type Hoja } from './hoja-xlsx.js'
import { leerTextoDePdf } from './pdf.js'

/**
 * De los bytes de un fichero a algo que se pueda revisar en pantalla.
 *
 * Este es el único sitio de la aplicación que sabe de formatos. Todo lo que
 * sale de aquí es ya vocabulario de Norte: apuntes y nóminas.
 */

export interface LecturaDocumento {
  deteccion: Deteccion
  extracto?: LecturaExtracto
  nomina?: LecturaNomina
  /** Nombre de la hoja de la que se ha leído, cuando había varias. */
  hoja?: string
  error?: string
}

const FIRMA_ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04])
const FIRMA_PDF = Buffer.from([0x25, 0x50, 0x44, 0x46])

function empiezaPor(datos: Buffer, firma: Buffer): boolean {
  return datos.length >= firma.length && datos.subarray(0, firma.length).equals(firma)
}

/** Texto de un fichero que no es binario. Si no es UTF-8 válido se reintenta en
 *  Windows-1252, que es lo que sale de media banca electrónica española. */
function aTexto(datos: Buffer): string {
  const utf8 = datos.toString('utf8')
  return utf8.includes('�') ? datos.toString('latin1') : utf8
}

/** Con varias hojas se queda la que más movimientos da. Los bancos suelen poner
 *  una de portada y otra con la tabla, y adivinar por el nombre falla. */
function mejorHoja(hojas: Hoja[]): { hoja: Hoja; lectura: LecturaExtracto } | null {
  let mejor: { hoja: Hoja; lectura: LecturaExtracto } | null = null
  for (const hoja of hojas) {
    const lectura = leerTablaDeApuntes(hoja.filas)
    if (!mejor || lectura.apuntes.length > mejor.lectura.apuntes.length) mejor = { hoja, lectura }
  }
  return mejor
}

export async function leerDocumento(
  nombre: string,
  datos: Buffer,
): Promise<LecturaDocumento> {
  const extension = nombre.slice(nombre.lastIndexOf('.')).toLowerCase()

  try {
    // ── Hojas de cálculo ────────────────────────────────────────────────────
    if (empiezaPor(datos, FIRMA_ZIP) || esXlsAntiguo(datos)) {
      const hojas = esXlsAntiguo(datos) ? leerXls(datos) : leerXlsx(datos)
      const elegida = mejorHoja(hojas)
      const deteccion = detectarDocumento({ nombre })
      if (!elegida) {
        return { deteccion, error: 'La hoja de cálculo no tiene ninguna pestaña con datos.' }
      }
      return {
        deteccion: { ...deteccion, tipo: 'extracto_banco', formato: 'hoja' },
        extracto: elegida.lectura,
        ...(hojas.length > 1 ? { hoja: elegida.hoja.nombre } : {}),
      }
    }

    // ── PDF ─────────────────────────────────────────────────────────────────
    if (empiezaPor(datos, FIRMA_PDF)) {
      const texto = await leerTextoDePdf(datos)
      const deteccion = detectarDocumento({ nombre, texto })
      if (deteccion.tipo === 'nomina') return { deteccion, nomina: leerNomina(texto) }
      return { deteccion, extracto: leerExtractoDeTexto(texto) }
    }

    // ── Texto: Norma 43, CSV o extracto suelto ──────────────────────────────
    const texto = aTexto(datos)
    const deteccion = detectarDocumento({ nombre, texto })

    if (deteccion.formato === 'norma43') return { deteccion, extracto: leerNorma43(texto) }
    if (deteccion.formato === 'csv' || extension === '.csv' || extension === '.tsv') {
      const filas: Celda[][] = leerCsv(texto)
      return { deteccion: { ...deteccion, formato: 'csv' }, extracto: leerTablaDeApuntes(filas) }
    }
    if (deteccion.tipo === 'nomina') return { deteccion, nomina: leerNomina(texto) }
    return { deteccion, extracto: leerExtractoDeTexto(texto) }
  } catch (error) {
    // Un fichero corrupto o un formato que no es el que dice la extensión no
    // puede tumbar el servidor: se cuenta lo que ha pasado y se sigue.
    return {
      deteccion: detectarDocumento({ nombre }),
      error: `No he podido leer el fichero: ${(error as Error).message}`,
    }
  }
}
