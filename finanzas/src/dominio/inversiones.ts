/**
 * Cartera de inversiones (parte pura y testeable): fondos, acciones, cripto,
 * inmuebles, depósitos, préstamos concedidos y lo que vaya surgiendo.
 *
 * Cuatro reglas que el PGC impone y que aquí NO se negocian:
 *
 * 1. **El coste incluye los gastos de la compra** (comisiones, cánones, ITP y
 *    notaría en un inmueble). NRV 9.ª: el precio de adquisición los incorpora.
 *
 * 2. **La plusvalía latente NO es beneficio.** Mientras no se venda, una
 *    revalorización no toca la cuenta de resultados (principio de prudencia).
 *    Se muestra aparte, marcada como informativa, y nunca suma al resultado.
 *
 * 3. **La minusvalía latente SÍ se contabiliza**: si el valor recuperable baja
 *    del coste hay que dotar deterioro. La asimetría es deliberada.
 *
 * 4. **El terreno no se amortiza**, solo la construcción. Por eso un inmueble
 *    guarda las dos partes por separado.
 *
 * Al vender se aplica **precio medio ponderado por grupos homogéneos**, que es
 * el criterio del PGC (el mismo que ya usa el almacén), no FIFO.
 */
import { aCentimos, aEuros, redondear2 } from './dinero'
import type { ID, Trazable } from './tipos'

export type TipoInversion =
  | 'FONDO'
  | 'ACCIONES'
  | 'CRIPTO'
  | 'INMUEBLE'
  | 'DEPOSITO'
  | 'PRESTAMO_CONCEDIDO'
  | 'OTRA'

export const ETIQUETA_TIPO_INVERSION: Record<TipoInversion, string> = {
  FONDO: 'Fondo de inversión',
  ACCIONES: 'Acciones y participaciones',
  CRIPTO: 'Criptomoneda',
  INMUEBLE: 'Inmueble',
  DEPOSITO: 'Depósito o imposición a plazo',
  PRESTAMO_CONCEDIDO: 'Préstamo concedido',
  OTRA: 'Otra inversión',
}

/**
 * Cuenta del PGC por defecto para cada tipo. **Siempre editable**: el plan de
 * cada empresa manda, y la cripto no tiene cuenta oficial (el ICAC la trata
 * como inmovilizado intangible cuando se mantiene como inversión, o como
 * existencias si el negocio es comprarla y venderla).
 */
export const CUENTA_PGC_POR_TIPO: Record<TipoInversion, string> = {
  FONDO: '540',
  ACCIONES: '250',
  CRIPTO: '209',
  INMUEBLE: '221',
  DEPOSITO: '548',
  PRESTAMO_CONCEDIDO: '252',
  OTRA: '250',
}

/** Nº de decimales con que se guardan las unidades. La cripto necesita 8. */
export function decimalesUnidades(tipo: TipoInversion): number {
  if (tipo === 'CRIPTO') return 8
  if (tipo === 'FONDO') return 6 // las participaciones de fondo son fraccionarias
  if (tipo === 'INMUEBLE' || tipo === 'DEPOSITO' || tipo === 'PRESTAMO_CONCEDIDO') return 0
  return 4
}

export interface Inversion extends Trazable {
  tipo: TipoInversion
  nombre: string
  /** ISIN, ticker, referencia catastral, dirección de la cartera… */
  identificador?: string
  cuentaPGC: string
  /** Solo inmuebles: reparto del coste. El terreno no se amortiza. */
  valorTerreno?: number
  valorConstruccion?: number
  /** Solo inmuebles: años de vida útil de la construcción. */
  aniosVidaUtil?: number
  /** Depósitos y préstamos: interés nominal anual en %. */
  tipoInteres?: number
  divisa?: string
  notas?: string
}

export type TipoOperacion =
  | 'COMPRA'
  | 'VENTA'
  | 'DIVIDENDO'
  | 'RENDIMIENTO' // intereses, cupones, alquileres
  | 'GASTO' // comisiones de custodia, IBI, comunidad…
  | 'APORTACION' // ampliación sin más unidades (mejoras en un inmueble)

