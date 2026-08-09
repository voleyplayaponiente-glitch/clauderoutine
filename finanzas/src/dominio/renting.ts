/**
 * Renting: arrendamiento operativo. **No es deuda y no lleva tipo de interés.**
 *
 * Se pacta una cuota lineal para toda la vida del contrato y al final se
 * devuelve el bien: no hay capital pendiente que amortizar ni opción de compra,
 * así que no tiene cuadro de amortización ni intereses que separar.
 *
 * Consecuencias que sostienen todo este módulo:
 *  · La cuota es **gasto** de P&G (621, arrendamientos y cánones), no
 *    financiación. Al presupuesto va como GASTO.
 *  · Al presupuesto va la **base**, porque el IVA soportado se deduce y no es
 *    coste. La **salida de caja**, en cambio, es la cuota CON IVA: se calculan
 *    las dos y la pantalla enseña ambas para que no se confundan.
 *  · Lo que queda por pagar es un **compromiso futuro**, no una deuda del
 *    balance: se muestra aparte y con ese nombre.
 */
import { aCentimos, aEuros, redondear2 } from './dinero'
import type { Renting } from './tipos'

const MESES_POR_PERIODO = { MENSUAL: 1, TRIMESTRAL: 3, ANUAL: 12 } as const

function sumarMeses(iso: string, meses: number): string {
  const d = new Date(iso + 'T00:00:00')
  const dia = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + meses)
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(dia, ultimo))
  return d.toISOString().slice(0, 10)
}

export interface CuotaRenting {
  numero: number
  fecha: string
  base: number
  iva: number
  total: number
}

/** IVA de una base al tipo indicado. */
export function ivaDeCuota(base: number, tipoIva: number): number {
  return aEuros(Math.round((aCentimos(base) * tipoIva) / 100))
}

/**
 * Cuotas del contrato, todas iguales.
 * La primera vence un periodo DESPUÉS de `fechaInicio`, igual que en los
 * préstamos: es la convención del banco y así los dos cuadros son comparables.
 */
export function cuadroRenting(r: Renting): CuotaRenting[] {
  if (r.nCuotas <= 0 || r.cuotaBase <= 0) return []
  const paso = MESES_POR_PERIODO[r.periodicidad]
  const base = redondear2(r.cuotaBase)
  const iva = ivaDeCuota(base, r.tipoIva)
  const cuotas: CuotaRenting[] = []
  for (let n = 1; n <= r.nCuotas; n++) {
    cuotas.push({ numero: n, fecha: sumarMeses(r.fechaInicio, paso * n), base, iva, total: aEuros(aCentimos(base) + aCentimos(iva)) })
  }
  return cuotas
}

export interface ResumenRenting {
  cuotas: CuotaRenting[]
  pagadas: number
  pendientes: number
  /** Gasto ya devengado (sin IVA) y lo que queda por devengar. */
  gastoPagado: number
  compromisoPendiente: number
  /** Salida de caja pendiente, ya con IVA: es lo que se irá del banco. */
  cajaPendiente: number
  /** Coste total del contrato sin IVA. */
  costeTotal: number
  fechaUltimaCuota?: string
}

export function resumenRenting(r: Renting, hoy: string): ResumenRenting {
  const cuotas = cuadroRenting(r)
  const pagadas = cuotas.filter((c) => c.fecha <= hoy)
  const pendientes = cuotas.filter((c) => c.fecha > hoy)
  const suma = (xs: number[]) => aEuros(xs.reduce((s, x) => s + aCentimos(x), 0))
  return {
    cuotas,
    pagadas: pagadas.length,
    pendientes: pendientes.length,
    gastoPagado: suma(pagadas.map((c) => c.base)),
    compromisoPendiente: suma(pendientes.map((c) => c.base)),
    cajaPendiente: suma(pendientes.map((c) => c.total)),
    costeTotal: suma(cuotas.map((c) => c.base)),
    fechaUltimaCuota: cuotas[cuotas.length - 1]?.fecha,
  }
}

/**
 * Avisos del contrato. Solo se avisa de lo que se puede comprobar con los datos
 * del propio contrato; nada de suposiciones.
 */
export function avisosRenting(r: Renting, hoy: string): string[] {
  const avisos: string[] = []
  const res = resumenRenting(r, hoy)

  if (r.cuotasFacturadas !== undefined && Math.abs(r.cuotasFacturadas - res.pagadas) > 1) {
    avisos.push(
      `El banco dice ${r.cuotasFacturadas} cuotas facturadas y por fechas salen ${res.pagadas}. Suele ser porque el recibo se ` +
        'gira un día fijo del mes y no el de la firma; si quieres que cuadre al detalle, mueve la fecha de contratación.',
    )
  }
  if (r.fechaFin && res.fechaUltimaCuota && r.fechaFin.slice(0, 7) !== res.fechaUltimaCuota.slice(0, 7)) {
    avisos.push(
      `La última cuota calculada cae en ${res.fechaUltimaCuota} y el contrato vence el ${r.fechaFin}. Ajusta el nº de cuotas o la fecha de inicio.`,
    )
  }
  if (res.pendientes === 0) avisos.push('El contrato ya está terminado: toca devolver el bien o renovarlo.')
  else if (res.pendientes <= 3) avisos.push(`Quedan ${res.pendientes} cuotas: prepara la devolución o la renovación.`)

  if (r.kmContratados) {
    avisos.push(`Kilometraje contratado ${r.kmContratados.toLocaleString('es-ES')} km: pasarse tiene recargo al devolver el vehículo.`)
  }
  return avisos
}

export interface LineaRentingPresupuesto {
  rentingId: string
  concepto: string
  /** Base por meses: es lo que entra en el presupuesto como GASTO. */
  meses: number[]
  /** Cuota con IVA por meses: la salida real de caja. */
  mesesConIva: number[]
  totalAnual: number
  totalAnualConIva: number
}

/**
 * Reparte por meses las cuotas del ejercicio. Una línea por contrato (no se
 * agrupan: cada vehículo se negocia y se devuelve por separado).
 */
export function cuotasRentingPorMes(rentings: Renting[], ejercicio: number): LineaRentingPresupuesto[] {
  const lineas: LineaRentingPresupuesto[] = []

  for (const r of rentings) {
    if (r.anuladoEn) continue
    const meses = Array(12).fill(0) as number[]
    const mesesConIva = Array(12).fill(0) as number[]
    for (const c of cuadroRenting(r)) {
      if (Number(c.fecha.slice(0, 4)) !== ejercicio) continue
      const m = Number(c.fecha.slice(5, 7)) - 1
      if (m < 0 || m > 11) continue
      meses[m] = aEuros(aCentimos(meses[m]) + aCentimos(c.base))
      mesesConIva[m] = aEuros(aCentimos(mesesConIva[m]) + aCentimos(c.total))
    }
    if (!meses.some((m) => m !== 0)) continue
    lineas.push({
      rentingId: r.id,
      concepto: [r.descripcion || 'Renting', r.matricula].filter(Boolean).join(' · '),
      meses,
      mesesConIva,
      totalAnual: aEuros(meses.reduce((s, m) => s + aCentimos(m), 0)),
      totalAnualConIva: aEuros(mesesConIva.reduce((s, m) => s + aCentimos(m), 0)),
    })
  }

  return lineas.sort((a, b) => b.totalAnual - a.totalAnual)
}
