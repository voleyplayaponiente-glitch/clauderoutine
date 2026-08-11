/**
 * Lectura del acuerdo de **aplazamiento o fraccionamiento** de la AEAT.
 *
 * Un aplazamiento no es un préstamo: Hacienda publica el calendario de
 * vencimientos **plazo a plazo**, con su principal y sus intereses, y no tienen
 * por qué ser iguales. Por eso lo que sale de aquí es un **cuadro leído**
 * (`Deuda.cuadroFijo`), no una fórmula: se registran los plazos que dice el
 * documento, ni uno más ni uno menos.
 *
 * Como con las facturas: **propone, no decide**. Lo que no se pueda leer se
 * deja en blanco y se dice.
 */
import { parsearImporte, detectarConvencionNumerica } from './parseo-es'
import { aplanar } from './prestamo-archivo'
import type { PlazoDeuda } from './tipos'

export interface DatosAplazamiento {
  /** Nº de expediente o de la solicitud, tal cual viene. */
  referencia?: string
  nif?: string
  /** Deuda total aplazada (principal), si el documento la dice. */
  importeTotal?: number
  /** Suma de los plazos leídos, intereses incluidos. */
  totalPlazos?: number
  tipoInteres?: number
  plazos: PlazoDeuda[]
  organismo: 'HACIENDA' | 'SEGURIDAD_SOCIAL'
  encontrados: string[]
  avisos: string[]
}

const RE_FECHA = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/
const RE_IMPORTE = /-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2}/g

/**
 * ¿Estas filas son un acuerdo de aplazamiento? Se piden **dos señales**: con
 * una sola, cualquier escrito de Hacienda colaría.
 */
export function esAplazamiento(filas: unknown[][]): { es: boolean; organismo: 'HACIENDA' | 'SEGURIDAD_SOCIAL' } {
  const texto = aplanar(filas.map((f) => f.map((c) => String(c ?? '')).join(' ')).join(' \n '))
  const señales = [
    'aplazamiento',
    'fraccionamiento',
    'calendario de pagos',
    'plazos concedidos',
    'vencimiento de los plazos',
    'acuerdo de concesion',
    'deuda aplazada',
  ]
  const es = señales.filter((s) => texto.includes(s)).length >= 2
  const seguridadSocial =
    texto.includes('seguridad social') || texto.includes('tesoreria general') || texto.includes('tgss')
  return { es, organismo: seguridadSocial ? 'SEGURIDAD_SOCIAL' : 'HACIENDA' }
}

/** Valor tras un rótulo, en la misma línea o en la celda siguiente. */
function trasRotulo(filas: unknown[][], ...rotulos: string[]): string | undefined {
  for (const fila of filas) {
    const celdas = fila.map((c) => String(c ?? '').trim()).filter((c) => c !== '')
    const linea = celdas.join(' ')
    const plano = aplanar(linea)
    for (const r of rotulos) {
      const pos = plano.indexOf(aplanar(r))
      if (pos === -1) continue
      const resto = linea.slice(pos + r.length).replace(/^[\s:.]+/, '').trim()
      if (resto !== '') return resto
    }
  }
  return undefined
}

/**
 * Lee el calendario. Una fila de plazo es la que tiene **una fecha y al menos
 * un importe**; con tres importes se entienden como principal, intereses y
 * total, que es como los imprime la AEAT.
 */
