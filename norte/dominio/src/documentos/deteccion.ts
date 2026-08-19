import { pareceNomina } from './nomina.js'
import { pareceNorma43 } from './norma43.js'

/**
 * Qué es este fichero.
 *
 * Norte tiene **un solo buzón**: se suelta ahí lo que sea y la app decide. Lo
 * importante es que decida en voz alta: junto al tipo va siempre el motivo, y
 * se enseña. Mandar a alguien a la pantalla equivocada sin explicar por qué es
 * peor que no reconocer el fichero.
 */

export type TipoDocumento =
  | 'extracto_banco'
  | 'nomina'
  | 'recibo'
  | 'factura'
  | 'cuadro_prestamo'
  | 'informe_broker'
  | 'desconocido'

export type FormatoDocumento = 'norma43' | 'hoja' | 'texto' | 'pdf' | 'csv' | 'desconocido'

export interface Deteccion {
  tipo: TipoDocumento
  formato: FormatoDocumento
  motivo: string
}

const EXTENSIONES_N43 = ['.q43', '.n43', '.c43', '.aeb43', '.n43.txt']
const EXTENSIONES_HOJA = ['.xlsx', '.xls', '.xlsm', '.ods']

function extension(nombre: string): string {
  const punto = nombre.lastIndexOf('.')
  return punto === -1 ? '' : nombre.slice(punto).toLowerCase()
}

export function detectarDocumento(entrada: {
  nombre: string
  mimeType?: string
  /** Texto ya extraído, si el fichero lo tiene (PDF, txt, csv, Norma 43). */
  texto?: string
}): Deteccion {
  const ext = extension(entrada.nombre)
  const texto = entrada.texto ?? ''

  if (EXTENSIONES_N43.includes(ext) || pareceNorma43(texto)) {
    return {
      tipo: 'extracto_banco',
      formato: 'norma43',
      motivo: 'Es un fichero de la Norma 43: campos de longitud fija con registros 11 y 22.',
    }
  }

  const senalesNomina = pareceNomina(texto)
  if (senalesNomina >= 2) {
    return {
      tipo: 'nomina',
      formato: ext === '.pdf' ? 'pdf' : 'texto',
      motivo: `Habla de cotizaciones, devengos o retención de IRPF (${senalesNomina} señales).`,
    }
  }

  if (EXTENSIONES_HOJA.includes(ext)) {
    return {
      tipo: 'extracto_banco',
      formato: 'hoja',
      motivo: 'Es una hoja de cálculo; buscaré dentro la tabla de movimientos.',
    }
  }
  if (ext === '.csv' || ext === '.tsv') {
    return {
      tipo: 'extracto_banco',
      formato: 'csv',
      motivo: 'Es un CSV; buscaré dentro la tabla de movimientos.',
    }
  }
  if (ext === '.pdf') {
    // Un PDF con fechas e importes en la misma línea es, casi siempre, un
    // extracto. Si resulta que no, la pantalla de revisión lo enseñará vacío y
    // no habrá pasado nada: nada entra sin que el usuario lo apruebe.
    const parecenMovimientos = (texto.match(/\d{1,2}\/\d{1,2}\/\d{2,4}.*\d+,\d{2}/g) ?? []).length
    if (parecenMovimientos >= 3) {
      return {
        tipo: 'extracto_banco',
        formato: 'pdf',
        motivo: `He visto ${parecenMovimientos} líneas con fecha e importe.`,
      }
    }
    if (senalesNomina >= 1) {
      return {
        tipo: 'nomina',
        formato: 'pdf',
        motivo: 'Tiene pinta de recibo de salario, aunque no estoy seguro: revísalo con calma.',
      }
    }
    return {
      tipo: 'desconocido',
      formato: 'pdf',
      motivo:
        'Es un PDF, pero no he reconocido ni movimientos ni una nómina. Si es un escaneado, no ' +
        'tiene texto que leer.',
    }
  }
  if (ext === '.txt') {
    return { tipo: 'desconocido', formato: 'texto', motivo: 'Texto plano sin formato reconocible.' }
  }

  return {
    tipo: 'desconocido',
    formato: 'desconocido',
    motivo: `No sé leer ficheros «${ext || 'sin extensión'}» todavía.`,
  }
}
