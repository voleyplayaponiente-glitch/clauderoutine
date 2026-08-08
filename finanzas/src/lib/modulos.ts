/**
 * Registro de los módulos de la aplicación (los 13 del documento) con su ruta,
 * icono y descripción para los estados vacíos. La navegación se genera de aquí.
 */
export interface Modulo {
  id: string
  ruta: string
  titulo: string
  grupo: 'Operativa' | 'Tesorería' | 'Planificación' | 'Dirección' | 'Sistema'
  icono: string // clave de icono (SVG en componentes/Icono)
  resumen: string
  fase: number
}

export const MODULOS: Modulo[] = [
  { id: 'dashboard', ruta: '/', titulo: 'Dashboard', grupo: 'Dirección', icono: 'panel', resumen: '¿Cómo va la empresa hoy? Tesorería, ventas, margen y alertas de un vistazo.', fase: 8 },
  { id: 'ventas', ruta: '/ventas', titulo: 'Ventas diarias', grupo: 'Operativa', icono: 'ventas', resumen: 'Registro diario de ingresos por punto de venta, canal y forma de cobro.', fase: 2 },
  { id: 'compras', ruta: '/compras', titulo: 'Compras', grupo: 'Operativa', icono: 'compras', resumen: 'Compras de mercadería y de servicios, con IVA, deducibilidad y vencimientos.', fase: 2 },
  { id: 'caja', ruta: '/caja', titulo: 'Caja y arqueos', grupo: 'Tesorería', icono: 'caja', resumen: 'Una caja por punto de venta, arqueos por denominación y control de descuadres.', fase: 3 },
  { id: 'bancos', ruta: '/bancos', titulo: 'Bancos', grupo: 'Tesorería', icono: 'banco', resumen: 'Cuentas, movimientos y conciliación con importación de extractos en N43, Excel, CSV y PDF.', fase: 3 },
  { id: 'stock', ruta: '/stock', titulo: 'Stock', grupo: 'Operativa', icono: 'stock', resumen: 'Maestro de artículos, multi-almacén, valoración a coste medio e inventario.', fase: 4 },
  { id: 'importacion', ruta: '/importacion', titulo: 'Importación', grupo: 'Sistema', icono: 'importar', resumen: 'Carga de Excel, CSV y PDF con mapeo de columnas y previsualización validada.', fase: 5 },
  { id: 'deudas', ruta: '/deudas', titulo: 'Deudas', grupo: 'Tesorería', icono: 'deuda', resumen: 'Préstamos, leasing y acreedores con cuadro de amortización y vencimientos.', fase: 6 },
  { id: 'deudores', ruta: '/deudores', titulo: 'Deudores', grupo: 'Tesorería', icono: 'deudor', resumen: 'Cobros pendientes, antigüedad de saldos y provisión por insolvencia.', fase: 6 },
  { id: 'presupuesto', ruta: '/presupuesto', titulo: 'Presupuesto y cash flow', grupo: 'Planificación', icono: 'presupuesto', resumen: 'Presupuesto anual por centro de coste y cash flow con desviación vs. real.', fase: 7 },
  { id: 'tesoreria', ruta: '/tesoreria', titulo: 'Previsión de tesorería', grupo: 'Planificación', icono: 'tesoreria', resumen: 'Saldo diario proyectado a 30/60/90 días con alerta de tensión de liquidez.', fase: 7 },
  { id: 'informes', ruta: '/informes', titulo: 'Listados e informes', grupo: 'Dirección', icono: 'informe', resumen: 'Libros de IVA, balance, P&G y el informe ejecutivo mensual en PDF.', fase: 9 },
  { id: 'copias', ruta: '/copias', titulo: 'Copias de seguridad', grupo: 'Sistema', icono: 'copia', resumen: 'Backup y restauración con exportación completa en formato abierto.', fase: 10 },
  { id: 'grupo', ruta: '/grupo', titulo: 'Grupo de empresas', grupo: 'Sistema', icono: 'grupo', resumen: 'Alta de sociedades, organigrama de participaciones y cifras agregadas del grupo.', fase: 13 },
  { id: 'configuracion', ruta: '/configuracion', titulo: 'Configuración', grupo: 'Sistema', icono: 'ajustes', resumen: 'Empresa, centros de coste, plan contable, impuestos, umbrales y apariencia.', fase: 1 },
]

export function moduloPorRuta(ruta: string): Modulo | undefined {
  return MODULOS.find((m) => m.ruta === ruta)
}
