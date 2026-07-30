/**
 * Construcción de los flujos previstos de tesorería a partir de los datos:
 * compras pendientes, cobros de deudores, cuotas de deuda, gastos recurrentes
 * e IVA estimado del trimestre. Alimenta la previsión de tesorería.
 */
import { sumarDias, sumarMeses } from './fechas'
import { totalesCompra } from '../dominio/compras'
import { generarCuadro } from '../dominio/amortizacion'
import { aCentimos, aEuros } from '../dominio/dinero'
import type { Flujo } from '../dominio/prevision'
import type { Configuracion, DatosOperativos } from '../dominio/tipos'

function enRango(fecha: string, desde: string, hasta: string): boolean {
  return fecha >= desde && fecha <= hasta
}

/** Fecha de presentación del 303 del trimestre que contiene `fecha`. */
function fechaPago303(anio: number, trimestre: number): string {
  // T1→20 abr, T2→20 jul, T3→20 oct, T4→30 ene (año siguiente).
  if (trimestre === 1) return `${anio}-04-20`
  if (trimestre === 2) return `${anio}-07-20`
  if (trimestre === 3) return `${anio}-10-20`
  return `${anio + 1}-01-30`
}

export function construirFlujosPrevistos(
  datos: DatosOperativos,
  config: Configuracion,
  desde: string,
  dias: number,
): Flujo[] {
  const hasta = sumarDias(desde, dias - 1)
  const flujos: Flujo[] = []

  // Salidas: compras pendientes con vencimiento.
  for (const c of datos.compras) {
    if (c.anuladoEn || c.estadoPago === 'PAGADA' || !c.fechaVencimiento) continue
    if (!enRango(c.fechaVencimiento, desde, hasta)) continue
    flujos.push({ fecha: c.fechaVencimiento, importe: -totalesCompra(c).total, concepto: `Pago ${c.numFactura}`, categoria: 'compras' })
  }

  // Entradas: cobros de deudores con vencimiento.
  for (const d of datos.deudores) {
    if (d.anuladoEn || d.estado === 'INCOBRABLE' || !d.fechaVencimiento) continue
    if (!enRango(d.fechaVencimiento, desde, hasta)) continue
    flujos.push({ fecha: d.fechaVencimiento, importe: d.importe, concepto: `Cobro ${d.nombre}`, categoria: 'cobros' })
  }

  // Salidas: cuotas de deuda (cuadro de amortización).
  for (const deuda of datos.deudas) {
    if (deuda.anuladoEn) continue
    const cuadro = generarCuadro({ principal: deuda.importeOriginal, tipoAnual: deuda.tipoInteres, nPeriodos: deuda.nPeriodos, periodicidad: deuda.periodicidad, fechaInicio: deuda.fechaInicio, sistema: deuda.sistema })
    for (const cuota of cuadro) {
      if (enRango(cuota.fecha, desde, hasta)) flujos.push({ fecha: cuota.fecha, importe: -cuota.cuota, concepto: `Cuota ${deuda.acreedor}`, categoria: 'deuda' })
    }
  }

  // Salidas: gastos recurrentes (mensuales) con su IVA.
  for (const r of datos.recurrentes) {
    if (!r.activo) continue
    const tipo = config.tiposIva.find((t) => t.id === r.tipoIvaId)
    const cuota = tipo && tipo.regimen === 'GENERAL' ? aEuros(Math.round(aCentimos(r.base) * (tipo.tipo / 100))) : 0
    const total = aEuros(aCentimos(r.base) + aCentimos(cuota))
    for (let m = 0; m < Math.ceil(dias / 30) + 1; m++) {
      const base = sumarMeses(desde.slice(0, 8) + String(r.diaDelMes).padStart(2, '0'), m)
      if (enRango(base, desde, hasta)) flujos.push({ fecha: base, importe: -total, concepto: r.concepto, categoria: 'recurrente' })
    }
  }

  // Salida: IVA estimado del trimestre (repercutido − soportado deducible).
  const trimestres = new Set<string>()
  for (const v of datos.ventas) if (!v.anuladoEn) trimestres.add(claveTrim(v.fecha))
  for (const c of datos.compras) if (!c.anuladoEn) trimestres.add(claveTrim(c.fechaFactura))
  for (const clave of trimestres) {
    const [anio, tri] = clave.split('-').map(Number)
    const fecha = fechaPago303(anio, tri)
    if (!enRango(fecha, desde, hasta)) continue
    let repercutido = 0
    let soportado = 0
    for (const v of datos.ventas) if (!v.anuladoEn && claveTrim(v.fecha) === clave) for (const l of v.lineasIva) repercutido += aCentimos(l.cuota)
    for (const c of datos.compras) if (!c.anuladoEn && c.deducible && claveTrim(c.fechaFactura) === clave) for (const l of c.lineasIva) soportado += aCentimos(l.cuota)
    const aPagar = aEuros(repercutido - soportado)
    if (aPagar > 0) flujos.push({ fecha, importe: -aPagar, concepto: `IVA 303 T${tri}`, categoria: 'impuestos' })
  }

  return flujos
}

function claveTrim(fechaISO: string): string {
  const mes = Number(fechaISO.slice(5, 7))
  const tri = Math.floor((mes - 1) / 3) + 1
  return `${fechaISO.slice(0, 4)}-${tri}`
}