export interface OperacionInversion extends Trazable {
  inversionId: ID
  fecha: string
  tipo: TipoOperacion
  /** Unidades compradas o vendidas. En un inmueble o depósito, 1. */
  unidades?: number
  /** Precio por unidad, sin gastos. */
  precioUnitario?: number
  /** Comisiones e impuestos de la operación. Suman al coste; en venta, restan. */
  gastos?: number
  /** Importe directo para dividendos, rendimientos y gastos. */
  importe?: number
  cuentaTesoreriaId?: ID
  notas?: string
}

/** Valor de mercado en una fecha. Es INFORMATIVO: no toca el resultado. */
export interface ValoracionInversion extends Trazable {
  inversionId: ID
  fecha: string
  /** Valor total de la posición en esa fecha. */
  valorTotal: number
  fuente?: string
}

// ────────────────────────────── Posición y coste ──────────────────────────────

export interface PosicionInversion {
  unidades: number
  /** Coste contable de lo que aún se tiene, con los gastos de compra incluidos. */
  coste: number
  /** Coste medio ponderado por unidad. 0 si no quedan unidades. */
  costeUnitario: number
  /** Resultado ya materializado en ventas (766/666). Sí es beneficio. */
  resultadoRealizado: number
  /** Dividendos, intereses y alquileres cobrados. */
  rendimientos: number
  /** Gastos imputados directamente a gasto del ejercicio. */
  gastos: number
}

function ordenarPorFecha(ops: OperacionInversion[]): OperacionInversion[] {
  return [...ops].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.creadoEn.localeCompare(b.creadoEn))
}

/** Importe total de una compra: unidades × precio + gastos. */
export function costeCompra(op: OperacionInversion): number {
  const bruto = aCentimos((op.unidades ?? 0) * (op.precioUnitario ?? 0))
  const directo = op.importe !== undefined && !op.unidades ? aCentimos(op.importe) : 0
  return aEuros((bruto || directo) + aCentimos(op.gastos ?? 0))
}

/** Importe neto que entra por una venta: unidades × precio − gastos. */
export function netoVenta(op: OperacionInversion): number {
  const bruto = aCentimos((op.unidades ?? 0) * (op.precioUnitario ?? 0))
  const directo = op.importe !== undefined && !op.unidades ? aCentimos(op.importe) : 0
  return aEuros((bruto || directo) - aCentimos(op.gastos ?? 0))
}

/**
 * Recorre las operaciones en orden y devuelve la posición actual.
 *
 * En cada venta se da de baja el coste medio ponderado de las unidades que
 * salen; la diferencia con el neto cobrado es el resultado realizado. Vender
 * más unidades de las que hay se ignora en el cálculo de coste (no se puede
 * dar de baja lo que no existe) y se refleja en `unidades` para que el
 * descuadre sea visible.
 */
export function posicion(operaciones: OperacionInversion[]): PosicionInversion {
  let unidades = 0
  let costeCent = 0
  let realizadoCent = 0
  let rendimientosCent = 0
  let gastosCent = 0

  for (const op of ordenarPorFecha(operaciones)) {
    if (op.anuladoEn) continue
    switch (op.tipo) {
      case 'COMPRA': {
        unidades += op.unidades ?? 0
        costeCent += aCentimos(costeCompra(op))
        break
      }
      case 'APORTACION': {
        // Mejora o ampliación: más coste, mismas unidades.
        costeCent += aCentimos(op.importe ?? costeCompra(op))
        break
      }
      case 'VENTA': {
        const vendidas = op.unidades ?? 0
        const neto = aCentimos(netoVenta(op))
        const costeUnit = unidades > 0 ? costeCent / unidades : 0
        const costeBaja = Math.round(costeUnit * Math.min(vendidas, unidades))
        costeCent -= costeBaja
        unidades -= vendidas
        realizadoCent += neto - costeBaja
        if (unidades <= 0) {
          // Sin unidades no puede quedar coste colgando.
          unidades = Math.min(unidades, 0)
          costeCent = 0
        }
        break
      }
      case 'DIVIDENDO':
      case 'RENDIMIENTO':
        rendimientosCent += aCentimos(op.importe ?? 0)
        break
      case 'GASTO':
        gastosCent += aCentimos(op.importe ?? 0)
        break
    }
  }

  return {
    unidades: redondear2(unidades * 1e8) / 1e8,
    coste: aEuros(costeCent),
    costeUnitario: unidades > 0 ? redondear2((costeCent / unidades) / 100) : 0,
    resultadoRealizado: aEuros(realizadoCent),
    rendimientos: aEuros(rendimientosCent),
    gastos: aEuros(gastosCent),
  }
}

