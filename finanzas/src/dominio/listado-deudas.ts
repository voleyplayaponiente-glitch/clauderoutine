/**
 * Listado detallado de deudas, para la pantalla de informes.
 *
 * Pedido por el usuario: *listar las deudas de cada empresa, detallado por el
 * tipo de deuda, importe inicial, capital pendiente, cuota y tipo de interés;
 * por un lado las deudas bancarias + renting, otro las deudas con Hacienda y
 * otras deudas.*
 *
 * El resumen que ya existía (`resumenFinanciacion`) da **totales por bloque**;
 * esto da **una fila por contrato**, que es lo que se lleva a la asesoría o al
 * banco.
 *
 * LA REGLA QUE GOBIERNA ESTE FICHERO: **un hueco vacío nunca es un cero.** Una
 * póliza no tiene cuota (se liquidan intereses), un renting no tiene tipo de
 * interés (es una cuota lineal) y una tarjeta a fin de mes no devenga nada.
 * Poner 0 en esas casillas sería mentir con cifras; se dejan sin valor y se
 * explica por qué en `nota`.
 */
import type {
  Deuda,
  Poliza,
  Renting,
  TarjetaCredito,
  CuentaTesoreria,
  MovimientoTesoreria,
} from './tipos'
import type { Periodicidad } from './amortizacion'
import { aCentimos, aEuros } from './dinero'
import { cuadroDeuda, pendienteDeuda } from './financiacion'
import { situacionPoliza, polizaConCuenta } from './poliza'
import { situacionTarjeta } from './tarjeta-credito'
import { resumenRenting } from './renting'

export type GrupoDeuda = 'BANCARIA' | 'HACIENDA' | 'OTRAS'

export interface FilaDeuda {
  grupo: GrupoDeuda
  /** Tipo en castellano: «Préstamo bancario», «Póliza de crédito», «Renting»… */
  tipo: string
  acreedor: string
  /** Contrato, matrícula, alias de la tarjeta… lo que identifica el contrato. */
  detalle?: string
  /** Lo que se debía al principio. Sin valor si el documento no lo dice. */
  importeInicial?: number
  capitalPendiente: number
  cuota?: number
  periodicidad?: Periodicidad
  /** Cuota llevada a meses, para poder sumar peras con peras. */
  cuotaMensual?: number
  tipoInteres?: number
  /** Por qué falta un dato, cuando falta por naturaleza y no por descuido. */
  nota?: string
  /** El renting se paga, pero contablemente no es deuda del balance. */
  esCompromiso?: boolean
  /**
   * Se debe a otra empresa del MISMO grupo. Sumada con las demás, esta deuda
   * está contada dos veces desde el punto de vista del grupo: es un pasivo aquí
   * y un activo allí. Se marca para poder decirlo.
   */
  esIntragrupo?: boolean
}

export interface GrupoListado {
  grupo: GrupoDeuda
  titulo: string
  descripcion: string
  filas: FilaDeuda[]
  totalPendiente: number
  /** Suma de las cuotas llevadas a meses. */
  totalCuotaMensual: number
}

export interface ListadoDeudas {
  grupos: GrupoListado[]
  totalPendiente: number
  totalCuotaMensual: number
}

const MESES: Record<Periodicidad, number> = { MENSUAL: 1, TRIMESTRAL: 3, ANUAL: 12 }

const NOMBRE_TIPO: Record<string, string> = {
  PRESTAMO: 'Préstamo bancario',
  LEASING: 'Leasing',
  POLIZA: 'Póliza de crédito',
  RENTING: 'Renting',
  PROVEEDOR: 'Proveedor',
  ACREEDOR: 'Acreedor',
  SOCIOS: 'Préstamo de socios',
  GRUPO: 'Empresa del grupo',
  HACIENDA: 'Hacienda',
  SEG_SOCIAL: 'Seguridad Social',
  DIVIDENDO: 'Dividendo pendiente',
}

/** A qué bloque del listado va cada tipo de `Deuda`. */
function grupoDe(tipo: string): GrupoDeuda {
  if (tipo === 'PRESTAMO' || tipo === 'LEASING') return 'BANCARIA'
  if (tipo === 'HACIENDA' || tipo === 'SEG_SOCIAL') return 'HACIENDA'
  return 'OTRAS'
}

const suma = (xs: number[]) => aEuros(xs.reduce((s, x) => s + aCentimos(x), 0))

/**
 * La cuota que toca ahora: la **primera pendiente**, no la primera del cuadro.
 * En un aplazamiento de Hacienda las cuotas no son iguales —llevan intereses
 * crecientes— así que enseñar la primera de todas daría una cifra que ya no se
 * paga. Si no queda ninguna pendiente, se da la última que hubo.
 */
