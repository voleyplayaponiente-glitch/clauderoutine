/**
 * Resumen de compras por periodo y categoría, y cuotas de deuda aplazada para
 * llevarlas al presupuesto.
 *
 * Dos cosas que aquí no se mezclan:
 *  · El **IVA no deducible** no desaparece: engorda el gasto. Una gasolina no
 *    deducible cuesta la base MÁS el IVA que no te puedes deducir.
 *  · El **impuesto especial** de una compra internacional se muestra aparte:
 *    forma parte del coste de la mercancía pero se declara en su propio modelo.
 */
import { aCentimos, aEuros } from './dinero'
import { totalesCompra } from './compras'
import { cuadroDeuda } from './financiacion'
import type { Compra, CategoriaGasto, Deuda, TipoDeuda, ID } from './tipos'

// ─────────────────────── Ámbito de las categorías ───────────────────────

/**
 * Dónde se usa una categoría. La naturaleza del gasto (stock, alquileres,
 * gasolina…) es de **Compras**, que es donde están las facturas; el banco tiene
 * su propia lista para lo que no lleva factura (comisiones, seguros, tributos).
 * Las categorías guardadas antes de esta separación no traen `ambito`: se
 * deduce de `esBancaria`.
 */
export function ambitoDe(cat: CategoriaGasto): 'COMPRAS' | 'BANCO' {
  return cat.ambito ?? (cat.esBancaria ? 'BANCO' : 'COMPRAS')
}

/** Cargo o abono. Un extracto tiene los dos y no se clasifican igual. */
export type Flujo = 'SALIDA' | 'ENTRADA'

export function flujoDe(cat: CategoriaGasto): Flujo {
  return cat.flujo ?? 'SALIDA'
}

/**
 * Categorías de un ámbito, en su orden. En el banco hay que decir además si se
 * quieren las de cargos o las de abonos; en Compras el flujo no aplica.
 */
export function categoriasDe(categorias: CategoriaGasto[], ambito: 'COMPRAS' | 'BANCO', flujo: Flujo = 'SALIDA'): CategoriaGasto[] {
  return categorias
    .filter((c) => ambitoDe(c) === ambito && (ambito !== 'BANCO' || flujoDe(c) === flujo))
    .sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999))
}

/** Qué hace en el presupuesto. Sin indicar, es gasto. */
export type EfectoPresupuesto = 'INGRESO' | 'GASTO' | 'INVERSION' | 'FINANCIACION' | 'NINGUNO'

export function efectoPresupuestoDe(cat: CategoriaGasto | undefined): EfectoPresupuesto {
  return cat?.efectoPresupuesto ?? 'GASTO'
}

export interface LineaResumenGasto {
  categoriaId: ID | 'sin-categoria'
  categoria: string
  base: number
  cuotaIva: number
  /** IVA que NO se puede deducir y por tanto es más gasto. */
  ivaNoDeducible: number
  impuestoEspecial: number
  total: number
  /** Coste real para la empresa: base + IVA no deducible + impuesto especial. */
  costeReal: number
  numFacturas: number
  deducible: boolean
}

export interface ResumenCompras {
  lineas: LineaResumenGasto[]
  base: number
  cuotaIva: number
  ivaDeducible: number
  ivaNoDeducible: number
  impuestoEspecial: number
  total: number
  costeReal: number
  numFacturas: number
  /** Solo las categorías marcadas como stock (mercadería). */
  costeStock: number
  /** El resto: estructura. */
  costeEstructura: number
}

/** ¿La compra cae dentro del periodo? `desde`/`hasta` en ISO, ambos inclusive. */
function enPeriodo(fecha: string, desde?: string, hasta?: string): boolean {
  if (desde && fecha < desde) return false
  if (hasta && fecha > hasta) return false
  return true
}

/**
 * Agrupa las compras del periodo por categoría de gasto. Las anuladas quedan
 * fuera; las que no tienen categoría se agrupan aparte para que se vean y se
 * puedan clasificar (no se esconden en «otros»).
 */
