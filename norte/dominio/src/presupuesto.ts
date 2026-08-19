import type { TipoCategoria } from './categorias-defecto.js'
import { comprobarCentimos, type Centimos } from './dinero.js'
import { diasDelMes, type FechaISO } from './fechas.js'

/**
 * Presupuesto por sobres.
 *
 * La idea es vieja y sigue siendo la que funciona: a principio de mes, cada
 * euro que esperas recibir se mete en un sobre con un nombre. Cuando el sobre
 * se vacía, se acabó esa partida — no se coge del de al lado sin decidirlo.
 *
 * Dos cosas separan un presupuesto útil de una tabla bonita:
 *
 *  1. **El ritmo.** «Llevas gastado el 60 % de la compra» no dice nada. Dicho
 *     el día 10 es una alarma y dicho el día 28 es una buena noticia. Aquí
 *     siempre se compara el gasto con el mes transcurrido.
 *  2. **Lo previsto no se mezcla con lo gastado.** Un recibo domiciliado que
 *     aún no ha pasado no se ha gastado, pero tampoco está disponible. Van en
 *     columnas distintas, igual que en la pantalla de movimientos.
 */

export interface EntradaSobre {
  categoriaId: string
  categoria: string
  tipo: TipoCategoria
  esencial: boolean
  /** Lo asignado a este sobre este mes. */
  asignado: Centimos
  /** Lo que sobró (o faltó) el mes pasado y se arrastra, si está activado. */
  arrastrado: Centimos
  /** Gasto confirmado del mes, en positivo. */
  gastado: Centimos
  /** Gasto previsto del mes que aún no ha pasado, en positivo. */
  previsto: Centimos
  rollover: boolean
}

/** Cómo va el sobre respecto al calendario, no respecto al total. */
export type Ritmo = 'holgado' | 'justo' | 'pasado' | 'sin_asignar'

export interface Sobre extends EntradaSobre {
  /** Lo que hay de verdad en el sobre: asignado + arrastrado. */
  presupuesto: Centimos
  /** Lo que queda hoy. */
  disponible: Centimos
  /** Lo que quedará si se cumple todo lo previsto. */
  disponibleTrasPrevisto: Centimos
  /** 0–100 y sin tope: gastar el doble de lo asignado da 200. */
  porcentajeGastado: number
  ritmo: Ritmo
  /**
   * Lo que se puede gastar cada día que queda de mes sin pasarse.
   *
   * Se calcula sobre lo que quedará **después de lo previsto**, no sobre el
   * disponible de hoy. La diferencia se vio en pantalla: un sobre de vivienda
   * con 750 € y el alquiler domiciliado sin pasar decía «750 € disponible,
   * 58 €/día», y gastarlos habría dejado el recibo al descubierto.
   *
   * `null` en un mes cerrado, en un sobre sin asignación o cuando no queda
   * nada: un número por día ahí sería ruido con aspecto de consejo.
   */
  porDia: Centimos | null
}

export interface CalendarioMes {
  /** 0–100. El día 15 de un mes de 30 son 50. */
  porcentajeTranscurrido: number
  /** Días que faltan, contando hoy. 0 si el mes ya pasó. */
  diasRestantes: number
}

/** Margen antes de decir que un sobre va adelantado. Sin él, el día 2 medio
 *  presupuesto estaría en ámbar por comprar el pan. */
const MARGEN_RITMO = 5

export function calcularSobre(entrada: EntradaSobre, calendario: CalendarioMes): Sobre {
  const presupuesto = comprobarCentimos(entrada.asignado + entrada.arrastrado)
  const disponible = comprobarCentimos(presupuesto - entrada.gastado)
  const disponibleTrasPrevisto = comprobarCentimos(disponible - entrada.previsto)
  const porcentajeGastado = presupuesto > 0 ? (entrada.gastado / presupuesto) * 100 : 0

  let ritmo: Ritmo
  if (presupuesto <= 0) ritmo = entrada.gastado > 0 ? 'pasado' : 'sin_asignar'
  else if (entrada.gastado > presupuesto) ritmo = 'pasado'
  else if (porcentajeGastado > calendario.porcentajeTranscurrido + MARGEN_RITMO) ritmo = 'justo'
  else ritmo = 'holgado'

  const porDia =
    calendario.diasRestantes > 0 && presupuesto > 0 && disponibleTrasPrevisto > 0
      ? Math.floor(disponibleTrasPrevisto / calendario.diasRestantes)
      : null

  return {
    ...entrada,
    presupuesto,
    disponible,
    disponibleTrasPrevisto,
    porcentajeGastado,
    ritmo,
    porDia,
  }
}

export interface ResumenPresupuesto {
  /** Lo que se espera que entre este mes: confirmado + previsto. */
  ingresos: Centimos
  asignado: Centimos
  gastado: Centimos
  previsto: Centimos
  /** Ingresos menos lo repartido. **La cifra del método**: mientras no sea
   *  cero, hay dinero sin trabajo asignado (o de más repartido). */
  sinAsignar: Centimos
  disponible: Centimos
  sobresPasados: number
  sobresEnRiesgo: number
}

