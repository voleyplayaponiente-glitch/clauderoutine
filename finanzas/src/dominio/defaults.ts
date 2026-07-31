/**
 * Valores por defecto de CONFIGURACIÓN (no datos de negocio). La app arranca
 * vacía de operaciones; esto solo precarga el plan contable, los tipos de IVA,
 * el calendario fiscal y unos umbrales, todo EDITABLE en Configuración.
 *
 * Los importes fiscales llevan fecha de vigencia y se han verificado en fuente
 * oficial (ver comentarios); ninguno está hardcodeado en la lógica de cálculo.
 */
import type {
  Configuracion,
  CuentaPGC,
  TipoIva,
  ImpuestoEspecial,
  ObligacionFiscal,
  CategoriaGasto,
  Umbrales,
} from './tipos'

/** Plan contable mínimo por defecto (PGC), ampliable por el usuario. */
export const PLAN_CONTABLE_DEFECTO: CuentaPGC[] = [
  { codigo: '700', nombre: 'Ventas de mercaderías', grupo: 7, naturaleza: 'INGRESO' },
  { codigo: '705', nombre: 'Prestación de servicios', grupo: 7, naturaleza: 'INGRESO' },
  { codigo: '600', nombre: 'Compras de mercaderías', grupo: 6, naturaleza: 'GASTO' },
  { codigo: '602', nombre: 'Compras de otros aprovisionamientos', grupo: 6, naturaleza: 'GASTO' },
  { codigo: '621', nombre: 'Arrendamientos y cánones', grupo: 6, naturaleza: 'GASTO' },
  { codigo: '622', nombre: 'Reparaciones y conservación', grupo: 6, naturaleza: 'GASTO' },
  { codigo: '623', nombre: 'Servicios de profesionales independientes', grupo: 6, naturaleza: 'GASTO' },
  { codigo: '624', nombre: 'Transportes', grupo: 6, naturaleza: 'GASTO' },
  { codigo: '625', nombre: 'Primas de seguros', grupo: 6, naturaleza: 'GASTO' },
  { codigo: '627', nombre: 'Publicidad, propaganda y relaciones públicas', grupo: 6, naturaleza: 'GASTO' },
  { codigo: '628', nombre: 'Suministros', grupo: 6, naturaleza: 'GASTO' },
  { codigo: '629', nombre: 'Otros servicios', grupo: 6, naturaleza: 'GASTO' },
  { codigo: '640', nombre: 'Sueldos y salarios', grupo: 6, naturaleza: 'GASTO' },
  { codigo: '642', nombre: 'Seguridad Social a cargo de la empresa', grupo: 6, naturaleza: 'GASTO' },
  { codigo: '570', nombre: 'Caja, euros', grupo: 5, naturaleza: 'ACTIVO' },
  { codigo: '572', nombre: 'Bancos e instituciones de crédito c/c vista, euros', grupo: 5, naturaleza: 'ACTIVO' },
  { codigo: '430', nombre: 'Clientes', grupo: 4, naturaleza: 'ACTIVO' },
  { codigo: '400', nombre: 'Proveedores', grupo: 4, naturaleza: 'PASIVO' },
  { codigo: '410', nombre: 'Acreedores por prestaciones de servicios', grupo: 4, naturaleza: 'PASIVO' },
  { codigo: '472', nombre: 'HP, IVA soportado', grupo: 4, naturaleza: 'ACTIVO' },
  { codigo: '477', nombre: 'HP, IVA repercutido', grupo: 4, naturaleza: 'PASIVO' },
  { codigo: '4750', nombre: 'HP, acreedora por IVA', grupo: 4, naturaleza: 'PASIVO' },
  { codigo: '551', nombre: 'Cuenta corriente con socios y administradores', grupo: 5, naturaleza: 'PASIVO' },
  { codigo: '526', nombre: 'Deudas a corto plazo con entidades de crédito', grupo: 5, naturaleza: 'PASIVO' },
  { codigo: '170', nombre: 'Deudas a largo plazo con entidades de crédito', grupo: 1, naturaleza: 'PASIVO' },
  { codigo: '610', nombre: 'Variación de existencias de mercaderías', grupo: 6, naturaleza: 'GASTO' },
  { codigo: '710', nombre: 'Variación de existencias de productos terminados', grupo: 7, naturaleza: 'INGRESO' },
  { codigo: '129', nombre: 'Resultado del ejercicio', grupo: 1, naturaleza: 'PN' },
]

export const TIPOS_IVA_DEFECTO: TipoIva[] = [
  { id: 'iva-21', nombre: 'General 21 %', tipo: 21, regimen: 'GENERAL', vigenteDesde: '2012-09-01', porDefecto: true },
  { id: 'iva-10', nombre: 'Reducido 10 %', tipo: 10, regimen: 'GENERAL', vigenteDesde: '2012-09-01' },
  { id: 'iva-4', nombre: 'Superreducido 4 %', tipo: 4, regimen: 'GENERAL', vigenteDesde: '1995-01-01' },
  { id: 'iva-0', nombre: 'Tipo 0 %', tipo: 0, regimen: 'GENERAL', vigenteDesde: '1995-01-01' },
  { id: 'iva-exento', nombre: 'Exento', tipo: 0, regimen: 'EXENTO', vigenteDesde: '1995-01-01' },
  { id: 'iva-ns', nombre: 'No sujeto', tipo: 0, regimen: 'NO_SUJETO', vigenteDesde: '1995-01-01' },
  { id: 'iva-isp', nombre: 'Inversión del sujeto pasivo', tipo: 21, regimen: 'ISP', vigenteDesde: '2012-10-31' },
]