export function resumirCompras(
  compras: Compra[],
  categorias: CategoriaGasto[],
  desde?: string,
  hasta?: string,
): ResumenCompras {
  const porCategoria = new Map<string, LineaResumenGasto>()
  const indice = new Map(categorias.map((c) => [c.id, c]))

  for (const c of compras) {
    if (c.anuladoEn || !enPeriodo(c.fechaFactura, desde, hasta)) continue
    const t = totalesCompra(c)
    const cat = c.categoriaGastoId ? indice.get(c.categoriaGastoId) : undefined
    const clave = cat?.id ?? 'sin-categoria'
    const iiee = c.impuestoEspecial ?? 0

    const linea =
      porCategoria.get(clave) ??
      ({
        categoriaId: clave,
        categoria: cat?.nombre ?? 'Sin categoría',
        base: 0,
        cuotaIva: 0,
        ivaNoDeducible: 0,
        impuestoEspecial: 0,
        total: 0,
        costeReal: 0,
        numFacturas: 0,
        deducible: cat?.deduciblePorDefecto ?? true,
      } as LineaResumenGasto)

    linea.base = aEuros(aCentimos(linea.base) + aCentimos(t.base))
    linea.cuotaIva = aEuros(aCentimos(linea.cuotaIva) + aCentimos(t.cuota))
    if (!c.deducible) linea.ivaNoDeducible = aEuros(aCentimos(linea.ivaNoDeducible) + aCentimos(t.cuota))
    linea.impuestoEspecial = aEuros(aCentimos(linea.impuestoEspecial) + aCentimos(iiee))
    linea.total = aEuros(aCentimos(linea.total) + aCentimos(t.total))
    linea.numFacturas++
    porCategoria.set(clave, linea)
  }

  // El coste real de cada categoría se cierra al final, ya con todo sumado.
  const lineas = [...porCategoria.values()].map((l) => ({
    ...l,
    costeReal: aEuros(aCentimos(l.base) + aCentimos(l.ivaNoDeducible) + aCentimos(l.impuestoEspecial)),
  }))
  lineas.sort((a, b) => b.costeReal - a.costeReal)

  const suma = (f: (l: LineaResumenGasto) => number) => aEuros(lineas.reduce((s, l) => s + aCentimos(f(l)), 0))
  const esStock = (id: string) => indice.get(id)?.esStock === true

  return {
    lineas,
    base: suma((l) => l.base),
    cuotaIva: suma((l) => l.cuotaIva),
    ivaDeducible: aEuros(aCentimos(suma((l) => l.cuotaIva)) - aCentimos(suma((l) => l.ivaNoDeducible))),
    ivaNoDeducible: suma((l) => l.ivaNoDeducible),
    impuestoEspecial: suma((l) => l.impuestoEspecial),
    total: suma((l) => l.total),
    costeReal: suma((l) => l.costeReal),
    numFacturas: lineas.reduce((s, l) => s + l.numFacturas, 0),
    costeStock: aEuros(lineas.filter((l) => esStock(l.categoriaId)).reduce((s, l) => s + aCentimos(l.costeReal), 0)),
    costeEstructura: aEuros(lineas.filter((l) => !esStock(l.categoriaId)).reduce((s, l) => s + aCentimos(l.costeReal), 0)),
  }
}

// ─────────────────── Deuda aplazada → líneas de presupuesto ───────────────────

/**
 * Familias de deuda con las que se presupuesta. Se agrupan así porque es como
 * se negocian y se vigilan: el banco por un lado, los socios por otro y los
 * aplazamientos con la Administración aparte, que son los que aprietan.
 */
export type FamiliaDeuda = 'BANCARIA' | 'SOCIOS' | 'HACIENDA' | 'SEGURIDAD_SOCIAL' | 'COMERCIAL' | 'OTRA'

export const ETIQUETA_FAMILIA_DEUDA: Record<FamiliaDeuda, string> = {
  BANCARIA: 'Préstamos y pólizas bancarias',
  SOCIOS: 'Préstamos de socios',
  HACIENDA: 'Aplazamiento con Hacienda',
  SEGURIDAD_SOCIAL: 'Aplazamiento con Seguridad Social',
  COMERCIAL: 'Aplazamientos con proveedores y acreedores',
  OTRA: 'Otra deuda aplazada',
}

