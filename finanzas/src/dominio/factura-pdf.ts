/**
 * Lectura asistida de una factura en PDF.
 *
 * Regla del proyecto, aquí más importante que en ningún sitio: **nunca inventar
 * un dato que no se puede leer**. Esto NO adivina una factura; localiza lo que
 * está escrito con todas las letras y lo propone para que la persona lo
 * confirme. Lo que no encuentra, lo deja vacío y lo dice.
 *
 * La comprobación que lo sostiene todo: si base + cuota no da el total leído,
 * los importes NO se dan por buenos. Antes de rellenar mal, no se rellena.
 */
import { parsearImporte, detectarConvencionNumerica } from './parseo-es'
import { parsearFechaFlexible } from './importacion'
import { validarNifCif } from './validacion'
import { aCentimos, aEuros } from './dinero'

export interface DatosFactura {
  cif?: string
  proveedor?: string
  numFactura?: string
  fecha?: string
  base?: number
  tipoIva?: number
  cuota?: number
  total?: number
  /** Qué no se ha podido leer o no cuadra. Se enseña siempre. */
  avisos: string[]
  /** Campos que se han encontrado, para señalarlos en el formulario. */
  encontrados: string[]
}

const RE_IMPORTE = /(-?\d{1,3}(?:[.,]\d{3})*[.,]\d{2}|-?\d+[.,]\d{2})/g
const RE_NIF = /\b([A-HJ-NP-SUVWXYZ]\d{7}[0-9A-J]|\d{8}[A-Z]|[XYZ]\d{7}[A-Z])\b/g

