import { comprobarCentimos, type Centimos } from './dinero.js'
import { deISO, type FechaISO } from './fechas.js'

/**
 * Inversiones: rentabilidad, cartera y rebalanceo.
 *
 * Dos rentabilidades distintas y las dos hacen falta, porque responden a
 * preguntas distintas:
 *
 *  · **TWR** (time-weighted) mide **cómo lo ha hecho la inversión**, sin que la
 *    contamine cuándo metiste dinero. Es la que sirve para comparar con un
 *    índice.
 *  · **TIR / XIRR** (money-weighted) mide **cómo te ha ido a ti**, y sí depende
 *    de cuándo aportaste. Es la que dice si tu dinero ha crecido.
 *
 * Enseñar solo una de las dos es dar media respuesta, y enseñarlas sin decir
 * cuál es cuál es peor todavía.
 */

export interface Flujo {
  fecha: FechaISO
  /** Céntimos. **Negativo lo que sale de tu bolsillo** (aportación, compra) y
   *  positivo lo que vuelve (venta, dividendo, valor final de la cartera). */
  importe: Centimos
}

/** Días entre dos fechas, base 365. Es la convención de la función XIRR de las
 *  hojas de cálculo, así que los números cuadran con lo que la gente tiene en
 *  su Excel. Un año bisiesto da 366/365, y por eso perder un 20 % en 2024 sale
 *  como −19,95 % anual y no como −20 % exacto. */
function anios(desde: Date, hasta: Date): number {
  return (hasta.getTime() - desde.getTime()) / 86_400_000 / 365
}

function van(tasa: number, flujos: { t: number; importe: number }[]): number {
  let total = 0
  for (const { t, importe } of flujos) total += importe / Math.pow(1 + tasa, t)
  return total
}

function derivada(tasa: number, flujos: { t: number; importe: number }[]): number {
  let total = 0
  for (const { t, importe } of flujos) total += (-t * importe) / Math.pow(1 + tasa, t + 1)
  return total
}

/**
 * TIR de flujos en fechas cualesquiera (lo que en Excel es XIRR), en tanto por
 * ciento anual.
 *
 * Newton-Raphson desde el 10 %, y **si no converge, bisección**. Y si tampoco
 * hay solución —porque todos los flujos van en el mismo sentido, que es lo que
 * pasa en una cartera a la que solo has aportado y aún no has valorado—
 * devuelve `null`.
 *
 * Devolver `null` es la parte importante. Una rentabilidad inventada en una
 * pantalla de inversiones es la clase de número que alguien usa para tomar una
 * decisión de verdad.
 */
export function xirr(flujos: Flujo[]): number | null {
  if (flujos.length < 2) return null
  const hayPositivo = flujos.some((f) => f.importe > 0)
  const hayNegativo = flujos.some((f) => f.importe < 0)
  if (!hayPositivo || !hayNegativo) return null

  const ordenados = [...flujos].sort((a, b) => a.fecha.localeCompare(b.fecha))
  const origen = deISO(ordenados[0]!.fecha)
  const normalizados = ordenados.map((f) => ({ t: anios(origen, deISO(f.fecha)), importe: f.importe }))

  // ── Newton-Raphson
  let tasa = 0.1
  for (let i = 0; i < 60; i++) {
    const valor = van(tasa, normalizados)
    if (!Number.isFinite(valor)) break
    if (Math.abs(valor) < 1e-6) return tasa * 100
    const pendiente = derivada(tasa, normalizados)
    if (!Number.isFinite(pendiente) || pendiente === 0) break
    const siguiente = tasa - valor / pendiente
    if (!Number.isFinite(siguiente) || siguiente <= -0.9999) break
    if (Math.abs(siguiente - tasa) < 1e-10) return siguiente * 100
    tasa = siguiente
  }

  // ── Bisección, que es lenta pero no se pierde
  let bajo = -0.9999
  let alto = 10
  const fBajo = van(bajo, normalizados)
  const fAlto = van(alto, normalizados)
  if (!Number.isFinite(fBajo) || !Number.isFinite(fAlto) || fBajo * fAlto > 0) return null

  for (let i = 0; i < 300; i++) {
    const medio = (bajo + alto) / 2
    const fMedio = van(medio, normalizados)
    if (Math.abs(fMedio) < 1e-9 || alto - bajo < 1e-12) return medio * 100
    if (van(bajo, normalizados) * fMedio <= 0) alto = medio
    else bajo = medio
  }
  return ((bajo + alto) / 2) * 100
}

