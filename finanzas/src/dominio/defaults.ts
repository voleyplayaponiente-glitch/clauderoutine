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
  // Compras de mercadería. El stock internacional puede traer impuesto especial.
  { id: 'cat-stock-nac', nombre: 'Stock nacional', cuentaPGC: '600', deduciblePorDefecto: true, esStock: true, orden: 1, ambito: 'COMPRAS' },
  { id: 'cat-stock-int', nombre: 'Stock internacional', cuentaPGC: '600', deduciblePorDefecto: true, esStock: true, esInternacional: true, orden: 2, ambito: 'COMPRAS' },
  // Estructura.
  { id: 'cat-alquiler', nombre: 'Alquileres', cuentaPGC: '621', deduciblePorDefecto: true, orden: 3, ambito: 'COMPRAS' },
  { id: 'cat-gastos-ventas', nombre: 'Gastos de ventas', cuentaPGC: '624', deduciblePorDefecto: true, orden: 4, ambito: 'COMPRAS' },
  { id: 'cat-gasolina', nombre: 'Gasolina deducible', cuentaPGC: '628', deduciblePorDefecto: true, orden: 5, ambito: 'COMPRAS' },
  { id: 'cat-gasolina-nd', nombre: 'Gasolina NO deducible', cuentaPGC: '628', deduciblePorDefecto: false, orden: 6, ambito: 'COMPRAS' },
  { id: 'cat-oficina', nombre: 'Gastos de oficina', cuentaPGC: '629', deduciblePorDefecto: true, orden: 7, ambito: 'COMPRAS' },
  { id: 'cat-alarma', nombre: 'Alarma', cuentaPGC: '629', deduciblePorDefecto: true, orden: 8, ambito: 'COMPRAS' },
  { id: 'cat-telefono', nombre: 'Teléfono', cuentaPGC: '629', deduciblePorDefecto: true, orden: 9, ambito: 'COMPRAS' },
  { id: 'cat-wifi', nombre: 'Wifi', cuentaPGC: '629', deduciblePorDefecto: true, orden: 10, ambito: 'COMPRAS' },
  { id: 'cat-luz', nombre: 'Luz', cuentaPGC: '628', deduciblePorDefecto: true, orden: 11, ambito: 'COMPRAS' },
  { id: 'cat-mantenimiento', nombre: 'Mantenimiento', cuentaPGC: '622', deduciblePorDefecto: true, orden: 12, ambito: 'COMPRAS' },
  { id: 'cat-mantenimiento-nd', nombre: 'Mantenimiento NO deducible', cuentaPGC: '622', deduciblePorDefecto: false, orden: 13, ambito: 'COMPRAS' },
  { id: 'cat-marketing', nombre: 'Marketing y publicidad', cuentaPGC: '627', deduciblePorDefecto: true, orden: 14, ambito: 'COMPRAS' },
  { id: 'cat-gestoria', nombre: 'Gestoría', cuentaPGC: '623', deduciblePorDefecto: true, orden: 15, ambito: 'COMPRAS' },
  { id: 'cat-renting', nombre: 'Renting de vehículos', cuentaPGC: '621', deduciblePorDefecto: true, orden: 16, ambito: 'COMPRAS' },
  { id: 'cat-ia', nombre: 'Gastos de IA', cuentaPGC: '629', deduciblePorDefecto: true, orden: 17, ambito: 'COMPRAS' },
  { id: 'cat-tpv', nombre: 'Gastos de TPV', cuentaPGC: '626', deduciblePorDefecto: true, orden: 18, ambito: 'COMPRAS' },
  { id: 'cat-varios-tiendas', nombre: 'Gastos varios de tiendas', cuentaPGC: '629', deduciblePorDefecto: true, orden: 19, ambito: 'COMPRAS' },
  { id: 'cat-generales', nombre: 'Gastos generales', cuentaPGC: '629', deduciblePorDefecto: true, orden: 20, ambito: 'COMPRAS' },
  // ── Conceptos del banco (ámbito BANCO) ──
  // Aquí NO se repite la naturaleza del gasto de las facturas: lo que se paga
  // con factura ya está contado en Compras. Esta lista es para lo que nace en
  // la cuenta y normalmente no lleva factura.
  //
  // «Facturas de proveedores» existe para poder clasificar el cargo y que
  // cuadre el extracto, pero NO se presupuesta: el gasto está en la factura.
  { id: 'cat-bco-facturas', nombre: 'Facturas de proveedores (ya en Compras)', cuentaPGC: '400', deduciblePorDefecto: true, ambito: 'BANCO', efectoPresupuesto: 'NINGUNO', orden: 21 },
  { id: 'cat-bco-comision-tpv', nombre: 'Comisiones de TPV', cuentaPGC: '626', deduciblePorDefecto: true, esBancaria: true, ambito: 'BANCO', efectoPresupuesto: 'GASTO', orden: 22 },
  { id: 'cat-banco-comision', nombre: 'Comisiones bancarias', cuentaPGC: '626', deduciblePorDefecto: true, esBancaria: true, ambito: 'BANCO', efectoPresupuesto: 'GASTO', orden: 23 },
  { id: 'cat-banco-mantenimiento', nombre: 'Gastos de mantenimiento', cuentaPGC: '626', deduciblePorDefecto: true, esBancaria: true, ambito: 'BANCO', efectoPresupuesto: 'GASTO', orden: 24 },
  { id: 'cat-banco-intereses', nombre: 'Intereses y gastos financieros', cuentaPGC: '662', deduciblePorDefecto: true, esBancaria: true, ambito: 'BANCO', efectoPresupuesto: 'GASTO', orden: 25 },
  // Seguros: se domicilian y no llevan factura de compra.
  { id: 'cat-banco-seguro', nombre: 'Seguro de responsabilidad civil', cuentaPGC: '625', deduciblePorDefecto: true, ambito: 'BANCO', efectoPresupuesto: 'GASTO', orden: 26 },
  { id: 'cat-bco-seguro-vida', nombre: 'Seguro de vida', cuentaPGC: '625', deduciblePorDefecto: true, ambito: 'BANCO', efectoPresupuesto: 'GASTO', orden: 27 },
  { id: 'cat-bco-seguro-salud', nombre: 'Seguro de salud', cuentaPGC: '625', deduciblePorDefecto: true, ambito: 'BANCO', efectoPresupuesto: 'GASTO', orden: 28 },
  // Tributos: pagar el trimestre o la cuota de un aplazamiento salda una deuda
  // ya devengada; sale dinero, pero no es gasto de P&G. Va como financiación.
  { id: 'cat-bco-tributos-trimestre', nombre: 'Tributos: trimestre corriente (303, 111, 115…)', cuentaPGC: '475', deduciblePorDefecto: true, ambito: 'BANCO', efectoPresupuesto: 'FINANCIACION', orden: 29 },
  { id: 'cat-bco-tributos-aplazamiento', nombre: 'Tributos: cuota de aplazamiento', cuentaPGC: '475', deduciblePorDefecto: true, ambito: 'BANCO', efectoPresupuesto: 'FINANCIACION', orden: 30 },
  { id: 'cat-bco-seg-social', nombre: 'Seguridad Social', cuentaPGC: '476', deduciblePorDefecto: true, ambito: 'BANCO', efectoPresupuesto: 'FINANCIACION', orden: 31 },
  // La cuota del préstamo ya entra en el presupuesto por el cuadro de deuda:
  // si además se contase aquí, se presupuestaría dos veces.
  { id: 'cat-bco-cuota-prestamo', nombre: 'Cuota de préstamo (ya en Deudas)', cuentaPGC: '520', deduciblePorDefecto: true, ambito: 'BANCO', efectoPresupuesto: 'NINGUNO', orden: 32 },
  { id: 'cat-bco-traspaso', nombre: 'Traspaso entre cuentas propias', cuentaPGC: '572', deduciblePorDefecto: false, ambito: 'BANCO', efectoPresupuesto: 'NINGUNO', orden: 33 },
  { id: 'cat-bco-otros', nombre: 'Otros gastos sin factura', cuentaPGC: '629', deduciblePorDefecto: true, ambito: 'BANCO', efectoPresupuesto: 'GASTO', orden: 34 },
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
