import type { Celda } from '@norte/dominio'
import { abrirZip } from './zip.js'

/**
 * `.xlsx` → cuadrícula de celdas.
 *
 * Solo se sacan valores: ni estilos, ni fórmulas, ni formatos de fecha. Las
 * fechas salen como número de serie de Excel y el motor ya sabe convertirlas
 * (`fechaDeSerieExcel`), así que interpretar `styles.xml` aquí sería trabajo
 * duplicado y una fuente más de fallos.
 */

export interface Hoja {
  nombre: string
  filas: Celda[][]
}

/** `B5` → columna 1, fila 4 (base cero). */
function referencia(ref: string): { fila: number; columna: number } | null {
  const partes = ref.match(/^([A-Z]+)(\d+)$/)
  if (!partes) return null
  let columna = 0
  for (const letra of partes[1]!) columna = columna * 26 + (letra.charCodeAt(0) - 64)
  return { fila: Number(partes[2]) - 1, columna: columna - 1 }
}

const ENTIDADES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
}

function desescapar(xml: string): string {
  return xml
    .replace(/&#x([0-9a-fA-F]+);/g, (_t, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_t, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&(?:amp|lt|gt|quot|apos);/g, (t) => ENTIDADES[t] ?? t)
}

/** El texto de un `<si>` puede venir partido en varios `<t>` por los formatos
 *  parciales; se concatenan en orden. */
function textoDe(fragmento: string): string {
  const trozos = fragmento.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? []
  return desescapar(trozos.map((t) => t.replace(/<[^>]+>/g, '')).join(''))
}

function leerCadenasCompartidas(xml: string | undefined): string[] {
  if (!xml) return []
  const items = xml.match(/<si>[\s\S]*?<\/si>|<si\/>/g) ?? []
  return items.map((item) => (item === '<si/>' ? '' : textoDe(item)))
}

export function leerXlsx(datos: Buffer): Hoja[] {
  const ficheros = abrirZip(datos)
  const cadenas = leerCadenasCompartidas(ficheros.get('xl/sharedStrings.xml')?.toString('utf8'))

  const libro = ficheros.get('xl/workbook.xml')?.toString('utf8') ?? ''
  const nombres = [...libro.matchAll(/<sheet[^>]*name="([^"]*)"[^>]*\/?>/g)].map((m) => desescapar(m[1]!))

  const hojas: Hoja[] = []
  for (let i = 0; ; i++) {
    const contenido = ficheros.get(`xl/worksheets/sheet${i + 1}.xml`)?.toString('utf8')
    if (!contenido) break
    hojas.push({ nombre: nombres[i] ?? `Hoja ${i + 1}`, filas: leerHoja(contenido, cadenas) })
  }
  return hojas
}

function leerHoja(xml: string, cadenas: string[]): Celda[][] {
  const filas: Celda[][] = []
  const celdas = xml.match(/<c\b[^>]*\/>|<c\b[^>]*>[\s\S]*?<\/c>/g) ?? []

  for (const celda of celdas) {
    const ref = celda.match(/\br="([A-Z]+\d+)"/)?.[1]
    const posicion = ref ? referencia(ref) : null
    if (!posicion) continue
    const tipo = celda.match(/\bt="([^"]*)"/)?.[1] ?? 'n'

    let valor: Celda = null
    if (tipo === 'inlineStr') {
      valor = textoDe(celda)
    } else {
      const bruto = celda.match(/<v>([\s\S]*?)<\/v>/)?.[1]
      if (bruto !== undefined) {
        const texto = desescapar(bruto)
        if (tipo === 's') valor = cadenas[Number(texto)] ?? ''
        else if (tipo === 'str' || tipo === 'e') valor = texto
        else if (tipo === 'b') valor = texto === '1'
        else {
          const numero = Number(texto)
          valor = Number.isFinite(numero) ? numero : texto
        }
      }
    }
    if (valor === null || valor === '') continue

    const fila = (filas[posicion.fila] ??= [])
    fila[posicion.columna] = valor
  }

  // Las filas y columnas vacías dejan huecos; se rellenan para que el motor
  // reciba una cuadrícula y no un array con agujeros.
  const ancho = filas.reduce((max, f) => Math.max(max, f?.length ?? 0), 0)
  for (let f = 0; f < filas.length; f++) {
    const fila = (filas[f] ??= [])
    for (let c = 0; c < ancho; c++) fila[c] ??= null
  }
  return filas
}