export interface SubPeriodo {
  /** Valor de la cartera al empezar el tramo. */
  valorInicial: Centimos
  /** Lo que entra (positivo) o sale (negativo) al principio del tramo. */
  flujo: Centimos
  valorFinal: Centimos
}

/**
 * Rentabilidad ponderada por tiempo, en tanto por ciento del periodo entero.
 *
 * Se encadenan los rendimientos de cada tramo entre movimientos, así que meter
 * dinero justo antes de una subida no infla el resultado: eso es exactamente lo
 * que la hace comparable con un índice.
 *
 * `null` si algún tramo empieza en cero, porque ahí no hay rendimiento que
 * medir: dividir por cero daría infinito y pintarlo sería absurdo.
 */
export function twr(periodos: SubPeriodo[]): number | null {
  if (periodos.length === 0) return null
  let acumulado = 1
  for (const tramo of periodos) {
    const base = tramo.valorInicial + tramo.flujo
    if (base <= 0) return null
    acumulado *= tramo.valorFinal / base
  }
  return (acumulado - 1) * 100
}

// ─────────────────────────────────────────────────────────────── Posiciones

export type TipoMovimientoInversion =
  | 'compra'
  | 'venta'
  | 'aportacion'
  | 'retirada'
  | 'dividendo'
  | 'comision'
  | 'split'

export interface MovimientoInversion {
  tipo: TipoMovimientoInversion
  fecha: FechaISO
  participaciones: number
  /** Céntimos desembolsados (compra) o recibidos (venta, dividendo). */
  importe: Centimos
  comision?: Centimos
}

export interface EstadoPosicion {
  participaciones: number
  /** Lo que costó lo que aún se tiene, comisiones incluidas. */
  costeTotal: Centimos
  /** Coste por participación, en céntimos. */
  costeMedio: Centimos
  /** Dividendos cobrados, que no reducen el coste pero sí son rentabilidad. */
  dividendos: Centimos
  /** Beneficio o pérdida ya materializado en las ventas. */
  plusvaliaRealizada: Centimos
}

/**
 * Recorre los movimientos y deja la posición como está hoy.
 *
 * Se usa **coste medio ponderado**, que es lo que enseña cualquier bróker. Ojo:
 * Hacienda liquida por **FIFO** en acciones y fondos, así que la plusvalía
 * fiscal de una venta parcial puede no ser esta. La pantalla lo dice; callarlo
 * sería dejar que alguien haga la declaración con el número equivocado.
 *
 * Un `split` multiplica las participaciones sin tocar el coste, que es
 * justamente lo que es: el mismo dinero repartido en más trozos.
 */
export function estadoDePosicion(movimientos: MovimientoInversion[]): EstadoPosicion {
  const ordenados = [...movimientos].sort((a, b) => a.fecha.localeCompare(b.fecha))
  let participaciones = 0
  let costeTotal = 0
  let dividendos = 0
  let plusvaliaRealizada = 0

  for (const movimiento of ordenados) {
    const comision = movimiento.comision ?? 0
    switch (movimiento.tipo) {
      case 'compra':
      case 'aportacion':
        participaciones += movimiento.participaciones
        costeTotal += movimiento.importe + comision
        break
      case 'venta':
      case 'retirada': {
        if (participaciones <= 0) break
        const proporcion = Math.min(1, movimiento.participaciones / participaciones)
        const costeVendido = Math.round(costeTotal * proporcion)
        plusvaliaRealizada += movimiento.importe - comision - costeVendido
        costeTotal -= costeVendido
        participaciones -= movimiento.participaciones
        break
      }
      case 'dividendo':
        dividendos += movimiento.importe - comision
        break
      case 'comision':
        costeTotal += movimiento.importe
        break
      case 'split':
        // El factor viaja en `participaciones`: 2 en un dos por uno.
        if (movimiento.participaciones > 0) participaciones *= movimiento.participaciones
        break
    }
  }

  // Vendida entera. Los redondeos de una venta parcial pueden dejar un resto
  // de céntimos colgando: se lleva a la plusvalía realizada, que es donde le
  // corresponde, en vez de dejar una posición sin participaciones pero con
  // coste ensuciando la cartera para siempre.
  if (participaciones <= 1e-8) {
    participaciones = 0
    plusvaliaRealizada -= costeTotal
    costeTotal = 0
  }

  return {
    participaciones,
    costeTotal: comprobarCentimos(costeTotal),
    costeMedio: participaciones > 0 ? Math.round(costeTotal / participaciones) : 0,
    dividendos: comprobarCentimos(dividendos),
    plusvaliaRealizada: comprobarCentimos(plusvaliaRealizada),
  }
}

