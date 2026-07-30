/**
 * Tipos del dominio. Contratos compartidos por toda la app.
 * El modelo completo se irá ampliando fase a fase; aquí están los cimientos
 * (configuración de empresa, centros de coste, plan contable, impuestos)
 * que la Fase 1 rellena y el resto de módulos consumen.
 */

export type ID = string

/** Metadatos de trazabilidad presentes en TODO registro (nunca se borra nada). */
export interface Trazable {
  id: ID
  creadoEn: string // ISO
  creadoPor: string
  origen: 'MANUAL' | 'EXCEL' | 'CSV' | 'PDF' | 'API'
  anuladoEn?: string // borrado lógico
}

export interface DatosEmpresa {
  razonSocial: string
  cif: string
  domicilioFiscal: string
  ejercicioActual: number // año
  logoDataUrl?: string
  esFilial: boolean
  matrizNombre?: string
  matrizCif?: string
}

export type TipoCentroCoste = 'PUNTO_VENTA' | 'ESTRUCTURA' | 'PROYECTO'
export type TipoPuntoVenta =
  | 'TIENDA'
  | 'STAND'
  | 'WEB'
  | 'MARKETPLACE'
  | 'MAYORISTA'
  | 'EVENTO'

export interface CentroCoste extends Trazable {
  codigo: string
  nombre: string
  tipo: TipoCentroCoste
  padreId?: ID
  activoDesde: string
  activoHasta?: string
  // Campos de punto de venta (solo si tipo === 'PUNTO_VENTA')
  tipoPuntoVenta?: TipoPuntoVenta
  direccion?: string
  responsable?: string
  costeFijoMensual?: number
  objetivoVentaMensual?: number
}

/** Cuenta del Plan General Contable. */
export interface CuentaPGC {
  codigo: string // "700"
  nombre: string
  grupo: number // 1..9
  naturaleza: 'ACTIVO' | 'PASIVO' | 'PN' | 'INGRESO' | 'GASTO'
}

export type RegimenIva = 'GENERAL' | 'EXENTO' | 'NO_SUJETO' | 'ISP'

export interface TipoIva {
  id: ID
  nombre: string // "General 21%"
  tipo: number // 21
  regimen: RegimenIva
  vigenteDesde: string
  vigenteHasta?: string
  porDefecto?: boolean
}

/** Impuesto especial parametrizable (por ml o por unidad). NUNCA hardcodeado. */
export interface ImpuestoEspecial {
  id: ID
  nombre: string
  base: 'POR_ML' | 'POR_UNIDAD'
  importePorUnidad: number // € por ml o por unidad
  familiasAplicables: string[]
  vigenteDesde: string
  vigenteHasta?: string
}

export interface ObligacionFiscal {
  id: ID
  modelo: string // "303", "111", "115", "200", "202", "347"
  periodicidad: 'MENSUAL' | 'TRIMESTRAL' | 'ANUAL'
  descripcion: string
}

export interface CategoriaGasto {
  id: ID
  nombre: string
  cuentaPGC: string
  deduciblePorDefecto: boolean
}

export interface Umbrales {
  saldoMinimoSeguridad: number
  descuadreCajaTolerado: number
  diasStockMuerto: number
  limitePagoEfectivo: number
  diasRetrasoReclamar: number
  mesesNegativoAlertaPunto: number
}

export interface Apariencia {
  densidad: 'comoda' | 'compacta'
  formatoFecha: 'dd/mm/aaaa' | 'aaaa-mm-dd'
  moneda: 'EUR'
}

// ─────────────────────────── Operativa (Fase 2) ───────────────────────────

/** Tercero: proveedor/cliente/acreedor… (unificado, un rol no excluye otro). */
export interface Tercero extends Trazable {
  nombre: string
  cif: string
  esProveedor: boolean
  esCliente: boolean
  esVinculada: boolean // operación vinculada (socio o grupo)
  iban?: string
  contacto?: string
  condicionesPagoDias?: number // p. ej. 30, 60
}

/** Forma de cobro de una venta. */
export type FormaCobro = 'EFECTIVO' | 'TARJETA' | 'BIZUM' | 'TRANSFERENCIA' | 'PASARELA' | 'APLAZADO'

/** Forma de pago de una compra. */
export type FormaPago = 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'DOMICILIADO' | 'APLAZADO'

/** Línea de IVA (base + régimen + tipo), reutilizada en ventas y compras. */
export interface LineaIva {
  base: number
  tipoIvaId: ID
  tipo: number
  regimen: RegimenIva
  cuota: number
}