function cuotaVigente(deuda: Deuda, hoy: string): number | undefined {
  const cuadro = cuadroDeuda(deuda)
  if (cuadro.length === 0) return undefined
  const pendiente = cuadro.find((c) => c.fecha >= hoy)
  return (pendiente ?? cuadro[cuadro.length - 1]).cuota
}

function filaDeDeuda(d: Deuda, hoy: string): FilaDeuda {
  const grupo = grupoDe(d.tipo)
  const cuota = cuotaVigente(d, hoy)
  const cuadro = cuadroDeuda(d)
  // Con calendario leído (un aplazamiento), las cuotas no tienen por qué ser
  // iguales: se dice, para que nadie multiplique la cuota por los plazos.
  const irregular = (d.cuadroFijo?.length ?? 0) > 0 && new Set(cuadro.map((c) => c.cuota)).size > 1

  // **Cobra intereses pero no dice a qué tipo.** Es el caso del aplazamiento de
  // Hacienda: el acuerdo imprime los intereses de cada plazo, pero el tipo de
  // demora va en una columna que no se puede leer, así que `tipoInteres` queda
  // a 0. Enseñar «0,00 %» diría «sin intereses», que es justo lo contrario de
  // lo que pasa. Sin dato es sin dato.
  const conInteresesSinTipo =
    d.tipoInteres === 0 && (d.cuadroFijo ?? []).some((p) => (p.intereses ?? 0) > 0)

  const notas = [
    irregular ? 'Las cuotas del acuerdo no son iguales: se indica la que toca ahora.' : '',
    conInteresesSinTipo ? 'Los plazos llevan intereses, pero el acuerdo no dice a qué tipo.' : '',
  ].filter(Boolean)

  return {
    grupo,
    tipo: NOMBRE_TIPO[d.tipo] ?? d.tipo,
    acreedor: d.acreedor,
    detalle: d.garantias || undefined,
    importeInicial: d.importeOriginal || undefined,
    capitalPendiente: pendienteDeuda(d, hoy),
    cuota,
    periodicidad: d.periodicidad,
    cuotaMensual: cuota === undefined ? undefined : aEuros(aCentimos(cuota) / MESES[d.periodicidad]),
    // Un préstamo al 0 % es legítimo (el de Bankinter lo es) y se enseña tal
    // cual; lo que no vale es fingir un 0 donde el dato no existe.
    tipoInteres: conInteresesSinTipo ? undefined : d.tipoInteres,
    nota: notas.length > 0 ? notas.join(' ') : undefined,
    esIntragrupo: d.tipo === 'GRUPO' || undefined,
  }
}

/**
 * Construye el listado. Recibe los mismos datos que `resumenFinanciacion`,
 * incluidas cuentas y movimientos: sin ellos, la póliza en cuenta corriente
 * saldría a cero, porque su dispuesto vive en el saldo del banco.
 */