export function familiaDeuda(tipo: TipoDeuda): FamiliaDeuda {
  switch (tipo) {
    case 'PRESTAMO':
    case 'POLIZA':
    case 'LEASING':
    case 'RENTING':
      return 'BANCARIA'
    case 'SOCIOS':
    case 'GRUPO':
      return 'SOCIOS'
    case 'HACIENDA':
      return 'HACIENDA'
    case 'SEG_SOCIAL':
      return 'SEGURIDAD_SOCIAL'
    case 'PROVEEDOR':
    case 'ACREEDOR':
      return 'COMERCIAL'
    default:
      return 'OTRA'
  }
}

export interface LineaDeudaPresupuesto {
  familia: FamiliaDeuda
  concepto: string
  /** 12 importes (enero..diciembre) con la cuota total a pagar cada mes. */
  meses: number[]
  totalAnual: number
}

/**
 * Reparte por meses las cuotas que vencen en el ejercicio, tomándolas del
 * cuadro de amortización de cada deuda. No se estima nada: sale del cuadro que
 * ya calcula la app, así que el presupuesto coincide con lo que hay firmado.
 */
export function cuotasDeudaPorMes(deudas: Deuda[], ejercicio: number): LineaDeudaPresupuesto[] {
  const porFamilia = new Map<FamiliaDeuda, number[]>()

  for (const d of deudas) {
    if (d.anuladoEn) continue
    let cuadro
    try {
      // `cuadroDeuda` respeta el calendario leído de un documento (aplazamiento
      // de Hacienda) por encima de la fórmula.
      cuadro = cuadroDeuda(d)
    } catch {
      continue // una deuda mal configurada no debe tumbar el presupuesto
    }

    const familia = familiaDeuda(d.tipo)
    const meses = porFamilia.get(familia) ?? Array(12).fill(0)
    for (const c of cuadro) {
      if (Number(c.fecha.slice(0, 4)) !== ejercicio) continue
      const mes = Number(c.fecha.slice(5, 7)) - 1
      if (mes < 0 || mes > 11) continue
      meses[mes] = aEuros(aCentimos(meses[mes]) + aCentimos(c.cuota))
    }
    porFamilia.set(familia, meses)
  }

  return [...porFamilia.entries()]
    .filter(([, meses]) => meses.some((m) => m !== 0))
    .map(([familia, meses]) => ({
      familia,
      concepto: ETIQUETA_FAMILIA_DEUDA[familia],
      meses,
      totalAnual: aEuros(meses.reduce((s, m) => s + aCentimos(m), 0)),
    }))
    .sort((a, b) => b.totalAnual - a.totalAnual)
}

// ───────────────── Gastos bancarios → líneas de presupuesto ─────────────────

export interface LineaGastoBancario {
  categoriaId: ID | 'sin-clasificar'
  categoria: string
  /** Tipo de línea con el que entra en el presupuesto. */
  efecto: 'GASTO' | 'INVERSION' | 'FINANCIACION'
  meses: number[]
  totalAnual: number
}

export interface LineaIngresoBancario {
  categoriaId: ID
  categoria: string
  /** Tipo de línea con el que entra en el presupuesto. */
  efecto: 'INGRESO' | 'INVERSION' | 'FINANCIACION'
  /** 12 importes en positivo: lo que ha entrado cada mes. */
  meses: number[]
  totalAnual: number
}

export interface LineaGastoCuenta {
  categoriaId: ID | 'sin-clasificar'
  categoria: string
  /** Nace en el propio banco (comisiones, mantenimiento, intereses). */
  esBancaria: boolean
  /** Qué hace en el presupuesto: gasto, inversión, financiación o nada. */
  efecto: EfectoPresupuesto
  total: number
  numMovimientos: number
}

export interface DesgloseGastosCuenta {
  lineas: LineaGastoCuenta[]
  /** Todo lo que ha salido de la cuenta en el periodo. */
  total: number
  /** La parte que cobra el banco: comisiones, mantenimiento, intereses. */
  totalBancario: number
  /** Gasto de explotación que se presupuesta desde aquí. */
  totalGasto: number
  /** Entradas que además son ingreso (dividendos, retrocesiones, intereses). */
  totalIngreso: number
  /** Tributos, Seguridad Social y demás pagos de deuda ya devengada. */
  totalFinanciacion: number
  /** Dinero que no se consume: se cambia por un activo. */
  totalInversion: number
  /** Ya contado en otro sitio (facturas, cuotas de préstamo, traspasos). */
  totalYaContabilizado: number
  /** Salidas todavía sin concepto asignado. */
  totalSinClasificar: number
  numSinClasificar: number
}

