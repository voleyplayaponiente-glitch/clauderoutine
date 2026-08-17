/**
 * Ensamblado de los datos del Dashboard: KPIs, evolución de tesorería (real +
 * proyectada), ventas por canal y tienda, waterfall de resultado, vencimientos
 * próximos y métricas para el centro de alertas.
 */
import { aCentimos, aEuros } from '../dominio/dinero'
import { tesoreriaTotal } from '../dominio/tesoreria'
import { brutoVenta, baseTotal } from '../dominio/ventas'
import { totalesCompra } from '../dominio/compras'
import { generarCuadro, resumenCuadro } from '../dominio/amortizacion'
import { existenciaTotal } from '../dominio/valoracion'
import { resumenArticulo } from '../dominio/stock'
import { proyectarSaldoDiario, detectarTension, type Flujo } from '../dominio/prevision'
import { evaluarArqueo } from '../dominio/tesoreria'
import { UMBRAL_CONSUMO, consumoMedio, polizaConCuenta, situacionPoliza } from '../dominio/poliza'
import { resumenFinanciacion } from '../dominio/financiacion'
import type { MetricasAlerta } from '../dominio/alertas'
import type { Configuracion, DatosOperativos, TipoPuntoVenta } from '../dominio/tipos'
import { construirFlujosPrevistos } from './flujos'
import { sumarDias } from './fechas'

const CANAL_ETIQUETA: Record<TipoPuntoVenta, string> = {
  TIENDA: 'Tienda', STAND: 'Stand', WEB: 'Web', MARKETPLACE: 'Marketplace', MAYORISTA: 'Mayorista', EVENTO: 'Evento',
}

export interface DashboardData {
  tesoreria: number
  ventaMes: number
  objetivoMes: number
  margenBrutoPct: number
  resultadoMes: number
  deudaTotal: number
  stockValorado: number
  serieTesoreria: { fecha: string; real: number | null; proyectado: number | null }[]
  ventasPorCanal: { rows: Record<string, number | string>[]; canales: { key: string; nombre: string }[] }
  ranking: { nombre: string; venta: number; objetivo: number }[]
  waterfall: { ventas: number; coste: number; gastos: number; resultado: number }
  vencimientos: Flujo[]
  metricas: MetricasAlerta
}

function mesDe(iso: string): string {
  return iso.slice(0, 7)
}

/**
 * Pólizas que se han pasado del consumo marcado, hoy y de media en el año.
 * La media es la que decide la renovación, por eso van contadas aparte.
 */
function alertasPoliza(datos: DatosOperativos, hoy: string): { polizasSobreUmbral: number; polizasMediaAlta: number } {
  const cuentas = datos.cuentasTesoreria.filter((c) => !c.anuladoEn)
  let sobreUmbral = 0
  let mediaAlta = 0
  for (const guardada of datos.polizas ?? []) {
    if (guardada.anuladoEn) continue
    const p = polizaConCuenta(guardada, cuentas, datos.movimientos, hoy)
    const s = situacionPoliza(p)
    const umbral = p.umbralAviso ?? UMBRAL_CONSUMO
    if (s.porcentajeDispuesto > umbral) sobreUmbral++
    const cuenta = cuentas.find((c) => c.id === p.cuentaTesoreriaId)
    if (!cuenta) continue
    const consumo = consumoMedio(cuenta, datos.movimientos, `${hoy.slice(0, 4)}-01-01`, hoy, s.limite)
    if (consumo.porcentajeMedio > umbral) mediaAlta++
  }
  return { polizasSobreUmbral: sobreUmbral, polizasMediaAlta: mediaAlta }
}