export function listadoDeudas(
  datos: {
    deudas: Deuda[]
    polizas?: Poliza[]
    rentings?: Renting[]
    tarjetasCredito?: TarjetaCredito[]
    cuentasTesoreria?: CuentaTesoreria[]
    movimientos?: MovimientoTesoreria[]
  },
  hoy: string,
): ListadoDeudas {
  const filas: FilaDeuda[] = []

  for (const d of datos.deudas.filter((x) => !x.anuladoEn)) filas.push(filaDeDeuda(d, hoy))

  const cuentas = (datos.cuentasTesoreria ?? []).filter((c) => !c.anuladoEn)
  for (const bruta of (datos.polizas ?? []).filter((p) => !p.anuladoEn)) {
    const p = polizaConCuenta(bruta, cuentas, datos.movimientos ?? [], hoy)
    const s = situacionPoliza(p)
    filas.push({
      grupo: 'BANCARIA',
      tipo: 'Póliza de crédito',
      acreedor: p.entidad,
      detalle: p.numeroContrato,
      importeInicial: p.limiteConcedido,
      capitalPendiente: s.dispuesto,
      tipoInteres: p.tipoInteresDispuesto,
      nota: 'Sin cuota: se liquidan intereses del dispuesto. El importe inicial es el límite concedido.',
    })
  }

  for (const t of (datos.tarjetasCredito ?? []).filter((x) => !x.anuladoEn)) {
    const s = situacionTarjeta(t)
    const aplazada = t.modalidad === 'APLAZADO'
    filas.push({
      grupo: 'BANCARIA',
      tipo: 'Tarjeta de crédito',
      acreedor: t.entidad,
      detalle: [t.alias, t.ultimos4 && `····${t.ultimos4}`].filter(Boolean).join(' '),
      importeInicial: t.limite,
      capitalPendiente: s.dispuesto,
      tipoInteres: aplazada ? t.tipoInteres : undefined,
      nota: aplazada
        ? 'Modalidad aplazada: el saldo devenga interés. El importe inicial es el límite.'
        : 'Se paga entera en la liquidación, no devenga intereses. El importe inicial es el límite.',
    })
  }

  for (const r of (datos.rentings ?? []).filter((x) => !x.anuladoEn)) {
    const s = resumenRenting(r, hoy)
    filas.push({
      grupo: 'BANCARIA',
      tipo: 'Renting',
      acreedor: r.arrendador,
      detalle: [r.descripcion, r.matricula].filter(Boolean).join(' · '),
      importeInicial: s.costeTotal,
      capitalPendiente: s.compromisoPendiente,
      cuota: r.cuotaBase,
      periodicidad: r.periodicidad,
      cuotaMensual: aEuros(aCentimos(r.cuotaBase) / MESES[r.periodicidad]),
      // Dicho por el usuario: el renting no lleva tipo de interés.
      tipoInteres: undefined,
      nota: 'Cuota lineal sin tipo de interés, sin IVA. No es deuda del balance: es un arrendamiento.',
      esCompromiso: true,
    })
  }

  const TITULOS: Record<GrupoDeuda, { titulo: string; descripcion: string }> = {
    BANCARIA: {
      titulo: 'Deuda bancaria y renting',
      descripcion:
        'Préstamos, leasing, pólizas de crédito, tarjetas y renting. El renting se lista aquí porque se paga todos los meses, pero contablemente es un arrendamiento, no deuda del balance.',
    },
    HACIENDA: {
      titulo: 'Hacienda y Seguridad Social',
      descripcion: 'Aplazamientos y deudas con las administraciones. Los plazos se registran tal y como vienen en el acuerdo.',
    },
    OTRAS: {
      titulo: 'Otras deudas',
      descripcion: 'Proveedores, acreedores, socios, empresas del grupo y dividendos pendientes de pago.',
    },
  }

  const grupos: GrupoListado[] = (['BANCARIA', 'HACIENDA', 'OTRAS'] as GrupoDeuda[]).map((g) => {
    const suyas = filas.filter((f) => f.grupo === g)
    return {
      grupo: g,
      ...TITULOS[g],
      filas: suyas,
      totalPendiente: suma(suyas.map((f) => f.capitalPendiente)),
      totalCuotaMensual: suma(suyas.map((f) => f.cuotaMensual ?? 0)),
    }
  })

  return {
    grupos,
    totalPendiente: suma(grupos.map((g) => g.totalPendiente)),
    totalCuotaMensual: suma(grupos.map((g) => g.totalCuotaMensual)),
  }
}


export interface ListadoEmpresa {
  empresaId: string
  razonSocial: string
  listado: ListadoDeudas
}

export interface TotalBloque {
  grupo: GrupoDeuda
  titulo: string
  totalPendiente: number
  totalCuotaMensual: number
}

export interface ListadoGrupo {
  empresas: ListadoEmpresa[]
  /** Totales por bloque, sumando todas las sociedades. */
  porBloque: TotalBloque[]
  totalPendiente: number
  totalCuotaMensual: number
  /**
   * Cuánto de ese total se debe a otras empresas del grupo. **No se resta**:
   * se dice, porque desde fuera del grupo esa deuda no existe (es un pasivo en
   * una sociedad y un activo en otra) y sumarla infla la cifra.
   */
  totalIntragrupo: number
}

/**
 * Junta los listados de varias sociedades.
 *
 * **Esto es una SUMA, no una consolidación contable**: no elimina el tráfico
 * intragrupo. La cifra sirve para saber cuánto debe el conjunto a terceros y a
 * los bancos, no para depositar cuentas consolidadas. Lo intragrupo se calcula
 * aparte para poder avisar de cuánto hay contado dos veces.
 */
export function consolidarDeudas(empresas: ListadoEmpresa[]): ListadoGrupo {
  const bloques: GrupoDeuda[] = ['BANCARIA', 'HACIENDA', 'OTRAS']
  const porBloque: TotalBloque[] = bloques.map((g) => {
    const suyos = empresas.map((e) => e.listado.grupos.find((x) => x.grupo === g))
    return {
      grupo: g,
      titulo: suyos.find(Boolean)?.titulo ?? g,
      totalPendiente: suma(suyos.map((x) => x?.totalPendiente ?? 0)),
      totalCuotaMensual: suma(suyos.map((x) => x?.totalCuotaMensual ?? 0)),
    }
  })

  const intragrupo = empresas.flatMap((e) =>
    e.listado.grupos.flatMap((g) => g.filas.filter((f) => f.esIntragrupo).map((f) => f.capitalPendiente)),
  )

  return {
    empresas,
    porBloque,
    totalPendiente: suma(porBloque.map((b) => b.totalPendiente)),
    totalCuotaMensual: suma(porBloque.map((b) => b.totalCuotaMensual)),
    totalIntragrupo: suma(intragrupo),
  }
}