/** Registro diario de ventas: único por punto de venta y fecha. */
export interface Venta extends Trazable {
  centroCosteId: ID
  fecha: string // yyyy-mm-dd
  lineasIva: LineaIva[]
  cobros: { forma: FormaCobro; importe: number }[]
  numTickets: number
  unidades: number
  cerrado: boolean // cierre diario
  firmadoPor?: string
}

export type NaturalezaCompra = 'MERCADERIA' | 'SERVICIO'
export type EstadoPago = 'PENDIENTE' | 'PARCIAL' | 'PAGADA'

/** Compra / gasto (factura recibida). */
export interface Compra extends Trazable {
  naturaleza: NaturalezaCompra
  terceroId: ID
  numFactura: string
  fechaFactura: string
  fechaVencimiento?: string
  lineasIva: LineaIva[]
  retencion: number // importe de retención (111/115)
  formaPago: FormaPago
  estadoPago: EstadoPago
  centroCosteId?: ID // centro de coste o estructura
  categoriaGastoId?: ID
  cuentaGasto?: string // cuenta PGC de gasto (600/62x)
  deducible: boolean
  motivoNoDeducible?: string
  adjuntoNombre?: string
  esRecurrente?: boolean
  previsto?: boolean // recurrente auto-generado pendiente de confirmar
}

/** Gasto recurrente que se auto-genera cada mes (alquiler, cuota, seguro…). */
export interface GastoRecurrente {
  id: ID
  concepto: string
  terceroId: ID
  base: number
  tipoIvaId: ID
  categoriaGastoId?: ID
  centroCosteId?: ID
  diaDelMes: number
  cuentaGasto?: string
  activo: boolean
}

// ─────────────────────────── Tesorería (Fase 3) ───────────────────────────

export type TipoCuentaTesoreria = 'CAJA' | 'BANCO' | 'TPV_LIQUIDADOR' | 'PASARELA'

/** Cuenta de tesorería: unifica caja y banco. */
export interface CuentaTesoreria extends Trazable {
  nombre: string
  tipo: TipoCuentaTesoreria
  centroCosteId?: ID // caja por punto de venta
  iban?: string
  saldoInicial: number
  limiteDescubierto?: number
  cuentaPGC?: string // 570 caja / 572 banco
}

/** Clase de movimiento (sobre todo para caja). */
export type ClaseMovimiento =
  | 'APERTURA'
  | 'VENTA_EFECTIVO'
  | 'COBRO'
  | 'PAGO_PROVEEDOR'
  | 'GASTO_MENOR'
  | 'INGRESO_BANCO'
  | 'RETIRADA'
  | 'TRASPASO'
  | 'CIERRE'
  | 'COMISION'
  | 'OTRO'

export interface MovimientoTesoreria extends Trazable {
  cuentaId: ID
  fecha: string // yyyy-mm-dd
  concepto: string
  importe: number // + entrada / − salida
  clase: ClaseMovimiento
  categoriaId?: ID
  conciliado: boolean
  traspasoParejaId?: ID // otro movimiento del traspaso
  referencia?: string // referencia bancaria (para conciliación / idempotencia)
}

/** Recuento de una denominación (billete o moneda) en el arqueo. */
export interface Denominacion {
  valor: number // en euros: 500,200,…,0.01
  cantidad: number
}

/** Arqueo de caja: saldo contado vs. teórico con explicación si descuadra. */
export interface ArqueoCaja extends Trazable {
  cuentaId: ID
  fecha: string
  denominaciones: Denominacion[]
  saldoTeorico: number
  saldoContado: number
  diferencia: number // contado − teórico
  explicacion?: string
  responsable?: string
}

// ─────────────────────────── Stock (Fase 4) ───────────────────────────

export type TipoAlmacen = 'CENTRAL' | 'TIENDA' | 'TRANSITO'

export interface Almacen extends Trazable {
  nombre: string
  tipo: TipoAlmacen
  puntoVentaId?: ID
}

export interface Articulo extends Trazable {
  referencia: string
  ean?: string
  descripcion: string
  familia?: string
  subfamilia?: string
  proveedorPrincipalId?: ID
  pvp: number
  stockMinimo: number
  stockOptimo: number
  ubicacion?: string
  impuestoEspecialId?: ID
  contenidoMl?: number
}

export type TipoMovStock =
  | 'COMPRA'
  | 'VENTA'
  | 'TRASPASO'
  | 'MERMA'
  | 'ROTURA'
  | 'AUTOCONSUMO'
  | 'REGULARIZACION'
  | 'APERTURA'

