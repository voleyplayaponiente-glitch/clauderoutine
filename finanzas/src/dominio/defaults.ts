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
  CentroCoste,
  Tarjeta,
  Datafono,
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

/**
 * Puntos de venta del grupo. Se precargan para no tener que teclearlos, pero
 * son **datos de configuración editables**: se les cambia el nombre, el tipo o
 * el código, y se pueden cerrar (`activoHasta`) o añadir otros nuevos.
 * Los tres «GV/Alfafar» son stands en centro comercial; San Juan es tienda y
 * VAPESPACE.ES es la venta online.
 */
// Los ids son FIJOS a propósito: una compra o una venta guardan el id del
// centro, así que no pueden cambiar entre recargas.
const SELLO = { creadoEn: '2025-01-01T00:00:00.000Z', creadoPor: 'sistema', origen: 'MANUAL' } as const

export const CENTROS_COSTE_DEFECTO: CentroCoste[] = [
  { ...SELLO, id: 'cc-gv-alicante', codigo: 'GVA', nombre: 'VAPESSENCE GV ALICANTE', tipo: 'PUNTO_VENTA', tipoPuntoVenta: 'STAND', activoDesde: '2025-01-01' },
  { ...SELLO, id: 'cc-san-juan', codigo: 'SJU', nombre: 'VAPESPACE SAN JUAN', tipo: 'PUNTO_VENTA', tipoPuntoVenta: 'TIENDA', activoDesde: '2025-01-01' },
  { ...SELLO, id: 'cc-alfafar', codigo: 'ALF', nombre: 'VAPESSENCE ALFAFAR', tipo: 'PUNTO_VENTA', tipoPuntoVenta: 'STAND', activoDesde: '2025-01-01' },
  { ...SELLO, id: 'cc-gv-hortaleza', codigo: 'GVH', nombre: 'VAPESSENCE GV HORTALEZA', tipo: 'PUNTO_VENTA', tipoPuntoVenta: 'STAND', activoDesde: '2025-01-01' },
  { ...SELLO, id: 'cc-vapespace-es', codigo: 'WEB', nombre: 'VAPESPACE.ES', tipo: 'PUNTO_VENTA', tipoPuntoVenta: 'WEB', activoDesde: '2025-01-01' },
]

/**
 * Tarjetas de empresa. «Pagado con tarjeta» a secas no permite cuadrar el gasto
 * con el extracto del banco que la emite: hay que decir cuál. Editables (nombre,
 * banco, últimos 4 dígitos) y ampliables en Configuración.
 */
export const TARJETAS_DEFECTO: Tarjeta[] = [
  { id: 'tar-bankinter', nombre: 'Tarjeta Bankinter', banco: 'Bankinter', activa: true },
  { id: 'tar-bbva', nombre: 'Tarjeta BBVA', banco: 'BBVA', activa: true },
  { id: 'tar-sabadell', nombre: 'Tarjeta Sabadell', banco: 'Banco Sabadell', activa: true },
  { id: 'tar-caixabank', nombre: 'Tarjeta CaixaBank', banco: 'CaixaBank', activa: true },
]

/**
 * Datáfonos: uno por tienda, marcado como **principal** (es el que se aplica
 * solo a los cobros con tarjeta). Con el banco que liquida. Es una precarga
 * razonable para empezar; lo normal es ajustar en Configuración qué terminal
 * hay realmente en cada sitio, y moverlos de tienda cuando cambian.
 * Los stands y la web no llevan datáfono propio por defecto.
 */
