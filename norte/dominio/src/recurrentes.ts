import { aISO, deISO, diasDelMes, sumarDias, ultimoDiaHabilDelMes, type FechaISO } from './fechas.js'

/**
 * Movimientos que se repiten: la nómina, el alquiler, el seguro, Netflix.
 *
 * Generan movimientos **previstos**, que se confirman o se ajustan cuando pasan
 * de verdad. Nunca se dan por hechos solos: un recibo previsto que se cuenta
 * como pagado deja el saldo de la app peleado con el del banco.
 */

export type Periodicidad =
  | 'semanal'
  | 'quincenal'
  | 'mensual'
  | 'bimestral'
  | 'trimestral'
  | 'semestral'
  | 'anual'

export interface Regla {
  periodicidad: Periodicidad
  /** Primera vez que toca. */
  desde: FechaISO
  hasta?: FechaISO | null
  /** Para las periodicidades por meses. Si no, se usa el día de `desde`. */
  diaDelMes?: number | null
  /** Muchas nóminas caen aquí, y no es un número fijo. Manda sobre `diaDelMes`. */
  ultimoDiaHabil?: boolean
}

const MESES_POR_PERIODO: Partial<Record<Periodicidad, number>> = {
  mensual: 1,
  bimestral: 2,
  trimestral: 3,
  semestral: 6,
  anual: 12,
}

const DIAS_POR_PERIODO: Partial<Record<Periodicidad, number>> = {
  semanal: 7,
  quincenal: 14,
}

/** Tope de seguridad: sin él, un `hasta` lejano y una periodicidad semanal
 *  generarían miles de filas sin que nadie lo pidiera. */
const MAXIMO = 500

/**
 * Las fechas en que toca, dentro de la ventana `[desde, hasta]`.
 *
 * La ventana es de la consulta, no de la regla: se pregunta «¿qué me toca este
 * mes?» o «¿y en los próximos 30 días?», que es de donde sale la proyección.
 */
export function fechasDe(regla: Regla, desde: Date, hasta: Date): FechaISO[] {
  const inicio = deISO(regla.desde)
  const fin = regla.hasta ? menor(deISO(regla.hasta), hasta) : hasta
  const fechas: FechaISO[] = []
  if (fin < inicio) return fechas

  const porDias = DIAS_POR_PERIODO[regla.periodicidad]
  if (porDias) {
    let fecha = inicio
    // Se salta hacia delante en bloques en vez de día a día: con una regla
    // semanal de hace diez años, ir de uno en uno son 3.650 vueltas para nada.
    if (fecha < desde) {
      const saltos = Math.floor((desde.getTime() - fecha.getTime()) / (porDias * 86400000))
      fecha = sumarDias(fecha, saltos * porDias)
    }
    while (fecha <= fin && fechas.length < MAXIMO) {
      if (fecha >= desde) fechas.push(aISO(fecha))
      fecha = sumarDias(fecha, porDias)
    }
    return fechas
  }

  const porMeses = MESES_POR_PERIODO[regla.periodicidad] ?? 1
  const diaBase = regla.diaDelMes ?? inicio.getDate()

  let anio = inicio.getFullYear()
  let mes = inicio.getMonth()
  for (let vuelta = 0; vuelta < MAXIMO; vuelta++) {
    const fecha = regla.ultimoDiaHabil
      ? ultimoDiaHabilDelMes(anio, mes)
      : // Un recibo del día 31 no se salta febrero: se queda en el último día.
        new Date(anio, mes, Math.min(diaBase, diasDelMes(anio, mes)))

    if (fecha > fin) break
    if (fecha >= desde && fecha >= inicio) fechas.push(aISO(fecha))

    mes += porMeses
    anio += Math.floor(mes / 12)
    mes = ((mes % 12) + 12) % 12
  }
  return fechas
}

function menor(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b
}

/** La próxima vez que toca a partir de una fecha, o `null` si la regla ya acabó. */
export function proximaFecha(regla: Regla, desde: Date): FechaISO | null {
  const dentroDeUnAnio = new Date(desde.getFullYear() + 1, desde.getMonth(), desde.getDate())
  return fechasDe(regla, desde, dentroDeUnAnio)[0] ?? null
}