export interface Valoracion {
  valor: Centimos
  coste: Centimos
  plusvaliaLatente: Centimos
  /** En tanto por ciento sobre el coste. `null` sin precio o sin coste. */
  rentabilidad: number | null
}

/** Cuánto vale hoy una posición y cuánto lleva ganado sin vender. */
export function valorarPosicion(
  posicion: { participaciones: number; costeTotal: Centimos },
  /** Precio por participación en céntimos. `null` si no hay valoración. */
  ultimoPrecio: Centimos | null,
): Valoracion {
  if (ultimoPrecio === null) {
    return { valor: 0, coste: posicion.costeTotal, plusvaliaLatente: 0, rentabilidad: null }
  }
  const valor = comprobarCentimos(Math.round(posicion.participaciones * ultimoPrecio))
  const plusvaliaLatente = comprobarCentimos(valor - posicion.costeTotal)
  return {
    valor,
    coste: posicion.costeTotal,
    plusvaliaLatente,
    rentabilidad: posicion.costeTotal > 0 ? (plusvaliaLatente / posicion.costeTotal) * 100 : null,
  }
}

// ────────────────────────────────────────────────────── Reparto y rebalanceo

export type ClaseActivo =
  | 'renta_variable'
  | 'renta_fija'
  | 'monetario'
  | 'inmobiliario'
  | 'materias_primas'
  | 'cripto'
  | 'otros'

export interface ParteCartera {
  clase: ClaseActivo
  valor: Centimos
  porcentaje: number
}

export function repartoPorClase(
  posiciones: { clase: ClaseActivo; valor: Centimos }[],
): { total: Centimos; partes: ParteCartera[] } {
  const porClase = new Map<ClaseActivo, Centimos>()
  for (const posicion of posiciones) {
    porClase.set(posicion.clase, (porClase.get(posicion.clase) ?? 0) + posicion.valor)
  }
  const total = [...porClase.values()].reduce((suma, valor) => suma + valor, 0)
  const partes = [...porClase.entries()]
    .map(([clase, valor]) => ({
      clase,
      valor,
      porcentaje: total > 0 ? (valor / total) * 100 : 0,
    }))
    .sort((a, b) => b.valor - a.valor)
  return { total: comprobarCentimos(total), partes }
}

export interface Desvio {
  clase: ClaseActivo
  actual: number
  objetivo: number
  /** Puntos porcentuales de más (positivo) o de menos (negativo). */
  desviacion: number
  /** Cuánto habría que mover para volver al objetivo. Positivo = comprar. */
  ajuste: Centimos
  fueraDeRango: boolean
}

/**
 * Compara la cartera con la asignación objetivo.
 *
 * El umbral está en **puntos porcentuales**, no en porcentaje relativo: si el
 * objetivo de renta variable es 70 % y el umbral 5, se avisa por debajo del
 * 65 % o por encima del 75 %. Rebalancear por cualquier desvío pequeño solo
 * genera comisiones e impuestos.
 */
export function calcularDesvios(
  reparto: { total: Centimos; partes: ParteCartera[] },
  objetivos: { clase: ClaseActivo; objetivo: number; umbral?: number }[],
): Desvio[] {
  const actualPorClase = new Map(reparto.partes.map((p) => [p.clase, p.porcentaje]))

  return objetivos
    .map((objetivo) => {
      const actual = actualPorClase.get(objetivo.clase) ?? 0
      const desviacion = actual - objetivo.objetivo
      const umbral = objetivo.umbral ?? 5
      return {
        clase: objetivo.clase,
        actual,
        objetivo: objetivo.objetivo,
        desviacion,
        // Lo que falta (o sobra) para cuadrar con el objetivo, en dinero.
        ajuste: comprobarCentimos(Math.round((reparto.total * -desviacion) / 100)),
        fueraDeRango: Math.abs(desviacion) > umbral,
      }
    })
    .sort((a, b) => Math.abs(b.desviacion) - Math.abs(a.desviacion))
}