export function resumirPresupuesto(sobres: Sobre[], ingresos: Centimos): ResumenPresupuesto {
  const suma = (elegir: (s: Sobre) => Centimos) => sobres.reduce((total, s) => total + elegir(s), 0)
  const asignado = suma((s) => s.asignado)

  return {
    ingresos: comprobarCentimos(ingresos),
    asignado: comprobarCentimos(asignado),
    gastado: comprobarCentimos(suma((s) => s.gastado)),
    previsto: comprobarCentimos(suma((s) => s.previsto)),
    sinAsignar: comprobarCentimos(ingresos - asignado),
    disponible: comprobarCentimos(suma((s) => s.disponible)),
    sobresPasados: sobres.filter((s) => s.ritmo === 'pasado').length,
    // «En riesgo» es el sobre que va adelantado y además no llega a fin de mes
    // con lo previsto. Va aparte de los pasados para no contar dos veces.
    sobresEnRiesgo: sobres.filter((s) => s.ritmo === 'justo' && s.disponibleTrasPrevisto < 0).length,
  }
}

/** Dónde está el mes respecto a hoy. Un mes pasado va al 100 %; uno futuro, a 0. */
export function calendarioDelMes(mes: FechaISO, hoy: Date): CalendarioMes {
  const [anio, numeroMes] = mes.split('-').map(Number)
  const total = diasDelMes(anio!, (numeroMes ?? 1) - 1)
  const primero = new Date(anio!, (numeroMes ?? 1) - 1, 1)
  const siguiente = new Date(anio!, numeroMes ?? 1, 1)
  const ahora = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())

  if (ahora < primero) return { porcentajeTranscurrido: 0, diasRestantes: total }
  if (ahora >= siguiente) return { porcentajeTranscurrido: 100, diasRestantes: 0 }

  const dia = ahora.getDate()
  return {
    porcentajeTranscurrido: (dia / total) * 100,
    // Cuenta hoy: el día 30 de un mes de 30 aún se puede gastar.
    diasRestantes: total - dia + 1,
  }
}

// ────────────────────────────────────────────────────── Cierre y arrastre

export interface ArrastreDeLinea {
  categoriaId: string
  /** Positivo si sobró, negativo si se pasó. */
  arrastrado: Centimos
  motivo: 'sobro' | 'se_paso' | 'no_arrastra'
}

/**
 * Qué se lleva cada sobre al mes siguiente.
 *
 * Con `rollover` activado se arrastra **lo que sobró y también lo que faltó**.
 * Arrastrar solo lo bueno convierte el presupuesto en un marcador amable: si
 * este mes te pasaste 80 € en restaurantes, el mes que viene empiezas con 80 €
 * menos, que es lo que hace que el método funcione.
 */
export function calcularArrastre(sobres: Sobre[]): ArrastreDeLinea[] {
  return sobres.map((sobre) => {
    if (!sobre.rollover) {
      return { categoriaId: sobre.categoriaId, arrastrado: 0, motivo: 'no_arrastra' as const }
    }
    return {
      categoriaId: sobre.categoriaId,
      arrastrado: sobre.disponible,
      motivo: sobre.disponible >= 0 ? ('sobro' as const) : ('se_paso' as const),
    }
  })
}

// ──────────────────────────────────────────── Propuesta del mes siguiente

export type BaseDePropuesta = 'mediana' | 'ultimo_mes' | 'sin_historico'

export interface Propuesta {
  categoriaId: string
  propuesto: Centimos
  base: BaseDePropuesta
  /** Cuántos meses de gasto real se han mirado para proponerlo. */
  mesesMirados: number
}

/**
 * Propone la asignación del mes que viene a partir del gasto real.
 *
 * Se usa la **mediana** y no la media: un mes con la revisión del coche dentro
 * arrastraría la media de «Transporte» hacia arriba para siempre, y el usuario
 * acabaría presupuestando un coche averiado cada mes.
 *
 * Los gastos **fijos** no se medianizan: se toma el último mes, porque un
 * recibo de la luz no es una distribución, es un importe que se repite y que
 * cambia cuando cambia.
 *
 * Se redondea al euro hacia arriba. Un presupuesto con céntimos es un
 * presupuesto que nadie se cree.
 */
export function proponerAsignacion(
  categoria: { categoriaId: string; tipo: TipoCategoria },
  gastoPorMes: Centimos[],
): Propuesta {
  const historico = gastoPorMes.filter((g) => g > 0)
  if (historico.length === 0) {
    return { categoriaId: categoria.categoriaId, propuesto: 0, base: 'sin_historico', mesesMirados: 0 }
  }

  if (categoria.tipo === 'fijo') {
    return {
      categoriaId: categoria.categoriaId,
      propuesto: aEurosEnteros(gastoPorMes[gastoPorMes.length - 1] ?? historico[historico.length - 1]!),
      base: 'ultimo_mes',
      mesesMirados: 1,
    }
  }

  const ordenados = [...historico].sort((a, b) => a - b)
  const medio = Math.floor(ordenados.length / 2)
  const mediana =
    ordenados.length % 2 === 1
      ? ordenados[medio]!
      : Math.round((ordenados[medio - 1]! + ordenados[medio]!) / 2)

  return {
    categoriaId: categoria.categoriaId,
    propuesto: aEurosEnteros(mediana),
    base: 'mediana',
    mesesMirados: historico.length,
  }
}

/** Redondea al euro hacia arriba, en céntimos. */
function aEurosEnteros(centimos: Centimos): Centimos {
  return comprobarCentimos(Math.ceil(centimos / 100) * 100)
}