// ───────────────────────── Valoración y deterioro ─────────────────────────

/** Última valoración registrada hasta una fecha (incluida). */
export function ultimaValoracion(
  valoraciones: ValoracionInversion[],
  inversionId: ID,
  hasta?: string,
): ValoracionInversion | undefined {
  return valoraciones
    .filter((v) => v.inversionId === inversionId && !v.anuladoEn && (!hasta || v.fecha <= hasta))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .pop()
}

export interface SituacionInversion {
  inversion: Inversion
  posicion: PosicionInversion
  /** Valor de mercado conocido, si se ha registrado alguna valoración. */
  valorMercado?: number
  /**
   * Diferencia entre mercado y coste. **Informativa**: en positivo NO es
   * beneficio y no aparece en la cuenta de resultados.
   */
  plusvaliaLatente?: number
  /**
   * Deterioro que habría que dotar (696/292) porque el valor ha caído por
   * debajo del coste. Esto SÍ va a resultado: la prudencia obliga.
   */
  deterioroSugerido: number
  /** Amortización anual de la construcción (los inmuebles se consumen). */
  amortizacionAnual: number
}

export function situacion(
  inversion: Inversion,
  operaciones: OperacionInversion[],
  valoraciones: ValoracionInversion[],
  hasta?: string,
): SituacionInversion {
  const ops = operaciones.filter((o) => o.inversionId === inversion.id && (!hasta || o.fecha <= hasta))
  const pos = posicion(ops)
  const val = ultimaValoracion(valoraciones, inversion.id, hasta)
  const valorMercado = val?.valorTotal

  const plusvaliaLatente = valorMercado === undefined ? undefined : aEuros(aCentimos(valorMercado) - aCentimos(pos.coste))
  const deterioroSugerido =
    valorMercado === undefined || pos.unidades <= 0 ? 0 : Math.max(0, aEuros(aCentimos(pos.coste) - aCentimos(valorMercado)))

  return {
    inversion,
    posicion: pos,
    valorMercado,
    plusvaliaLatente,
    deterioroSugerido,
    amortizacionAnual: amortizacionAnualInmueble(inversion),
  }
}

/**
 * Amortización lineal anual de un inmueble. **Solo la construcción**: el suelo
 * no se deprecia (NRV 2.ª). Sin vida útil o sin construcción, cero.
 */
export function amortizacionAnualInmueble(inversion: Inversion): number {
  if (inversion.tipo !== 'INMUEBLE') return 0
  const construccion = inversion.valorConstruccion ?? 0
  const anios = inversion.aniosVidaUtil ?? 0
  if (construccion <= 0 || anios <= 0) return 0
  return redondear2(construccion / anios)
}

// ─────────────────────────────── Cartera ───────────────────────────────

export interface ResumenCartera {
  coste: number
  valorMercado: number
  /** Solo de las inversiones que tienen valoración; informativa. */
  plusvaliaLatente: number
  resultadoRealizado: number
  rendimientos: number
  gastos: number
  deterioroSugerido: number
  /** Cuántas inversiones no tienen ninguna valoración registrada. */
  sinValorar: number
  porTipo: { tipo: TipoInversion; coste: number; valorMercado: number }[]
}

