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
}
