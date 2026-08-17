/**
 * El juego de categorías con el que arranca un espacio nuevo.
 *
 * Está pensado para España y para gente real: la vivienda separa hipoteca de
 * comunidad e IBI porque son tres recibos distintos, y hay una categoría de
 * «Sin clasificar» porque forzar a decidir en el momento de apuntar un gasto es
 * la forma más rápida de que se deje de apuntar.
 *
 * `tipo` es lo que hace útil el presupuesto: los fijos no se recortan este mes,
 * los variables se pueden ajustar y los discrecionales son la palanca real.
 * `esencial` es lo que separa «vivir» de «vivir bien», y alimenta el colchón de
 * emergencia (que se mide contra los gastos esenciales, no contra el total).
 */

export type FlujoCategoria = 'gasto' | 'ingreso'
export type TipoCategoria = 'fijo' | 'variable' | 'discrecional'

export interface CategoriaDefecto {
  nombre: string
  flujo: FlujoCategoria
  tipo: TipoCategoria
  esencial: boolean
  icono: string
  hijas?: { nombre: string; tipo?: TipoCategoria; esencial?: boolean }[]
}

export const CATEGORIAS_DEFECTO: readonly CategoriaDefecto[] = [
  {
    nombre: 'Vivienda',
    flujo: 'gasto',
    tipo: 'fijo',
    esencial: true,
    icono: 'casa',
    hijas: [
      { nombre: 'Alquiler o hipoteca' },
      { nombre: 'Comunidad' },
      { nombre: 'IBI y tasas' },
      { nombre: 'Reformas y mantenimiento', tipo: 'variable', esencial: false },
    ],
  },
  {
    nombre: 'Suministros',
    flujo: 'gasto',
    tipo: 'fijo',
    esencial: true,
    icono: 'rayo',
    hijas: [
      { nombre: 'Luz' },
      { nombre: 'Agua' },
      { nombre: 'Gas' },
      { nombre: 'Internet y móvil' },
    ],
  },
  {
    nombre: 'Alimentación',
    flujo: 'gasto',
    tipo: 'variable',
    esencial: true,
    icono: 'cesta',
    hijas: [
      { nombre: 'Supermercado' },
      { nombre: 'Mercado y panadería' },
      { nombre: 'Comida a domicilio', tipo: 'discrecional', esencial: false },
    ],
  },
  {
    nombre: 'Transporte',
    flujo: 'gasto',
    tipo: 'variable',
    esencial: true,
    icono: 'coche',
    hijas: [
      { nombre: 'Combustible' },
      { nombre: 'Transporte público' },
      { nombre: 'Seguro del coche', tipo: 'fijo' },
      { nombre: 'ITV y taller' },
      { nombre: 'Parking y peajes' },
    ],
  },
  {
    nombre: 'Salud',
    flujo: 'gasto',
    tipo: 'variable',
    esencial: true,
    icono: 'salud',
    hijas: [
      { nombre: 'Farmacia' },
      { nombre: 'Seguro médico', tipo: 'fijo' },
      { nombre: 'Dentista y óptica' },
    ],
  },
  {
    nombre: 'Seguros',
    flujo: 'gasto',
    tipo: 'fijo',
    esencial: true,
    icono: 'escudo',
    hijas: [{ nombre: 'Hogar' }, { nombre: 'Vida' }, { nombre: 'Otros seguros' }],
  },
  {
    nombre: 'Educación',
    flujo: 'gasto',
    tipo: 'fijo',
    esencial: true,
    icono: 'libro',
    hijas: [
      { nombre: 'Colegio y universidad' },
      { nombre: 'Material y libros', tipo: 'variable' },
      { nombre: 'Formación', tipo: 'discrecional', esencial: false },
    ],
  },
  {
    nombre: 'Ocio',
    flujo: 'gasto',
    tipo: 'discrecional',
    esencial: false,
    icono: 'copa',
    hijas: [
      { nombre: 'Restaurantes' },
      { nombre: 'Bares y cafés' },
      { nombre: 'Cine, teatro y conciertos' },
      { nombre: 'Suscripciones', tipo: 'fijo' },
      { nombre: 'Viajes' },
      { nombre: 'Deporte y gimnasio', tipo: 'fijo' },
    ],
  },
  {
    nombre: 'Compras',
    flujo: 'gasto',
    tipo: 'discrecional',
    esencial: false,
    icono: 'bolsa',
    hijas: [
      { nombre: 'Ropa y calzado' },
      { nombre: 'Hogar y muebles' },
      { nombre: 'Electrónica' },
      { nombre: 'Regalos' },
    ],
  },
  {
    nombre: 'Cuidado personal',
    flujo: 'gasto',
    tipo: 'variable',
    esencial: false,
    icono: 'persona',
    hijas: [{ nombre: 'Peluquería y estética' }, { nombre: 'Mascotas' }],
  },
  {
    nombre: 'Impuestos y tasas',
    flujo: 'gasto',
    tipo: 'fijo',
    esencial: true,
    icono: 'documento',
    hijas: [{ nombre: 'IRPF' }, { nombre: 'Autónomos' }, { nombre: 'Otros impuestos' }],
  },
  {
    nombre: 'Deudas',
    flujo: 'gasto',
    tipo: 'fijo',
    esencial: true,
    icono: 'deuda',
    hijas: [
      { nombre: 'Intereses' },
      { nombre: 'Comisiones bancarias' },
      { nombre: 'Amortización anticipada', tipo: 'discrecional', esencial: false },
    ],
  },
  {
    nombre: 'Ahorro e inversión',
    flujo: 'gasto',
    tipo: 'fijo',
    esencial: false,
    icono: 'semilla',
    hijas: [
      { nombre: 'Aportación a inversión' },
      { nombre: 'Fondo de emergencia' },
      { nombre: 'Plan de pensiones' },
    ],
  },
  {
    nombre: 'Sin clasificar',
    flujo: 'gasto',
    tipo: 'variable',
    esencial: false,
    icono: 'interrogante',
  },

  // Ingresos. Son pocos a propósito: el detalle de cada nómina o factura vive en
  // su fuente de ingreso, no en una categoría.
  {
    nombre: 'Nómina',
    flujo: 'ingreso',
    tipo: 'fijo',
    esencial: true,
    icono: 'nomina',
  },
  {
    nombre: 'Facturación',
    flujo: 'ingreso',
    tipo: 'variable',
    esencial: true,
    icono: 'factura',
  },
  {
    nombre: 'Alquileres',
    flujo: 'ingreso',
    tipo: 'fijo',
    esencial: false,
    icono: 'casa',
  },
  {
    nombre: 'Rendimientos',
    flujo: 'ingreso',
    tipo: 'variable',
    esencial: false,
    icono: 'grafico',
    hijas: [{ nombre: 'Dividendos' }, { nombre: 'Intereses' }],
  },
  {
    nombre: 'Otros ingresos',
    flujo: 'ingreso',
    tipo: 'variable',
    esencial: false,
    icono: 'mas',
    hijas: [{ nombre: 'Devoluciones' }, { nombre: 'Venta de segunda mano' }],
  },
]

/** Cuántas categorías se crean en total al abrir un espacio. Útil en los tests. */
export function totalCategoriasDefecto(): number {
  return CATEGORIAS_DEFECTO.reduce((total, c) => total + 1 + (c.hijas?.length ?? 0), 0)
}