export function resumenCartera(situaciones: SituacionInversion[]): ResumenCartera {
  let coste = 0
  let valor = 0
  let realizado = 0
  let rend = 0
  let gastos = 0
  let deterioro = 0
  let sinValorar = 0
  const porTipo = new Map<TipoInversion, { coste: number; valorMercado: number }>()

  for (const s of situaciones) {
    coste += aCentimos(s.posicion.coste)
    // Sin valoración, el mejor dato disponible es el coste: no se infla la cartera.
    const v = s.valorMercado ?? s.posicion.coste
    if (s.valorMercado === undefined) sinValorar++
    valor += aCentimos(v)
    realizado += aCentimos(s.posicion.resultadoRealizado)
    rend += aCentimos(s.posicion.rendimientos)
    gastos += aCentimos(s.posicion.gastos)
    deterioro += aCentimos(s.deterioroSugerido)

    const acc = porTipo.get(s.inversion.tipo) ?? { coste: 0, valorMercado: 0 }
    acc.coste = aEuros(aCentimos(acc.coste) + aCentimos(s.posicion.coste))
    acc.valorMercado = aEuros(aCentimos(acc.valorMercado) + aCentimos(v))
    porTipo.set(s.inversion.tipo, acc)
  }

  return {
    coste: aEuros(coste),
    valorMercado: aEuros(valor),
    plusvaliaLatente: aEuros(valor - coste),
    resultadoRealizado: aEuros(realizado),
    rendimientos: aEuros(rend),
    gastos: aEuros(gastos),
    deterioroSugerido: aEuros(deterioro),
    sinValorar,
    porTipo: [...porTipo.entries()].map(([tipo, v]) => ({ tipo, ...v })),
  }
}

// ─────────────────────────────── Avisos ───────────────────────────────

/** Cosas que un asesor miraría. No bloquean: informan. */
export function avisosInversion(s: SituacionInversion): string[] {
  const avisos: string[] = []
  const { inversion: inv, posicion: pos } = s

  if (pos.unidades < 0) {
    avisos.push(`Se han vendido más unidades de las registradas (quedan ${pos.unidades}). Revisa las compras.`)
  }
  if (s.deterioroSugerido > 0) {
    avisos.push(
      `El valor de mercado está por debajo del coste: hay que dotar un deterioro de ${s.deterioroSugerido.toFixed(2)} €. Una minusvalía latente sí se contabiliza.`,
    )
  }
  if ((s.plusvaliaLatente ?? 0) > 0) {
    avisos.push('La plusvalía latente es informativa: no es beneficio hasta que se venda, y no va a la cuenta de resultados.')
  }
  if (inv.tipo === 'INMUEBLE') {
    const terreno = inv.valorTerreno ?? 0
    const construccion = inv.valorConstruccion ?? 0
    if (terreno === 0 && construccion === 0) {
      avisos.push('Reparte el coste entre terreno y construcción: el terreno no se amortiza y la construcción sí.')
    } else if (pos.coste > 0 && Math.abs(aCentimos(terreno + construccion) - aCentimos(pos.coste)) > 1) {
      avisos.push(
        `El reparto terreno + construcción (${(terreno + construccion).toFixed(2)} €) no coincide con el coste registrado (${pos.coste.toFixed(2)} €).`,
      )
    }
    if (construccion > 0 && !inv.aniosVidaUtil) {
      avisos.push('Indica los años de vida útil de la construcción para poder calcular la amortización.')
    }
  }
  if (inv.tipo === 'CRIPTO') {
    avisos.push(
      'La criptomoneda no tiene cuenta propia en el PGC: el ICAC la trata como inmovilizado intangible si se mantiene como inversión, o como existencias si el negocio es comprar y vender. Confirma la cuenta con tu asesoría.',
    )
  }
  return avisos
}

// ─────────────────────────── Asientos (partida doble) ───────────────────────────

/** Cuentas de contrapartida. Editables desde fuera si el plan de la empresa difiere. */
export interface CuentasInversion {
  /** Salida/entrada de dinero. */
  tesoreria: string
  /** Ingresos de participaciones (dividendos). */
  dividendos: string
  /** Ingresos de créditos, arrendamientos, cupones. */
  rendimientos: string
  /** Beneficios en la enajenación. */
  beneficio: string
  /** Pérdidas en la enajenación. */
  perdida: string
  /** Otros gastos financieros o de gestión de la inversión. */
  gasto: string
}

export const CUENTAS_INVERSION_DEFECTO: CuentasInversion = {
  tesoreria: '572',
  dividendos: '760',
  rendimientos: '762',
  beneficio: '766',
  perdida: '666',
  gasto: '669',
}

interface ApunteSimple {
  cuenta: string
  debe: number
  haber: number
  concepto?: string
}

export interface AsientoInversion {
  fecha: string
  concepto: string
  apuntes: ApunteSimple[]
}