export const DATAFONOS_DEFECTO: Datafono[] = [
  { id: 'dat-gv-alicante', nombre: 'Datáfono GV Alicante', banco: 'CaixaBank', centroCosteId: 'cc-gv-alicante', principal: true, activo: true },
  { id: 'dat-san-juan', nombre: 'Datáfono San Juan', banco: 'CaixaBank', centroCosteId: 'cc-san-juan', principal: true, activo: true },
  { id: 'dat-alfafar', nombre: 'Datáfono Alfafar', banco: 'CaixaBank', centroCosteId: 'cc-alfafar', principal: true, activo: true },
  { id: 'dat-gv-hortaleza', nombre: 'Datáfono GV Hortaleza', banco: 'CaixaBank', centroCosteId: 'cc-gv-hortaleza', principal: true, activo: true },
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
  // Las nóminas SÍ son gasto: es el coste del personal. Con el pago por banco
  // como único registro (aquí no hay módulo de nóminas), si no contara como
  // gasto la partida más grande del negocio no aparecería en el presupuesto.
  { id: 'cat-bco-nominas', nombre: 'Nóminas', cuentaPGC: '640', deduciblePorDefecto: true, ambito: 'BANCO', efectoPresupuesto: 'GASTO', orden: 31 },
  // GASTO y no financiación: sin módulo de personal, el pago a la TGSS es el
  // único registro que queda de la cuota patronal, que es coste real (642).
  { id: 'cat-bco-seg-social', nombre: 'Seguridad Social', cuentaPGC: '642', deduciblePorDefecto: true, ambito: 'BANCO', efectoPresupuesto: 'GASTO', orden: 32 },
  // Inversión: el dinero no se consume, se cambia por un activo. No es gasto y
  // no resta del resultado; en el presupuesto va como INVERSIÓN.
  // Ojo: clasificar el cargo aquí NO da de alta la inversión — eso se hace en
  // la pantalla de Inversiones, que es la que lleva coste, valor y asientos.
  { id: 'cat-bco-inv-grupo', nombre: 'Inversiones en empresas del grupo', cuentaPGC: '2403', deduciblePorDefecto: false, ambito: 'BANCO', efectoPresupuesto: 'INVERSION', orden: 33 },
  { id: 'cat-bco-inv-financiera', nombre: 'Inversiones financieras', cuentaPGC: '250', deduciblePorDefecto: false, ambito: 'BANCO', efectoPresupuesto: 'INVERSION', orden: 34 },
  // Prestar a un socio NO es gasto ni retribución: nace un derecho de cobro.
  // Ojo, es lo contrario de «Préstamos de socios», que es deuda de la empresa.
  { id: 'cat-bco-prestamo-socios', nombre: 'Préstamos a socios (dinero que se presta)', cuentaPGC: '253', deduciblePorDefecto: false, ambito: 'BANCO', efectoPresupuesto: 'INVERSION', orden: 35 },
  // La cuota del préstamo ya entra en el presupuesto por el cuadro de deuda:
  // si además se contase aquí, se presupuestaría dos veces.
  { id: 'cat-bco-cuota-prestamo', nombre: 'Cuota de préstamo (ya en Deudas)', cuentaPGC: '520', deduciblePorDefecto: true, ambito: 'BANCO', efectoPresupuesto: 'NINGUNO', orden: 36 },
  { id: 'cat-bco-traspaso', nombre: 'Traspaso entre cuentas propias', cuentaPGC: '572', deduciblePorDefecto: false, ambito: 'BANCO', efectoPresupuesto: 'NINGUNO', orden: 37 },
  { id: 'cat-bco-otros', nombre: 'Otros gastos sin factura', cuentaPGC: '629', deduciblePorDefecto: true, ambito: 'BANCO', efectoPresupuesto: 'GASTO', orden: 38 },

  // ── Abonos del banco (ámbito BANCO, flujo ENTRADA) ──
  // Un extracto también tiene entradas y no todas son ingreso: una ampliación
  // de capital o la devolución de un préstamo concedido engordan la cuenta sin
  // ser beneficio. Cada concepto dice qué es en realidad.
  { id: 'cat-bco-in-clientes', nombre: 'Cobros de clientes (ya en Ventas)', cuentaPGC: '430', deduciblePorDefecto: false, ambito: 'BANCO', flujo: 'ENTRADA', efectoPresupuesto: 'NINGUNO', orden: 51 },
  { id: 'cat-bco-in-dividendos', nombre: 'Dividendos recibidos', cuentaPGC: '760', deduciblePorDefecto: false, ambito: 'BANCO', flujo: 'ENTRADA', efectoPresupuesto: 'INGRESO', orden: 52 },
  { id: 'cat-bco-in-retrocesion', nombre: 'Retrocesión de comisiones bancarias', cuentaPGC: '769', deduciblePorDefecto: false, ambito: 'BANCO', flujo: 'ENTRADA', efectoPresupuesto: 'INGRESO', orden: 53 },
  { id: 'cat-bco-in-intereses', nombre: 'Intereses a favor', cuentaPGC: '769', deduciblePorDefecto: false, ambito: 'BANCO', flujo: 'ENTRADA', efectoPresupuesto: 'INGRESO', orden: 54 },
  { id: 'cat-bco-in-subvencion', nombre: 'Subvenciones y ayudas', cuentaPGC: '740', deduciblePorDefecto: false, ambito: 'BANCO', flujo: 'ENTRADA', efectoPresupuesto: 'INGRESO', orden: 55 },
  // Devolver un préstamo concedido es recuperar un activo: desinversión.
  { id: 'cat-bco-in-devol-prestamo', nombre: 'Devolución de préstamos concedidos', cuentaPGC: '253', deduciblePorDefecto: false, ambito: 'BANCO', flujo: 'ENTRADA', efectoPresupuesto: 'INVERSION', orden: 56 },
  { id: 'cat-bco-in-venta-inversion', nombre: 'Venta de inversiones', cuentaPGC: '250', deduciblePorDefecto: false, ambito: 'BANCO', flujo: 'ENTRADA', efectoPresupuesto: 'INVERSION', orden: 57 },
  // Capital y financiación: entra dinero, pero no es beneficio de nadie.
  { id: 'cat-bco-in-capital', nombre: 'Aportación de capital de socios', cuentaPGC: '118', deduciblePorDefecto: false, ambito: 'BANCO', flujo: 'ENTRADA', efectoPresupuesto: 'FINANCIACION', orden: 58 },
  { id: 'cat-bco-in-prestamo', nombre: 'Préstamo o póliza recibida', cuentaPGC: '170', deduciblePorDefecto: false, ambito: 'BANCO', flujo: 'ENTRADA', efectoPresupuesto: 'FINANCIACION', orden: 59 },
  { id: 'cat-bco-in-devol-hacienda', nombre: 'Devolución de Hacienda', cuentaPGC: '4709', deduciblePorDefecto: false, ambito: 'BANCO', flujo: 'ENTRADA', efectoPresupuesto: 'FINANCIACION', orden: 60 },
  { id: 'cat-bco-in-traspaso', nombre: 'Traspaso entre cuentas propias', cuentaPGC: '572', deduciblePorDefecto: false, ambito: 'BANCO', flujo: 'ENTRADA', efectoPresupuesto: 'NINGUNO', orden: 61 },
  { id: 'cat-bco-in-otros', nombre: 'Otros ingresos sin factura', cuentaPGC: '759', deduciblePorDefecto: false, ambito: 'BANCO', flujo: 'ENTRADA', efectoPresupuesto: 'INGRESO', orden: 62 },
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
    centrosCoste: [...CENTROS_COSTE_DEFECTO],
    tarjetas: [...TARJETAS_DEFECTO],
    datafonos: [...DATAFONOS_DEFECTO],
    planContable: [...PLAN_CONTABLE_DEFECTO],
    tiposIva: [...TIPOS_IVA_DEFECTO],
    impuestosEspeciales: [...IMPUESTOS_ESPECIALES_DEFECTO],
    obligacionesFiscales: [...OBLIGACIONES_FISCALES_DEFECTO],
    categoriasGasto: [...CATEGORIAS_GASTO_DEFECTO],
    umbrales: { ...UMBRALES_DEFECTO },
    apariencia: { densidad: 'comoda', formatoFecha: 'dd/mm/aaaa', moneda: 'EUR' },
    plantillasImportacion: [],
    conectores: [],
    servidorCopias: { activo: false, automatico: true },
  }
}