export interface MovimientoStock extends Trazable {
  articuloId: ID
  almacenId: ID
  fecha: string
  tipo: TipoMovStock
  cantidad: number // + entrada / − salida
  costeUnitario: number // relevante en entradas
  esAprovisionamientoApertura: boolean
  documentoOrigenId?: ID
  traspasoParejaId?: ID
  motivo?: string
}

// ─────────────────────────── Deudas y deudores (Fase 6) ───────────────────────────

export type TipoDeuda =
  | 'PRESTAMO'
  | 'POLIZA'
  | 'LEASING'
  | 'RENTING'
  | 'PROVEEDOR'
  | 'ACREEDOR'
  | 'SOCIOS'
  | 'GRUPO'
  | 'HACIENDA'
  | 'SEG_SOCIAL'
  | 'DIVIDENDO'

/** Deuda / acreedor. Todo se modela con cuadro (una deuda simple = 1 periodo). */
export interface Deuda extends Trazable {
  tipo: TipoDeuda
  acreedor: string
  terceroId?: ID
  importeOriginal: number
  tipoInteres: number // % anual
  comisiones?: number
  periodicidad: 'MENSUAL' | 'TRIMESTRAL' | 'ANUAL'
  nPeriodos: number
  sistema: 'FRANCES' | 'LINEAL'
  fechaInicio: string
  garantias?: string
  esVinculada: boolean
  notas?: string
}

export type EstadoDeudor = 'AL_CORRIENTE' | 'VENCIDO' | 'EN_RECLAMACION' | 'INCOBRABLE'
export type TipoDeudor =
  | 'CLIENTE_APLAZADO'
  | 'PRESTAMO_CONCEDIDO'
  | 'ANTICIPO_PROVEEDOR'
  | 'FIANZA'
  | 'GRUPO'
  | 'ANTICIPO_EMPLEADO'

export interface Reclamacion {
  id: ID
  fecha: string
  medio: 'EMAIL' | 'CARTA' | 'TELEFONO' | 'BUROFAX'
  nota?: string
}

/** Deudor vario (cobros pendientes, préstamos concedidos, anticipos, fianzas). */
export interface DeudorVario extends Trazable {
  tipo: TipoDeudor
  nombre: string
  terceroId?: ID
  importe: number
  fechaOrigen: string
  fechaVencimiento?: string
  estado: EstadoDeudor
  esVinculada: boolean
  reclamaciones: Reclamacion[]
  provisionManual?: number
}

// ─────────────────────────── Presupuesto (Fase 7) ───────────────────────────

export type TipoLineaPresupuesto = 'INGRESO' | 'COSTE_VENTAS' | 'GASTO' | 'INVERSION' | 'FINANCIACION'

export interface LineaPresupuesto {
  id: ID
  concepto: string
  tipo: TipoLineaPresupuesto
  centroCosteId?: ID
  meses: number[] // 12 valores (enero..diciembre)
}

export interface Presupuesto {
  id: ID
  ejercicio: number
  factorCrecimiento: number // % aplicado en la generación automática
  lineas: LineaPresupuesto[]
}

/** Registro de una importación (para poder deshacerla como bloque). */
export interface LoteImportacion {
  id: ID
  fecha: string
  destinoId: string
  nombreFichero: string
  ids: ID[]
}

/** Colección de datos operativos (persistida aparte de la configuración). */
export interface DatosOperativos {
  terceros: Tercero[]
  ventas: Venta[]
  compras: Compra[]
  recurrentes: GastoRecurrente[]
  cuentasTesoreria: CuentaTesoreria[]
  movimientos: MovimientoTesoreria[]
  arqueos: ArqueoCaja[]
  almacenes: Almacen[]
  articulos: Articulo[]
  movimientosStock: MovimientoStock[]
  importaciones: LoteImportacion[]
  deudas: Deuda[]
  deudores: DeudorVario[]
  presupuestos: Presupuesto[]
}

/** Plantilla de importación: mapeo de columnas guardado con nombre. */
export interface PlantillaImportacion {
  id: ID
  nombre: string
  destinoId: string
  mapeo: Record<string, number>
}

export interface Configuracion {
  empresa: DatosEmpresa
  centrosCoste: CentroCoste[]
  planContable: CuentaPGC[]
  tiposIva: TipoIva[]
  impuestosEspeciales: ImpuestoEspecial[]
  obligacionesFiscales: ObligacionFiscal[]
  categoriasGasto: CategoriaGasto[]
  umbrales: Umbrales
  apariencia: Apariencia
  plantillasImportacion: PlantillaImportacion[]
}