/**
 * Asiento de una operación. Devuelve undefined si la operación no mueve nada.
 *
 * La venta se desglosa en tres piezas: entra el dinero, se da de baja el coste
 * medio de lo vendido y la diferencia va a beneficio (766) o pérdida (666).
 * Por eso hace falta el coste dado de baja, que solo se conoce recorriendo el
 * histórico: se calcula con `posicion` sobre las operaciones anteriores.
 */
export function asientoOperacion(
  inversion: Inversion,
  op: OperacionInversion,
  anteriores: OperacionInversion[],
  cuentas: CuentasInversion = CUENTAS_INVERSION_DEFECTO,
): AsientoInversion | undefined {
  if (op.anuladoEn) return undefined
  const cuenta = inversion.cuentaPGC || CUENTA_PGC_POR_TIPO[inversion.tipo]
  const nombre = inversion.nombre

  if (op.tipo === 'COMPRA') {
    const total = costeCompra(op)
    if (total === 0) return undefined
    return {
      fecha: op.fecha,
      concepto: `Compra de ${nombre}`,
      apuntes: [
        { cuenta, debe: total, haber: 0, concepto: nombre },
        { cuenta: cuentas.tesoreria, debe: 0, haber: total },
      ],
    }
  }

  if (op.tipo === 'APORTACION') {
    const total = op.importe ?? costeCompra(op)
    if (total === 0) return undefined
    return {
      fecha: op.fecha,
      concepto: `Ampliación de ${nombre}`,
      apuntes: [
        { cuenta, debe: total, haber: 0, concepto: nombre },
        { cuenta: cuentas.tesoreria, debe: 0, haber: total },
      ],
    }
  }

  if (op.tipo === 'VENTA') {
    const previa = posicion(anteriores)
    const vendidas = op.unidades ?? 0
    const costeUnit = previa.unidades > 0 ? previa.coste / previa.unidades : 0
    const costeBaja = aEuros(Math.round(aCentimos(costeUnit * Math.min(vendidas, previa.unidades))))
    const neto = netoVenta(op)
    const resultado = aEuros(aCentimos(neto) - aCentimos(costeBaja))
    if (neto === 0 && costeBaja === 0) return undefined

    const apuntes: ApunteSimple[] = [
      { cuenta: cuentas.tesoreria, debe: neto, haber: 0 },
      { cuenta, debe: 0, haber: costeBaja, concepto: nombre },
    ]
    if (resultado > 0) apuntes.push({ cuenta: cuentas.beneficio, debe: 0, haber: resultado })
    else if (resultado < 0) apuntes.push({ cuenta: cuentas.perdida, debe: -resultado, haber: 0 })

    return { fecha: op.fecha, concepto: `Venta de ${nombre}`, apuntes }
  }

  const importe = op.importe ?? 0
  if (importe === 0) return undefined

  if (op.tipo === 'DIVIDENDO' || op.tipo === 'RENDIMIENTO') {
    const cuentaIngreso = op.tipo === 'DIVIDENDO' ? cuentas.dividendos : cuentas.rendimientos
    return {
      fecha: op.fecha,
      concepto: `${op.tipo === 'DIVIDENDO' ? 'Dividendo' : 'Rendimiento'} de ${nombre}`,
      apuntes: [
        { cuenta: cuentas.tesoreria, debe: importe, haber: 0 },
        { cuenta: cuentaIngreso, debe: 0, haber: importe },
      ],
    }
  }

  // GASTO
  return {
    fecha: op.fecha,
    concepto: `Gasto de ${nombre}`,
    apuntes: [
      { cuenta: cuentas.gasto, debe: importe, haber: 0 },
      { cuenta: cuentas.tesoreria, debe: 0, haber: importe },
    ],
  }
}

/** Todos los asientos de una inversión, en orden y con el histórico bien encadenado. */
export function asientosInversion(
  inversion: Inversion,
  operaciones: OperacionInversion[],
  cuentas: CuentasInversion = CUENTAS_INVERSION_DEFECTO,
): AsientoInversion[] {
  const ops = ordenarPorFecha(operaciones.filter((o) => o.inversionId === inversion.id))
  const asientos: AsientoInversion[] = []
  for (let i = 0; i < ops.length; i++) {
    const a = asientoOperacion(inversion, ops[i], ops.slice(0, i), cuentas)
    if (a) asientos.push(a)
  }
  return asientos
}