/**
 * Desglosa las **salidas** de una cuenta por concepto, para responder a «de
 * dónde vienen». Distingue lo que cobra el banco, lo que es pago de impuestos
 * o deuda, y lo que ya está contabilizado en otra pantalla (una factura, una
 * cuota de préstamo). Lo que aún no se ha clasificado se enseña, no se esconde.
 */
export function gastosCuentaPorCategoria(
  movimientos: { fecha: string; importe: number; categoriaId?: ID; clase: string; anuladoEn?: string }[],
  categorias: CategoriaGasto[],
  desde?: string,
  hasta?: string,
  flujo: Flujo = 'SALIDA',
): DesgloseGastosCuenta {
  const indice = new Map(categorias.map((c) => [c.id, c]))
  const porCategoria = new Map<string, LineaGastoCuenta>()

  for (const m of movimientos) {
    if (m.anuladoEn) continue
    if (flujo === 'SALIDA' ? m.importe >= 0 : m.importe <= 0) continue
    if (!enPeriodo(m.fecha, desde, hasta)) continue
    const cat = m.categoriaId ? indice.get(m.categoriaId) : undefined
    const clave = cat?.id ?? 'sin-clasificar'
    const linea =
      porCategoria.get(clave) ??
      ({
        categoriaId: clave,
        categoria: cat?.nombre ?? 'Sin clasificar',
        esBancaria: cat?.esBancaria === true || (!cat && m.clase === 'COMISION'),
        efecto: cat ? efectoPresupuestoDe(cat) : 'GASTO',
        total: 0,
        numMovimientos: 0,
      } as LineaGastoCuenta)
    linea.total = aEuros(aCentimos(linea.total) + aCentimos(Math.abs(m.importe)))
    linea.numMovimientos++
    porCategoria.set(clave, linea)
  }

  const lineas = [...porCategoria.values()].sort((a, b) => b.total - a.total)
  const sumar = (f: (l: LineaGastoCuenta) => boolean) =>
    aEuros(lineas.filter(f).reduce((s, l) => s + aCentimos(l.total), 0))
  const sinClasificar = lineas.find((l) => l.categoriaId === 'sin-clasificar')

  return {
    lineas,
    total: sumar(() => true),
    totalBancario: sumar((l) => l.esBancaria),
    totalGasto: sumar((l) => l.efecto === 'GASTO'),
    totalIngreso: sumar((l) => l.efecto === 'INGRESO'),
    totalFinanciacion: sumar((l) => l.efecto === 'FINANCIACION'),
    totalInversion: sumar((l) => l.efecto === 'INVERSION'),
    totalYaContabilizado: sumar((l) => l.efecto === 'NINGUNO'),
    totalSinClasificar: sinClasificar?.total ?? 0,
    numSinClasificar: sinClasificar?.numMovimientos ?? 0,
  }
}

/**
 * Reparte por meses lo que sale por el banco y **sí** hay que presupuestar,
 * agrupado por concepto bancario. Deja fuera, a propósito, lo que ya entra en
 * el presupuesto por otra puerta:
 *  · las facturas de proveedores (el gasto está en Compras),
 *  · las cuotas de préstamo (salen del cuadro de deuda),
 *  · los traspasos entre cuentas propias (no son gasto).
 * Contarlas aquí sería presupuestar dos veces lo mismo.
 *
 * Los tributos y la Seguridad Social entran como FINANCIACIÓN: sale dinero,
 * pero se salda una deuda ya devengada, no se genera gasto nuevo. Las compras
 * de participaciones y de inversiones financieras entran como INVERSIÓN: el
 * dinero no se consume, se cambia por un activo.
 */
