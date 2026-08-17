/**
 * Tipos del dominio. Contratos compartidos por toda la app.
 * El modelo completo se irá ampliando fase a fase; aquí están los cimientos
 * (configuración de empresa, centros de coste, plan contable, impuestos)
 * que la Fase 1 rellena y el resto de módulos consumen.
 */

import type { Inversion, OperacionInversion, ValoracionInversion } from './inversiones'

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

/**
 * Tarjeta de empresa. Pagar «con tarjeta» sin decir cuál deja el gasto sin
 * poder cuadrar con el extracto del banco que la emite.
 */
export interface Tarjeta {
  id: ID
  nombre: string
  banco: string
  /** Últimos 4 dígitos, para reconocerla en el extracto. Opcional. */
  ultimos4?: string
  /** Cuenta de tesorería a la que se carga, si está dada de alta. */
  cuentaTesoreriaId?: ID
  activa: boolean
}

/**
 * Datáfono (TPV físico) de una tienda. Cada uno liquida en el banco que lo
 * emite, así que sin saber cuál cobró no se puede cuadrar la liquidación.
 * Un datáfono se puede mover de tienda: por eso `centroCosteId` es del datáfono
 * y no al revés.
 */
export interface Datafono {
  id: ID
  nombre: string
  banco: string
  /** Tienda donde está instalado ahora mismo. Vacío = sin asignar. */
  centroCosteId?: ID
  /**
   * El principal de esa tienda: es el que se aplica solo a los cobros con
   * tarjeta. Con varios datáfonos en la misma tienda, manda este.
   */
  principal?: boolean
  /** Cuenta de tesorería donde liquida, si está dada de alta. */
  cuentaTesoreriaId?: ID
  numeroTerminal?: string
  activo: boolean
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
  /** Compra de mercadería (va a existencias), no un gasto de estructura. */
  esStock?: boolean
  /** Adquisición intracomunitaria o importación: puede llevar impuesto especial. */
  esInternacional?: boolean
  /** Categoría de gasto bancario (comisiones, seguros del banco…). */
  esBancaria?: boolean
  /**
   * Dónde se usa. COMPRAS: naturaleza del gasto de una factura. BANCO: concepto
   * de un movimiento de la cuenta, normalmente sin factura. Si falta, se deduce
   * de `esBancaria` (datos guardados con la versión anterior).
   */
  ambito?: 'COMPRAS' | 'BANCO'
  /**
   * Solo en el ámbito BANCO: si el concepto es para cargos (SALIDA) o para
   * abonos (ENTRADA). Un extracto tiene las dos cosas y no se clasifican con la
   * misma lista. Si falta, es SALIDA.
   */
  flujo?: 'SALIDA' | 'ENTRADA'
  /**
   * Qué hace en el presupuesto:
   *  · INGRESO — entra dinero y además es ingreso (dividendos, retrocesiones).
   *  · GASTO — gasto de explotación (comisiones, seguros, mantenimiento).
   *  · INVERSION — el dinero no se consume, se cambia por un activo
   *    (participaciones en empresas del grupo, fondos, acciones).
   *  · FINANCIACION — sale dinero pero no es gasto de P&G (impuestos del
   *    trimestre, aplazamientos: se salda una deuda ya devengada).
   *  · NINGUNO — no se presupuesta desde aquí porque ya viene por otro sitio
   *    (facturas de proveedores → Compras; cuotas de préstamo → cuadro de deuda)
   *    o porque no es un gasto (traspasos entre cuentas propias).
   * Si falta, se trata como GASTO.
   */
  efectoPresupuesto?: 'INGRESO' | 'GASTO' | 'INVERSION' | 'FINANCIACION' | 'NINGUNO'
  orden?: number
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

/**
 * Un cobro del día. Si es con tarjeta, `datafonoId` dice por qué terminal
 * entró: es lo que permite cuadrar después con la liquidación del banco.
 */
export interface CobroVenta {
  forma: FormaCobro
  importe: number
  datafonoId?: ID
}

/** Registro diario de ventas: único por punto de venta y fecha. */
export interface Venta extends Trazable {
  centroCosteId: ID
  fecha: string // yyyy-mm-dd
  lineasIva: LineaIva[]
  cobros: CobroVenta[]
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
  /** Impuesto especial soportado (vapeo) en compras internacionales. */
  impuestoEspecial?: number
  deducible: boolean
  motivoNoDeducible?: string
  /** Con qué tarjeta se pagó. Solo tiene sentido si `formaPago === 'TARJETA'`. */
  tarjetaId?: ID
  /**
   * Cuenta de tesorería desde la que se pagó (transferencia o domiciliación).
   * Al marcar la factura como PAGADA hay que decirlo: si no, no se sabe de qué
   * banco ha salido el dinero y no se puede cuadrar con el extracto.
   */
  cuentaPagoId?: ID
  fechaPago?: string
  adjuntoNombre?: string
  /**
   * Clave del fichero guardado (la factura en PDF). El contenido NO vive aquí:
   * se guarda aparte en IndexedDB para no engordar el objeto de datos.
   */
  adjuntoId?: ID
  adjuntoTipo?: string
  adjuntoTamano?: number
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
  /**
   * Calendario leído de un documento, cuando los plazos NO salen de una fórmula.
   * Un aplazamiento de Hacienda trae sus vencimientos escritos uno a uno y no
   * tienen por qué ser iguales; si está, manda sobre el cuadro calculado.
   */
  cuadroFijo?: PlazoDeuda[]
}

/** Un vencimiento concreto de un calendario leído de un documento. */
export interface PlazoDeuda {
  fecha: string
  cuota: number
  intereses?: number
  capital?: number
}

/**
 * Tarjeta de crédito: **deuda financiera a corto plazo**. Lo gastado se debe al
 * banco hasta la liquidación, y si se aplaza devenga intereses (de los más
 * caros que hay). No tiene cuadro: hay un límite y un saldo dispuesto.
 */
export interface TarjetaCredito extends Trazable {
  entidad: string
  /** Cómo se la llama en casa; y los 4 últimos dígitos para identificarla. */
  alias: string
  ultimos4?: string
  /** Enlaza con la tarjeta de `Configuracion.tarjetas` con la que se pagan compras. */
  tarjetaId?: ID
  limite: number
  /** Saldo dispuesto pendiente de liquidar. */
  dispuesto: number
  /**
   * FIN_DE_MES — se paga entero en la liquidación (no devenga intereses).
   * APLAZADO — se paga a plazos y devenga interés.
   */
  modalidad: 'FIN_DE_MES' | 'APLAZADO'
  /** % anual del aplazado. Solo tiene sentido con modalidad APLAZADO. */
  tipoInteres?: number
  /** Día del mes en que el banco pasa el cargo. */
  diaLiquidacion?: number
  cuentaCargoId?: ID
  /** % de consumo a partir del cual avisar. Por defecto 75. */
  umbralAviso?: number
  notas?: string
}

/**
 * Renting: **no es deuda**, es un arrendamiento operativo.
 * No lleva tipo de interés: se pacta una cuota lineal durante todo el contrato y
 * al final se devuelve el bien (no hay opción de compra ni capital pendiente).
 * La cuota es gasto deducible (621) y su IVA se soporta y se deduce.
 */
export interface Renting extends Trazable {
  arrendador: string
  numeroContrato?: string
  cuentaVinculada?: string
  cuentaPagoId?: ID
  /** Qué se alquila: «RENAULT Clio / 2023». */
  descripcion: string
  matricula?: string
  bastidor?: string
  /** Cuota SIN IVA. Lineal: la misma todos los periodos. */
  cuotaBase: number
  /** % de IVA de la cuota. Editable: no se da por supuesto el 21 %. */
  tipoIva: number
  periodicidad: 'MENSUAL' | 'TRIMESTRAL' | 'ANUAL'
  nCuotas: number
  fechaInicio: string
  fechaFin?: string
  /** Cuotas ya facturadas según el banco (para cotejar con lo que calcula la app). */
  cuotasFacturadas?: number
  fianza?: number
  kmContratados?: number
  centroCosteId?: ID
  notas?: string
}

/**
 * Póliza de crédito (cuenta de crédito): **no tiene cuadro de amortización**.
 * Se dispone y se devuelve libremente hasta un límite, se liquida intereses
 * periódicamente y se renueva al vencimiento. Hay dos precios: el del capital
 * dispuesto y la comisión de disponibilidad sobre lo NO dispuesto; y un tercero,
 * mucho más caro, si se excede el límite.
 */
export interface Poliza extends Trazable {
  entidad: string
  numeroContrato?: string
  cuentaRelacionada?: string
  cuentaTesoreriaId?: ID
  /** Capital concedido en la escritura. */
  limiteConcedido: number
  /** Límite vigente hoy (el banco lo puede reducir en la renovación). */
  limiteActual: number
  /**
   * De dónde sale lo dispuesto:
   *  · CUENTA — del **saldo negativo de la cuenta** asociada, que es como
   *    funciona una póliza instrumentada en cuenta corriente. Se recalcula solo.
   *  · MANUAL — se teclea (o se lee de la ficha del banco).
   */
  origenDispuesto?: 'CUENTA' | 'MANUAL'
  /** Saldo del capital dispuesto. Con origen CUENTA es un valor calculado. */
  dispuesto: number
  /** Saldo contable: es el que el banco usa para calcular el disponible. */
  saldoContable?: number
  /** % de consumo a partir del cual avisar. Por defecto 75. */
  umbralAviso?: number
  importeExcedido?: number
  /** % anual sobre el capital dispuesto. */
  tipoInteresDispuesto: number
  /** % anual sobre el capital NO dispuesto (comisión de disponibilidad). */
  comisionDisponibilidad: number
  /** % sobre el máximo excedido; se cobra si se pasa del límite. */
  comisionExcedido?: number
  periodicidadLiquidacion: 'MENSUAL' | 'TRIMESTRAL' | 'SEMESTRAL' | 'ANUAL'
  fechaConstitucion: string
  /** Fecha de cancelación prevista (vencimiento de la póliza). */
  fechaVencimiento?: string
  fechaUltimaLiquidacion?: string
  fechaProximaLiquidacion?: string
  /** Si se prevé renovarla, el dispuesto no se presupuesta como devolución. */
  seRenueva: boolean
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
  rentings: Renting[]
  polizas: Poliza[]
  tarjetasCredito: TarjetaCredito[]
  deudores: DeudorVario[]
  presupuestos: Presupuesto[]
  logsSync: LogSync[]
  inversiones: Inversion[]
  operacionesInversion: OperacionInversion[]
  valoracionesInversion: ValoracionInversion[]
}

// ─────────────────────────── Conectores (Fase 11) ───────────────────────────

export type TipoConector = 'SQUARE' | 'BANCO_PSD2' | 'STRIPE' | 'SHOPIFY' | 'WOOCOMMERCE' | 'DEMO'

/**
 * Modo de conexión:
 *  · DEMO        → datos simulados (para probar el flujo sin credenciales).
 *  · DISPOSITIVO → token guardado en este dispositivo (IndexedDB, nunca en el repo).
 *  · SERVIDOR    → vía un servidor propio (p. ej. Umbrel) que guarda las credenciales
 *                  cifradas y hace las llamadas; el navegador solo llama a tu servidor.
 */
export type ModoConexion = 'DEMO' | 'DISPOSITIVO' | 'SERVIDOR'

export interface Conector {
  id: ID
  tipo: TipoConector
  nombre: string
  modo: ModoConexion
  token?: string // modo DISPOSITIVO
  urlServidor?: string // modo SERVIDOR (p. ej. https://umbrel.local:3001)
  secretoServidor?: string // credencial compartida con tu servidor
  activo: boolean
  ultimaSync?: string
}

/**
 * Servidor propio donde guardar las copias de seguridad (p. ej. el Umbrel).
 * Es lo único que protege de que el navegador limpie los datos del sitio: la
 * copia automática diaria vive en el mismo IndexedDB que los datos.
 */
export interface ServidorCopias {
  url?: string
  /** Secreto compartido. Viaja en la cabecera Authorization, nunca en la URL. */
  secreto?: string
  activo: boolean
  /** Subir sola la copia al arrancar y tras cada cambio. */
  automatico: boolean
  ultimaCopia?: string
}

export interface LogSync {
  id: ID
  conectorId: ID
  fecha: string
  resultado: 'OK' | 'ERROR' | 'PREVISUALIZADO'
  mensaje: string
  registros: number
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
  tarjetas: Tarjeta[]
  datafonos: Datafono[]
  planContable: CuentaPGC[]
  tiposIva: TipoIva[]
  impuestosEspeciales: ImpuestoEspecial[]
  obligacionesFiscales: ObligacionFiscal[]
  categoriasGasto: CategoriaGasto[]
  umbrales: Umbrales
  apariencia: Apariencia
  plantillasImportacion: PlantillaImportacion[]
  conectores: Conector[]
  servidorCopias?: ServidorCopias
  /** Cifras del ejercicio anterior, leídas del Modelo 200 presentado. */
  ejercicioAnterior?: EjercicioAnterior
}

/**
 * El ejercicio anterior **según la declaración presentada**, no según lo que se
 * haya tecleado aquí. Es la foto de partida: sirve para comparar, para saber de
 * dónde se viene y —lo que más se olvida— para no perder de vista la base
 * imponible negativa pendiente de compensar, que es dinero.
 *
 * Se guarda tal y como venía en el modelo; **nada se recalcula**.
 */
export interface EjercicioAnterior {
  ejercicio: number
  /** De dónde salió: por ahora siempre 'MODELO_200'. */
  origen: 'MODELO_200'
  /** Cuándo se subió el documento. */
  importadoEn: string
  totalActivo?: number
  patrimonioNeto?: number
  capital?: number
  reservas?: number
  pasivoNoCorriente?: number
  pasivoCorriente?: number
  resultado?: number
  resultadoAntesImpuestos?: number
  ingresosFinancieros?: number
  gastosFinancieros?: number
  baseImponible?: number
  tipoGravamen?: number
  cuotaLiquida?: number
  /** Base imponible negativa que queda por compensar en ejercicios futuros. */
  binPendiente?: number
}