export function leerAplazamiento(filas: unknown[][]): DatosAplazamiento {
  const { organismo } = esAplazamiento(filas)
  const datos: DatosAplazamiento = { plazos: [], organismo, encontrados: [], avisos: [] }

  const todas = filas.map((f) => f.map((c) => String(c ?? '').trim()).filter((c) => c !== '').join(' '))

  // **Los plazos están en el ANEXO I.** El ANEXO II es el detalle de intereses y
  // repite cada plazo con sus fechas y sus importes: leerlo duplicaría el
  // calendario. Se corta en su encabezado, que es la línea que EMPIEZA por
  // «ANEXO II» (no vale buscarlo suelto: la página 1 lo menciona de pasada).
  const finAnexoI = todas.findIndex((l) => aplanar(l).trimStart().startsWith('anexo ii'))
  const lineas = finAnexoI === -1 ? todas : todas.slice(0, finAnexoI)

  const convencion = detectarConvencionNumerica(lineas.flatMap((l) => l.match(RE_IMPORTE) ?? []))
  const num = (s: string) => {
    const n = parsearImporte(s, convencion === 'AUTO' ? 'ES' : convencion)
    return n === null ? undefined : n
  }

  for (const linea of lineas) {
    const mFecha = RE_FECHA.exec(linea)
    if (!mFecha) continue
    const importes = (linea.match(RE_IMPORTE) ?? []).map(num).filter((n): n is number => n !== undefined && n > 0)
    if (importes.length === 0) continue

    const [, d, m, a] = mFecha
    if (Number(m) < 1 || Number(m) > 12 || Number(d) < 1 || Number(d) > 31) continue
    const fecha = `${a}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`

    // Con tres importes: principal, intereses y total (el total es el mayor).
    if (importes.length >= 3) {
      const total = Math.max(...importes)
      const resto = [...importes]
      resto.splice(importes.indexOf(total), 1)
      const intereses = Math.min(...resto)
      const capital = resto.find((x) => x !== intereses) ?? total - intereses
      datos.plazos.push({ fecha, cuota: total, intereses, capital })
    } else {
      datos.plazos.push({ fecha, cuota: Math.max(...importes) })
    }
  }

  datos.plazos.sort((a, b) => a.fecha.localeCompare(b.fecha))
  if (datos.plazos.length > 0) {
    datos.encontrados.push('plazos')
    datos.totalPlazos = Math.round(datos.plazos.reduce((s, p) => s + p.cuota, 0) * 100) / 100
    datos.encontrados.push('totalPlazos')
  } else {
    datos.avisos.push('No se ha reconocido ningún plazo con fecha e importe. Revisa el documento o mete los plazos a mano.')
  }

  const ref = trasRotulo(filas, 'número de expediente', 'numero de expediente', 'expediente', 'referencia')
  if (ref) {
    datos.referencia = ref.split(/\s{2,}/)[0].trim()
    datos.encontrados.push('referencia')
  }
  // La AEAT lo escribe «N.I.F.:», con puntos.
  const nif = trasRotulo(filas, 'n.i.f', 'nif', 'cif')
  if (nif) {
    // Se quitan puntos y guiones, pero NO los espacios: sin ellos el NIF se
    // pegaría a la razón social y dejaría de reconocerse.
    const m = /\b[A-Z]?\d{7,8}[A-Z]?\b/i.exec(nif.replace(/[.-]/g, ''))
    if (m) {
      datos.nif = m[0].toUpperCase()
      datos.encontrados.push('nif')
    }
  }
  const tipo = trasRotulo(filas, 'tipo de interés', 'tipo de interes', 'interés de demora', 'interes de demora')
  if (tipo) {
    // El rótulo sigue («…de demora: 4,0625 %»), así que se coge la primera
    // cifra que aparezca detrás en vez de intentar parsear la frase entera.
    const n = num((/\d+(?:[.,]\d+)?/.exec(tipo) ?? [''])[0])
    if (n !== undefined && n > 0 && n < 100) {
      datos.tipoInteres = n
      datos.encontrados.push('tipoInteres')
    }
  }
  // El acuerdo real no dice «importe aplazado»: lo redacta en una frase
  // («…que se relacionan en el Anexo I por un importe de 12.449,65 euros»).
  const total = trasRotulo(filas, 'importe aplazado', 'deuda aplazada', 'importe total de la deuda', 'total deuda', 'por un importe de')
  if (total) {
    const n = num((total.match(RE_IMPORTE) ?? [''])[0])
    if (n !== undefined) {
      datos.importeTotal = n
      datos.encontrados.push('importeTotal')
    }
  }

  // Cuadre: la suma de los plazos tiene que dar la deuda + los intereses. Si el
  // documento dice el importe aplazado y no cuadra, se avisa; no se corrige.
  if (datos.importeTotal !== undefined && datos.totalPlazos !== undefined) {
    const intereses = datos.plazos.reduce((s, p) => s + (p.intereses ?? 0), 0)
    const esperado = Math.round((datos.importeTotal + intereses) * 100) / 100
    if (Math.abs(esperado - datos.totalPlazos) > 1) {
      datos.avisos.push(
        `La suma de los plazos (${datos.totalPlazos} €) no cuadra con la deuda aplazada más sus intereses (${esperado} €). ` +
          'Puede que falte algún plazo por leer: compruébalo antes de guardar.',
      )
    }
  }

  if (datos.plazos.length > 0 && datos.tipoInteres === undefined) {
    datos.avisos.push('No se ha leído el tipo de interés de demora, pero no hace falta: los plazos se registran tal y como vienen.')
  }

  return datos
}