export function gastosBancariosPorMes(
  movimientos: { fecha: string; importe: number; categoriaId?: ID; clase: string; anuladoEn?: string }[],
  categorias: CategoriaGasto[],
  ejercicio: number,
): LineaGastoBancario[] {
  const indice = new Map(categorias.map((c) => [c.id, c]))
  const porCategoria = new Map<string, number[]>()

  for (const m of movimientos) {
    if (m.anuladoEn || m.importe >= 0) continue
    if (Number(m.fecha.slice(0, 4)) !== ejercicio) continue
    const cat = m.categoriaId ? indice.get(m.categoriaId) : undefined
    // Sin clasificar solo se recoge lo que el banco marcó como comisión.
    if (!cat && m.clase !== 'COMISION') continue
    if (cat && ambitoDe(cat) !== 'BANCO') continue
    if (cat && efectoPresupuestoDe(cat) === 'NINGUNO') continue

    const clave = cat?.id ?? 'sin-clasificar'
    const meses = porCategoria.get(clave) ?? Array(12).fill(0)
    const mes = Number(m.fecha.slice(5, 7)) - 1
    if (mes < 0 || mes > 11) continue
    meses[mes] = aEuros(aCentimos(meses[mes]) + aCentimos(Math.abs(m.importe)))
    porCategoria.set(clave, meses)
  }

  return [...porCategoria.entries()]
    .map(([categoriaId, meses]) => {
      const cat = indice.get(categoriaId)
      const efecto = efectoPresupuestoDe(cat)
      return {
        categoriaId,
        categoria: cat?.nombre ?? 'Gastos bancarios sin clasificar',
        efecto: (efecto === 'NINGUNO' ? 'GASTO' : efecto) as 'GASTO' | 'INVERSION' | 'FINANCIACION',
        meses,
        totalAnual: aEuros(meses.reduce((s, m) => s + aCentimos(m), 0)),
      }
    })
    .sort((a, b) => b.totalAnual - a.totalAnual)
}


/**
 * Lo mismo que `gastosBancariosPorMes` pero con los **abonos**: de dónde viene
 * el dinero que entra. Y no todo lo que entra es ingreso — una ampliación de
 * capital o la devolución de un préstamo concedido engordan la cuenta sin ser
 * beneficio, así que cada línea lleva su tipo:
 *  · INGRESO — dividendos, retrocesiones de comisiones, intereses a favor.
 *  · INVERSION — devolución de préstamos concedidos, venta de inversiones
 *    (se recupera un activo: desinversión).
 *  · FINANCIACION — aportaciones de capital, préstamos recibidos, devoluciones
 *    de Hacienda.
 * Los cobros de clientes y los traspasos entre cuentas propias quedan fuera:
 * los primeros ya están en Ventas y los segundos no son dinero nuevo.
 *
 * Los importes salen **en positivo**: es quien presupuesta el que decide el
 * signo según el tipo de línea.
 */
export function ingresosBancariosPorMes(
  movimientos: { fecha: string; importe: number; categoriaId?: ID; clase: string; anuladoEn?: string }[],
  categorias: CategoriaGasto[],
  ejercicio: number,
): LineaIngresoBancario[] {
  const indice = new Map(categorias.map((c) => [c.id, c]))
  const porCategoria = new Map<string, number[]>()

  for (const m of movimientos) {
    if (m.anuladoEn || m.importe <= 0) continue
    if (Number(m.fecha.slice(0, 4)) !== ejercicio) continue
    const cat = m.categoriaId ? indice.get(m.categoriaId) : undefined
    if (!cat || ambitoDe(cat) !== 'BANCO' || flujoDe(cat) !== 'ENTRADA') continue
    if (efectoPresupuestoDe(cat) === 'NINGUNO') continue

    const meses = porCategoria.get(cat.id) ?? Array(12).fill(0)
    const mes = Number(m.fecha.slice(5, 7)) - 1
    if (mes < 0 || mes > 11) continue
    meses[mes] = aEuros(aCentimos(meses[mes]) + aCentimos(m.importe))
    porCategoria.set(cat.id, meses)
  }

  return [...porCategoria.entries()]
    .map(([categoriaId, meses]) => {
      const efecto = efectoPresupuestoDe(indice.get(categoriaId))
      return {
        categoriaId,
        categoria: indice.get(categoriaId)?.nombre ?? categoriaId,
        efecto: (efecto === 'NINGUNO' || efecto === 'GASTO' ? 'INGRESO' : efecto) as 'INGRESO' | 'INVERSION' | 'FINANCIACION',
        meses,
        totalAnual: aEuros(meses.reduce((s, m) => s + aCentimos(m), 0)),
      }
    })
    .sort((a, b) => b.totalAnual - a.totalAnual)
}
