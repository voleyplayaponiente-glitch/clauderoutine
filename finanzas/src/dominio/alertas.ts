/**
 * Centro de alertas: a partir de unas métricas ya calculadas, genera la lista
 * de alertas priorizadas del dashboard. Lógica pura y testeable; el cálculo de
 * las métricas (que depende de los datos) vive en la capa lib.
 */
export type NivelAlerta = 'critico' | 'aviso' | 'info'

export interface Alerta {
  id: string
  nivel: NivelAlerta
  titulo: string
  detalle: string
  ruta: string
}

export interface MetricasAlerta {
  tensionLiquidez: boolean
  diaTension?: string
  facturasVencidas: number
  importeVencido: number
  descuadresCaja: number
  stockBajo: number
  impuestosProximos: number
  conciliacionesPendientes: number
  puntosBajoObjetivo: number
  /** Pólizas cuyo consumo de hoy pasa del umbral marcado. */
  polizasSobreUmbral: number
  /** Pólizas cuyo consumo MEDIO del año pasa del umbral: la renovación peligra. */
  polizasMediaAlta: number
  /**
   * Hay datos, pero la copia en el servidor propio está apagada o sin
   * configurar. Es la alerta que faltaba el día que se perdieron los datos de
   * tres empresas: entonces no había ningún aviso de que no existía copia
   * fuera del navegador.
   */
  copiasSinServidor?: boolean
}

const ORDEN: Record<NivelAlerta, number> = { critico: 0, aviso: 1, info: 2 }

/** Devuelve singular/plural según la cantidad. */
function plural(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`
}

export function generarAlertas(m: MetricasAlerta, fmt: (n: number) => string): Alerta[] {
  const alertas: Alerta[] = []
  if (m.tensionLiquidez) {
    alertas.push({ id: 'tension', nivel: 'critico', titulo: 'Tensión de liquidez prevista', detalle: m.diaTension ? `El saldo baja del mínimo el ${m.diaTension}` : 'El saldo baja del mínimo de seguridad', ruta: '/tesoreria' })
  }
  if (m.facturasVencidas > 0) {
    alertas.push({ id: 'vencidas', nivel: 'aviso', titulo: `${plural(m.facturasVencidas, 'factura vencida', 'facturas vencidas')} sin pagar`, detalle: `Total ${fmt(m.importeVencido)}`, ruta: '/compras' })
  }
  if (m.descuadresCaja > 0) {
    alertas.push({ id: 'caja', nivel: 'aviso', titulo: `${plural(m.descuadresCaja, 'arqueo con descuadre', 'arqueos con descuadre')}`, detalle: 'Superan el umbral tolerado', ruta: '/caja' })
  }
  if (m.puntosBajoObjetivo > 0) {
    alertas.push({ id: 'objetivo', nivel: 'aviso', titulo: `${plural(m.puntosBajoObjetivo, 'punto por debajo de objetivo', 'puntos por debajo de objetivo')}`, detalle: 'Venta del mes inferior al objetivo', ruta: '/ventas' })
  }
  // La póliza es de las pocas cosas que se pueden arreglar con antelación: si
  // se avisa tarde, ya no hay margen para bajar el saldo antes de la renovación.
  if (m.polizasSobreUmbral > 0) {
    alertas.push({
      id: 'poliza-consumo',
      nivel: 'aviso',
      titulo: `${plural(m.polizasSobreUmbral, 'póliza muy dispuesta', 'pólizas muy dispuestas')}`,
      detalle: 'Han pasado del umbral de consumo que marcaste',
      ruta: '/deudas',
    })
  }
  if (m.polizasMediaAlta > 0) {
    alertas.push({
      id: 'poliza-media',
      nivel: 'critico',
      titulo: `${plural(m.polizasMediaAlta, 'póliza con saldo medio alto', 'pólizas con saldo medio alto')}`,
      detalle: 'El consumo medio del año compromete la renovación',
      ruta: '/deudas',
    })
  }
  if (m.copiasSinServidor) {
    // Crítica a propósito: sin copia fuera del navegador, una limpieza del
    // sitio se lleva los datos y no hay de dónde sacarlos. Ya pasó una vez.
    alertas.push({
      id: 'copias-sin-servidor',
      nivel: 'critico',
      titulo: 'Sin copia fuera de este navegador',
      detalle: 'Hay datos y el servidor de copias está apagado o sin configurar',
      ruta: '/copias',
    })
  }
  if (m.stockBajo > 0) {
    alertas.push({ id: 'stock', nivel: 'aviso', titulo: `${plural(m.stockBajo, 'artículo bajo mínimo', 'artículos bajo mínimo')}`, detalle: 'Necesitan reposición', ruta: '/stock' })
  }
  if (m.impuestosProximos > 0) {
    alertas.push({ id: 'impuestos', nivel: 'info', titulo: `${plural(m.impuestosProximos, 'vencimiento de impuestos próximo', 'vencimientos de impuestos próximos')}`, detalle: 'En los próximos días', ruta: '/tesoreria' })
  }
  if (m.conciliacionesPendientes > 0) {
    alertas.push({ id: 'conciliacion', nivel: 'info', titulo: `${plural(m.conciliacionesPendientes, 'movimiento sin conciliar', 'movimientos sin conciliar')}`, detalle: 'Bandeja de conciliación bancaria', ruta: '/bancos' })
  }
  return alertas.sort((a, b) => ORDEN[a.nivel] - ORDEN[b.nivel])
}