function normalizar(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** Todos los importes de una línea, ya convertidos con la convención del documento. */
function importesDe(linea: string, convencion: Parameters<typeof parsearImporte>[1]): number[] {
  return [...linea.matchAll(RE_IMPORTE)]
    .map((m) => parsearImporte(m[1], convencion))
    .filter((n): n is number => n !== null)
}

/** Último importe de la línea: en una factura, el número que cierra la fila. */
function ultimoImporte(linea: string, convencion: Parameters<typeof parsearImporte>[1]): number | undefined {
  const l = importesDe(linea, convencion)
  return l.length > 0 ? l[l.length - 1] : undefined
}

/**
 * Busca el importe de la primera línea que contenga alguna de las palabras
 * clave. `excluir` evita que «base imponible» se lleve el valor de «total».
 */
function importePorEtiqueta(
  lineas: string[],
  claves: string[],
  convencion: Parameters<typeof parsearImporte>[1],
  excluir: string[] = [],
): number | undefined {
  for (const linea of lineas) {
    const n = normalizar(linea)
    if (excluir.some((e) => n.includes(e))) continue
    if (!claves.some((c) => n.includes(c))) continue
    const v = ultimoImporte(linea, convencion)
    if (v !== undefined) return v
  }
  return undefined
}

/**
 * Extrae los datos de una factura a partir de las líneas de texto del PDF.
 * `cifPropio` es el CIF de la empresa: se descarta para no confundir al emisor
 * con el receptor, que es el error clásico al leer una factura.
 */
export function extraerDatosFactura(lineas: string[], cifPropio?: string): DatosFactura {
  const avisos: string[] = []
  const encontrados: string[] = []
  const limpias = lineas.map((l) => l.replace(/\s+/g, ' ').trim()).filter((l) => l !== '')

  if (limpias.length === 0) {
    return {
      avisos: ['El PDF no tiene texto seleccionable: probablemente es un escaneo. Introduce la factura a mano.'],
      encontrados: [],
    }
  }

  const convencion = detectarConvencionNumerica(limpias.flatMap((l) => [...l.matchAll(RE_IMPORTE)].map((m) => m[1])))
  const texto = limpias.join('\n')
  const datos: DatosFactura = { avisos, encontrados }

  // ── CIF del proveedor ──
  const nifs: string[] = []
  for (const m of texto.matchAll(RE_NIF)) {
    const v = m[1].toUpperCase()
    if (!validarNifCif(v).valido) continue
    if (cifPropio && v === cifPropio.toUpperCase().replace(/[\s-]/g, '')) continue
    if (!nifs.includes(v)) nifs.push(v)
  }
  if (nifs.length > 0) {
    datos.cif = nifs[0]
    encontrados.push('cif')
    if (nifs.length > 1) avisos.push(`Hay ${nifs.length} NIF/CIF en el documento; se ha tomado el primero (${nifs[0]}). Compruébalo.`)
  } else {
    avisos.push('No se ha encontrado ningún NIF/CIF válido del proveedor.')
  }

  // ── Número de factura ──
  // Se salta las líneas de totales: «TOTAL FACTURA 2.238,50» contiene la palabra
  // «factura» y su número es un importe, no una referencia.
  const esImporte = (v: string) => /^\d{1,3}([.,]\d{3})*[.,]\d{2}$|^\d+[.,]\d{2}$/.test(v)
  const ES_ROTULO = /^(factura|fra|num|numero|serie|ref|referencia)$/i

  for (const linea of limpias) {
    const n = normalizar(linea)
    if (!/factura|fra\./.test(n)) continue
    if (/total|importe|base|iva/.test(n)) continue

    // Se recogen todos los tokens tras el rótulo y se coge el primero que
    // parezca una referencia: con dígitos, que no sea un importe ni otro rótulo.
    const desde = n.search(/factura|fra\./)
    const tokens = linea.slice(desde).match(/[A-Za-z0-9][A-Za-z0-9/\-.]{2,24}/g) ?? []
    const valor = tokens
      .map((t) => t.replace(/[.\-]+$/, ''))
      .find((t) => /\d/.test(t) && !esImporte(t) && !ES_ROTULO.test(t))
    if (valor) {
      datos.numFactura = valor
      encontrados.push('numFactura')
      break
    }
  }
  if (!datos.numFactura) avisos.push('No se ha localizado el número de factura.')

  // ── Fecha ──
  const RE_FECHA = /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+[A-Za-zÁÉÍÓÚáéíóú]{3,10}\.?\s+\d{2,4})/
  // Primero la que va junto a la palabra «fecha»; si no, la primera del documento.
  const conEtiqueta = limpias.find((l) => normalizar(l).includes('fecha') && RE_FECHA.test(l))
  const cualquiera = limpias.find((l) => RE_FECHA.test(l))
  const bruta = RE_FECHA.exec(conEtiqueta ?? cualquiera ?? '')?.[1]
  const fecha = bruta ? parsearFechaFlexible(bruta) : null
  if (fecha) {
    datos.fecha = fecha
    encontrados.push('fecha')
  } else {
    avisos.push('No se ha localizado la fecha de la factura.')
  }

  // ── Importes ──
  const total = importePorEtiqueta(limpias, ['total factura', 'importe total', 'total a pagar', 'total'], convencion, ['subtotal'])
  const base = importePorEtiqueta(limpias, ['base imponible', 'base'], convencion)
  const cuota = importePorEtiqueta(limpias, ['cuota iva', 'i.v.a', 'iva'], convencion, ['base'])

  const tipoMatch = /\b(?:iva|i\.v\.a\.?)\s*[:\s]*(\d{1,2})\s*%|\b(\d{1,2})\s*%\s*(?:de\s+)?iva/i.exec(texto)
  const tipoIva = tipoMatch ? Number(tipoMatch[1] ?? tipoMatch[2]) : undefined

  // El cuadre manda: si base + cuota no da el total, no se rellena nada.
  if (base !== undefined && cuota !== undefined && total !== undefined) {
    const suma = aEuros(aCentimos(base) + aCentimos(cuota))
    if (Math.abs(aCentimos(suma) - aCentimos(total)) > 2) {
      avisos.push(
        `Los importes leídos no cuadran: base ${base} + IVA ${cuota} = ${suma}, pero el total dice ${total}. No se rellenan; revísalos a mano.`,
      )
    } else {
      datos.base = base
      datos.cuota = cuota
      datos.total = total
      encontrados.push('base', 'cuota', 'total')
    }
  } else if (base !== undefined && tipoIva !== undefined) {
    // Con base y tipo se puede deducir la cuota sin inventar nada.
    const calculada = aEuros(Math.round(aCentimos(base) * (tipoIva / 100)))
    datos.base = base
    datos.cuota = calculada
    datos.total = aEuros(aCentimos(base) + aCentimos(calculada))
    encontrados.push('base', 'cuota', 'total')
    avisos.push(`La cuota de IVA se ha calculado como el ${tipoIva} % de la base; confírmala.`)
  } else if (total !== undefined && tipoIva !== undefined) {
    // Solo el total: se desglosa hacia atrás.
    const b = aEuros(Math.round((aCentimos(total) * 100) / (100 + tipoIva)))
    datos.base = b
    datos.cuota = aEuros(aCentimos(total) - aCentimos(b))
    datos.total = total
    encontrados.push('base', 'cuota', 'total')
    avisos.push(`Solo se ha leído el total: la base se ha desglosado al ${tipoIva} %. Confírmala.`)
  } else {
    avisos.push('No se han podido leer los importes con seguridad. Rellénalos a mano.')
  }

  if (tipoIva !== undefined) {
    datos.tipoIva = tipoIva
    encontrados.push('tipoIva')
  }

  // ── Proveedor: la primera línea con letra que no sea un rótulo ni un importe ──
  const candidata = limpias.find(
    (l) =>
      l.length > 3 &&
      l.length < 80 &&
      /[A-Za-zÁÉÍÓÚÑ]{3}/.test(l) &&
      !/factura|fecha|total|iva|base|n\.?º|cliente|pagina|página/i.test(normalizar(l)) &&
      !RE_NIF.test(l),
  )
  if (candidata) {
    datos.proveedor = candidata
    encontrados.push('proveedor')
  }

  return datos
}