export function calcularDashboard(
  datos: DatosOperativos,
  config: Configuracion,
  hoy: string,
  /** Estado de cosas que no viven en la configuración de la empresa. */
  extra?: { copiasSinServidor?: boolean },
): DashboardData {
  const mesActual = mesDe(hoy)
  const cuentas = datos.cuentasTesoreria.filter((c) => !c.anuladoEn)
  const tesoreria = tesoreriaTotal(cuentas, datos.movimientos)

  // Ventas del mes.
  const ventasMes = datos.ventas.filter((v) => !v.anuladoEn && mesDe(v.fecha) === mesActual)
  const ventaMes = ventasMes.reduce((s, v) => s + brutoVenta(v), 0)
  const ventaBaseMes = ventasMes.reduce((s, v) => s + baseTotal(v.lineasIva), 0)
  const puntos = config.centrosCoste.filter((c) => c.tipo === 'PUNTO_VENTA' && !c.activoHasta)
  const objetivoMes = puntos.reduce((s, p) => s + (p.objetivoVentaMensual ?? 0), 0)

  // Compras del mes (base).
  const comprasMes = datos.compras.filter((c) => !c.anuladoEn && mesDe(c.fechaFactura) === mesActual)
  const costeMes = comprasMes.filter((c) => c.naturaleza === 'MERCADERIA').reduce((s, c) => s + totalesCompra(c).base, 0)
  const gastosMes = comprasMes.filter((c) => c.naturaleza === 'SERVICIO').reduce((s, c) => s + totalesCompra(c).base, 0)
  const margenBruto = aEuros(aCentimos(ventaBaseMes) - aCentimos(costeMes))
  const margenBrutoPct = ventaBaseMes > 0 ? Math.round((margenBruto / ventaBaseMes) * 100) : 0
  const resultadoMes = aEuros(aCentimos(margenBruto) - aCentimos(gastosMes))

  // Deuda total pendiente.
  // Todo lo que se debe: préstamos, pólizas, tarjetas, renting y no bancaria.
  const deudaTotal = resumenFinanciacion(datos, hoy).total

  // Stock valorado.
  const almacenIds = datos.almacenes.filter((a) => !a.anuladoEn).map((a) => a.id)
  const articulos = datos.articulos.filter((a) => !a.anuladoEn)
  const stockValorado = articulos.reduce((s, a) => s + existenciaTotal(a.id, datos.movimientosStock, almacenIds).valor, 0)

  // Serie de tesorería: 30 días atrás (real) + 60 adelante (proyectado).
  const flujos = construirFlujosPrevistos(datos, config, hoy, 61)
  const proy = proyectarSaldoDiario(tesoreria, flujos, hoy, 61)
  const proyMap = new Map(proy.map((p) => [p.fecha, p.saldo]))
  const serieTesoreria: DashboardData['serieTesoreria'] = []
  for (let off = -30; off <= 60; off++) {
    const fecha = sumarDias(hoy, off)
    if (off <= 0) {
      // saldo(d) = saldo hoy − movimientos posteriores a d hasta hoy.
      let cent = aCentimos(tesoreria)
      for (const m of datos.movimientos) if (!m.anuladoEn && m.fecha > fecha && m.fecha <= hoy) cent -= aCentimos(m.importe)
      serieTesoreria.push({ fecha, real: aEuros(cent), proyectado: off === 0 ? tesoreria : null })
    } else {
      serieTesoreria.push({ fecha, real: null, proyectado: proyMap.get(fecha) ?? null })
    }
  }

  // Ventas por canal (últimos 6 meses, apiladas).
  const meses6: string[] = []
  for (let i = 5; i >= 0; i--) meses6.push(mesDe(sumarDias(hoy, -i * 30)))
  const canalesSet = new Set<string>()
  const rows = meses6.map((mes) => {
    const row: Record<string, number | string> = { mes }
    for (const v of datos.ventas) {
      if (v.anuladoEn || mesDe(v.fecha) !== mes) continue
      const p = puntos.find((x) => x.id === v.centroCosteId) ?? config.centrosCoste.find((x) => x.id === v.centroCosteId)
      const canal = p?.tipoPuntoVenta ?? 'TIENDA'
      canalesSet.add(canal)
      row[canal] = aEuros(aCentimos((row[canal] as number) ?? 0) + aCentimos(brutoVenta(v)))
    }
    return row
  })
  const canales = [...canalesSet].map((k) => ({ key: k, nombre: CANAL_ETIQUETA[k as TipoPuntoVenta] ?? k }))

  // Ranking por tienda (mes actual).
  const ranking = puntos.map((p) => ({
    nombre: p.nombre,
    venta: ventasMes.filter((v) => v.centroCosteId === p.id).reduce((s, v) => s + brutoVenta(v), 0),
    objetivo: p.objetivoVentaMensual ?? 0,
  })).sort((a, b) => b.venta - a.venta)

  // Vencimientos próximos 15 días.
  const hasta15 = sumarDias(hoy, 15)
  const vencimientos = flujos.filter((f) => f.fecha >= hoy && f.fecha <= hasta15).sort((a, b) => a.fecha.localeCompare(b.fecha))

  // Métricas para alertas.
  const tension = detectarTension(proyectarSaldoDiario(tesoreria, flujos, hoy, 30), config.umbrales.saldoMinimoSeguridad)
  const facturasVencidasList = datos.compras.filter((c) => !c.anuladoEn && c.estadoPago !== 'PAGADA' && c.fechaVencimiento && c.fechaVencimiento < hoy)
  const descuadresCaja = datos.arqueos.filter((a) => !a.anuladoEn && evaluarArqueo(a.denominaciones, a.saldoTeorico, config.umbrales.descuadreCajaTolerado).superaUmbral).length
  const stockBajo = articulos.map((a) => resumenArticulo(a, datos.movimientosStock, almacenIds)).filter((r) => r.bajoMinimo).length
  const conciliacionesPendientes = datos.movimientos.filter((m) => !m.anuladoEn && !m.conciliado && cuentas.find((c) => c.id === m.cuentaId && c.tipo !== 'CAJA')).length
  const impuestosProximos = flujos.filter((f) => f.categoria === 'impuestos' && f.fecha <= hasta15).length
  const puntosBajoObjetivo = ranking.filter((r) => r.objetivo > 0 && r.venta < r.objetivo).length

  const metricas: MetricasAlerta = {
    tensionLiquidez: tension.hayTension,
    diaTension: tension.primerDia,
    facturasVencidas: facturasVencidasList.length,
    importeVencido: facturasVencidasList.reduce((s, c) => s + totalesCompra(c).total, 0),
    descuadresCaja,
    stockBajo,
    impuestosProximos,
    conciliacionesPendientes,
    puntosBajoObjetivo,
    ...alertasPoliza(datos, hoy),
    copiasSinServidor: extra?.copiasSinServidor,
  }

  return { tesoreria, ventaMes, objetivoMes, margenBrutoPct, resultadoMes, deudaTotal, stockValorado, serieTesoreria, ventasPorCanal: { rows, canales }, ranking, waterfall: { ventas: ventaBaseMes, coste: costeMes, gastos: gastosMes, resultado: resultadoMes }, vencimientos, metricas }
}