/**
 * Impuesto especial sobre líquidos para cigarrillos electrónicos (modelo 573),
 * en vigor desde el 01/04/2025. Fuente: AEAT / Ley 7/2024. EDITABLE.
 *  · Sin nicotina o ≤ 15 mg/ml: 0,15 €/ml
 *  · > 15 mg/ml de nicotina:    0,20 €/ml
 */
export const IMPUESTOS_ESPECIALES_DEFECTO: ImpuestoEspecial[] = [
  {
    id: 'iiee-vapeo-baja',
    nombre: 'Líquidos vapeo · sin nicotina o ≤ 15 mg/ml',
    base: 'POR_ML',
    importePorUnidad: 0.15,
    familiasAplicables: [],
    vigenteDesde: '2025-04-01',
  },
  {
    id: 'iiee-vapeo-alta',
    nombre: 'Líquidos vapeo · > 15 mg/ml de nicotina',
    base: 'POR_ML',
    importePorUnidad: 0.2,
    familiasAplicables: [],
    vigenteDesde: '2025-04-01',
  },
]

export const OBLIGACIONES_FISCALES_DEFECTO: ObligacionFiscal[] = [
  { id: 'm303', modelo: '303', periodicidad: 'TRIMESTRAL', descripcion: 'Autoliquidación de IVA' },
  { id: 'm111', modelo: '111', periodicidad: 'TRIMESTRAL', descripcion: 'Retenciones IRPF trabajo/profesionales' },
  { id: 'm115', modelo: '115', periodicidad: 'TRIMESTRAL', descripcion: 'Retenciones por arrendamientos' },
  { id: 'm200', modelo: '200', periodicidad: 'ANUAL', descripcion: 'Impuesto sobre Sociedades' },
  { id: 'm202', modelo: '202', periodicidad: 'TRIMESTRAL', descripcion: 'Pago fraccionado Sociedades' },
  { id: 'm347', modelo: '347', periodicidad: 'ANUAL', descripcion: 'Operaciones con terceros' },
  { id: 'm573', modelo: '573', periodicidad: 'TRIMESTRAL', descripcion: 'Impuesto sobre líquidos para cigarrillos electrónicos' },
]

export const CATEGORIAS_GASTO_DEFECTO: CategoriaGasto[] = [
  { id: 'cat-alquiler', nombre: 'Alquileres', cuentaPGC: '621', deduciblePorDefecto: true },
  { id: 'cat-suministros', nombre: 'Suministros (luz, agua, internet)', cuentaPGC: '628', deduciblePorDefecto: true },
  { id: 'cat-transporte', nombre: 'Transportes', cuentaPGC: '624', deduciblePorDefecto: true },
  { id: 'cat-seguros', nombre: 'Seguros', cuentaPGC: '625', deduciblePorDefecto: true },
  { id: 'cat-asesoria', nombre: 'Asesoría y profesionales', cuentaPGC: '623', deduciblePorDefecto: true },
  { id: 'cat-publicidad', nombre: 'Publicidad', cuentaPGC: '627', deduciblePorDefecto: true },
  { id: 'cat-mantenimiento', nombre: 'Mantenimiento y reparaciones', cuentaPGC: '622', deduciblePorDefecto: true },
  { id: 'cat-otros', nombre: 'Otros servicios', cuentaPGC: '629', deduciblePorDefecto: true },
]

/**
 * Umbrales por defecto. `limitePagoEfectivo` = 1.000 € entre empresarios
 * (Ley 11/2021, art. 18, vigente desde 12/07/2021). EDITABLE.
 */
export const UMBRALES_DEFECTO: Umbrales = {
  saldoMinimoSeguridad: 3000,
  descuadreCajaTolerado: 5,
  diasStockMuerto: 90,
  limitePagoEfectivo: 1000,
  diasRetrasoReclamar: 30,
  mesesNegativoAlertaPunto: 3,
}

/** Configuración inicial: SIN datos de negocio, solo defaults editables. */
export function configuracionInicial(): Configuracion {
  return {
    empresa: {
      razonSocial: '',
      cif: '',
      domicilioFiscal: '',
      ejercicioActual: 2026,
      esFilial: false,
    },
    centrosCoste: [],
    planContable: [...PLAN_CONTABLE_DEFECTO],
    tiposIva: [...TIPOS_IVA_DEFECTO],
    impuestosEspeciales: [...IMPUESTOS_ESPECIALES_DEFECTO],
    obligacionesFiscales: [...OBLIGACIONES_FISCALES_DEFECTO],
    categoriasGasto: [...CATEGORIAS_GASTO_DEFECTO],
    umbrales: { ...UMBRALES_DEFECTO },
    apariencia: { densidad: 'comoda', formatoFecha: 'dd/mm/aaaa', moneda: 'EUR' },
    plantillasImportacion: [],
    conectores: [],
  }
}
