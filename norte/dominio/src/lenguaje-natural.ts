import { parsearImporte, type Centimos } from './dinero.js'
import { aISO, indiceDelDia, sumarDias, type FechaISO } from './fechas.js'

/**
 * «café 3,40 ayer» → un apunte.
 *
 * Es el principio 2 del encargo —apuntar un gasto no puede costar más de tres
 * toques— y por eso vive en el dominio con tests: la entrada rápida es lo que
 * decide si alguien sigue usando la app en marzo o la abandonó en febrero.
 *
 * La regla de fondo: **entender lo que se puede y no inventar el resto**. Si no
 * hay importe, se devuelve `null` en el importe y la interfaz pide ese dato;
 * adivinarlo sería meter una cifra falsa en las cuentas de alguien.
 */

export interface ApunteLeido {
  concepto: string
  /** Céntimos. Negativo = gasto. `null` si no se ha encontrado importe. */
  importe: Centimos | null
  fecha: FechaISO
  esIngreso: boolean
  /** Qué se ha entendido y de dónde, para poder enseñarlo antes de guardar. */
  entendido: { importe: boolean; fecha: boolean }
}

/** Palabras que delatan un ingreso aunque no lleve el «+» delante. */
const PALABRAS_INGRESO = [
  'nomina',
  'nómina',
  'sueldo',
  'ingreso',
  'cobro',
  'cobrado',
  'devolucion',
  'devolución',
  'reembolso',
  'paga',
  'factura cobrada',
  'transferencia recibida',
]

const sinTildes = (t: string) =>
  t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function leerApunte(texto: string, hoy: Date): ApunteLeido {
  const original = (texto ?? '').trim()
  let resto = original
  let fecha = hoy
  let fechaEntendida = false

  // 1. La fecha primero: sus palabras («ayer», «el viernes») se quitan del
  //    texto antes de buscar el importe, o «el 5» se confundiría con 5 €.
  const conFecha = extraerFecha(resto, hoy)
  if (conFecha) {
    fecha = conFecha.fecha
    resto = conFecha.resto
    fechaEntendida = true
  }

  // 2. El importe.
  const conImporte = extraerImporte(resto)
  const importe = conImporte?.importe ?? null
  if (conImporte) resto = conImporte.resto

  // 3. Lo que queda es el concepto.
  const concepto = limpiarConcepto(resto)

  const marcadoIngreso =
    Boolean(conImporte?.signoExplicito === 'mas') ||
    PALABRAS_INGRESO.some((p) => sinTildes(original).includes(sinTildes(p)))
  const esIngreso = conImporte?.signoExplicito === 'menos' ? false : marcadoIngreso

  return {
    concepto,
    importe:
      importe === null ? null : esIngreso ? Math.abs(importe) : -Math.abs(importe),
    fecha: aISO(fecha),
    esIngreso,
    entendido: { importe: importe !== null, fecha: fechaEntendida },
  }
}

function extraerImporte(
  texto: string,
): { importe: Centimos; resto: string; signoExplicito: 'mas' | 'menos' | null } | null {
  const trozos = texto.split(/\s+/)
  const candidatos: { i: number; trozo: string; importe: Centimos }[] = []
  for (let i = 0; i < trozos.length; i++) {
    const trozo = trozos[i]!
    if (!/\d/.test(trozo)) continue
    const importe = parsearImporte(trozo)
    if (importe === null || importe === 0) continue
    candidatos.push({ i, trozo, importe })
  }
  if (candidatos.length === 0) return null

  /*
   * Con varios números manda el que **parece dinero**, no el primero: en
   * «5 cañas 12,50» lo que se ha gastado son 12,50 €, y las 5 son cañas. Por
   * orden: el que lleva el símbolo, el que lleva decimales, y si ninguno los
   * lleva, el primero («45 gasolina»).
   */
  const elegido =
    candidatos.find((c) => /[€$]/.test(c.trozo)) ??
    candidatos.find((c) => /[.,]\d{2}$/.test(c.trozo)) ??
    candidatos[0]!

  const signoExplicito = elegido.trozo.startsWith('+')
    ? 'mas'
    : elegido.trozo.startsWith('-')
      ? 'menos'
      : null
  const resto = [...trozos.slice(0, elegido.i), ...trozos.slice(elegido.i + 1)].join(' ')
  return { importe: Math.abs(elegido.importe), resto, signoExplicito }
}

function extraerFecha(texto: string, hoy: Date): { fecha: Date; resto: string } | null {
  const quitar = (patron: RegExp, fecha: Date) => ({
    fecha,
    resto: texto.replace(patron, ' ').replace(/\s+/g, ' ').trim(),
  })

  const plano = sinTildes(texto)

  if (/\bantes de ayer\b|\banteayer\b/.test(plano)) {
    return quitar(/\bantes de ayer\b|\banteayer\b/i, sumarDias(hoy, -2))
  }
  if (/\bayer\b/.test(plano)) return quitar(/\bayer\b/i, sumarDias(hoy, -1))
  if (/\bhoy\b/.test(plano)) return quitar(/\bhoy\b/i, hoy)
  if (/\bmanana\b/.test(plano)) return quitar(/\bmañana\b|\bmanana\b/i, sumarDias(hoy, 1))

  // Día de la semana: «el viernes» es el viernes más reciente que ya pasó,
  // porque casi siempre se apunta algo que ya se ha gastado.
  const dia = plano.match(/\b(?:el\s+)?(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/)
  if (dia) {
    const objetivo = indiceDelDia(dia[1]!)
    if (objetivo !== null) {
      const diferencia = (hoy.getDay() - objetivo + 7) % 7
      const fecha = sumarDias(hoy, -(diferencia === 0 ? 7 : diferencia))
      return quitar(new RegExp(`\\b(?:el\\s+)?${dia[1]}\\b`, 'i'), fecha)
    }
  }

  // Fechas escritas: 5/8, 05-08, 5/8/2026.
  const escrita = texto.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/)
  if (escrita) {
    const d = Number(escrita[1])
    const m = Number(escrita[2])
    const a = escrita[3] ? Number(escrita[3].length === 2 ? `20${escrita[3]}` : escrita[3]) : hoy.getFullYear()
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      return quitar(new RegExp(escrita[0].replace(/[/\\]/g, '\\$&')), new Date(a, m - 1, d))
    }
  }

  // «el 5»: día de este mes, o del anterior si aún no ha llegado.
  const delMes = texto.match(/\bel\s+(\d{1,2})\b/)
  if (delMes) {
    const d = Number(delMes[1])
    if (d >= 1 && d <= 31) {
      const fecha = new Date(hoy.getFullYear(), hoy.getMonth(), d)
      if (fecha.getTime() > hoy.getTime()) fecha.setMonth(fecha.getMonth() - 1)
      return quitar(/\bel\s+\d{1,2}\b/i, fecha)
    }
  }
  return null
}

function limpiarConcepto(texto: string): string {
  const limpio = texto
    .replace(/\b(en|de|del|la|el|los|las|un|una|por)\b/gi, ' ')
    .replace(/[€$]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!limpio) return ''
  return limpio.charAt(0).toUpperCase() + limpio.slice(1)
}
