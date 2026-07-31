/**
 * Estado global (Zustand) + persistencia en IndexedDB con debounce.
 * En la Fase 0 gestiona configuración y tema; los módulos operativos irán
 * añadiendo su porción de estado fase a fase.
 */
import { create } from 'zustand'
import type { Configuracion, DatosOperativos, Tercero, Venta, Compra, GastoRecurrente, CuentaTesoreria, MovimientoTesoreria, ArqueoCaja, Almacen, Articulo, MovimientoStock, PlantillaImportacion, LoteImportacion, Deuda, DeudorVario, Presupuesto, Conector, LogSync } from '../dominio/tipos'
import { configuracionInicial } from '../dominio/defaults'
import { cargarConfig, guardarConfig, cargarTema, guardarTema, cargarDatos, guardarDatos } from '../lib/db'

type Tema = 'claro' | 'oscuro'

function datosIniciales(): DatosOperativos {
  return { terceros: [], ventas: [], compras: [], recurrentes: [], cuentasTesoreria: [], movimientos: [], arqueos: [], almacenes: [], articulos: [], movimientosStock: [], importaciones: [], deudas: [], deudores: [], presupuestos: [], logsSync: [] }
}

/** Colección de datos que recibe cada destino de importación. */
const COLECCION_DESTINO: Record<string, keyof DatosOperativos> = {
  articulos: 'articulos',
  terceros: 'terceros',
  'movimientos-banco': 'movimientos',
}

interface Estado {
  loaded: boolean
  tema: Tema
  config: Configuracion
  datos: DatosOperativos
  init: () => Promise<void>
  alternarTema: () => void
  actualizarConfig: (parcial: Partial<Configuracion>) => void
  reemplazarConfig: (config: Configuracion) => void
  // Datos operativos
  guardarTercero: (t: Tercero) => void
  guardarVenta: (v: Venta) => void
  anularVenta: (id: string) => void
  guardarCompra: (c: Compra) => void
  anularCompra: (id: string) => void
  guardarRecurrente: (r: GastoRecurrente) => void
  eliminarRecurrente: (id: string) => void
  // Tesorería
  guardarCuentaTesoreria: (c: CuentaTesoreria) => void
  guardarMovimiento: (m: MovimientoTesoreria) => void
  anularMovimiento: (id: string) => void
  importarMovimientos: (ms: MovimientoTesoreria[]) => number
  conciliarMovimiento: (id: string, conciliado: boolean) => void
  guardarArqueo: (a: ArqueoCaja) => void
  // Stock
  guardarAlmacen: (a: Almacen) => void
  guardarArticulo: (a: Articulo) => void
  anularArticulo: (id: string) => void
  guardarMovimientoStock: (m: MovimientoStock) => void
  guardarMovimientosStock: (ms: MovimientoStock[]) => void
  anularMovimientoStock: (id: string) => void
  // Importación
  guardarPlantilla: (p: PlantillaImportacion) => void
  eliminarPlantilla: (id: string) => void
  aplicarImportacion: (destinoId: string, entidades: { id: string }[], nombreFichero: string) => LoteImportacion
  deshacerImportacion: (loteId: string) => void
  // Deudas y deudores
  guardarDeuda: (d: Deuda) => void
  anularDeuda: (id: string) => void
  guardarDeudor: (d: DeudorVario) => void
  anularDeudor: (id: string) => void
  guardarPresupuesto: (p: Presupuesto) => void
  // Conectores
  guardarConector: (c: Conector) => void
  eliminarConector: (id: string) => void
  guardarLogSync: (l: LogSync) => void
  reemplazarDatos: (d: DatosOperativos) => void
  restaurarTodo: (config: Configuracion, datos: DatosOperativos) => void
}

let debounce: ReturnType<typeof setTimeout> | undefined
function persistirConDebounce(config: Configuracion) {
  clearTimeout(debounce)
  debounce = setTimeout(() => void guardarConfig(config), 400)
}

let debounceDatos: ReturnType<typeof setTimeout> | undefined
function persistirDatos(datos: DatosOperativos) {
  clearTimeout(debounceDatos)
  debounceDatos = setTimeout(() => void guardarDatos(datos), 400)
}

/** Inserta o reemplaza por id en una lista inmutable. */
function upsert<T extends { id: string }>(lista: T[], item: T): T[] {
  const i = lista.findIndex((x) => x.id === item.id)
  if (i === -1) return [...lista, item]
  const copia = lista.slice()
  copia[i] = item
  return copia
}

export const useStore = create<Estado>((set, get) => ({
  loaded: false,
  tema: 'claro',
  config: configuracionInicial(),
  datos: datosIniciales(),

  init: async () => {
    const [config, tema, datos] = await Promise.all([cargarConfig(), cargarTema(), cargarDatos()])
    set({
      config: config ? migrarConfig(config) : configuracionInicial(),
      tema: tema ?? (prefiereOscuro() ? 'oscuro' : 'claro'),
      datos: datos ? { ...datosIniciales(), ...datos } : datosIniciales(),
      loaded: true,
    })
    // Si no había nada guardado, deja la config inicial persistida.
    if (!config) void guardarConfig(get().config)
    // Copia de seguridad automática diaria (retención gestionada en la capa lib).
    void import('../lib/copias').then((m) => m.crearSnapshotDiario(get().config, get().datos, new Date().toISOString()))
  },

  alternarTema: () => {
    const tema: Tema = get().tema === 'oscuro' ? 'claro' : 'oscuro'
    set({ tema })
    void guardarTema(tema)
  },

  actualizarConfig: (parcial) => {
    const config = { ...get().config, ...parcial }
    set({ config })
    persistirConDebounce(config)
  },

  reemplazarConfig: (config) => {
    set({ config })
    persistirConDebounce(config)
  },

  guardarTercero: (t) => {
    const datos = { ...get().datos, terceros: upsert(get().datos.terceros, t) }
    set({ datos })
    persistirDatos(datos)
  },
  guardarVenta: (v) => {
    const datos = { ...get().datos, ventas: upsert(get().datos.ventas, v) }
    set({ datos })
    persistirDatos(datos)
  },
  anularVenta: (id) => {
    const ventas = get().datos.ventas.map((v) => (v.id === id ? { ...v, anuladoEn: new Date().toISOString() } : v))
    const datos = { ...get().datos, ventas }
    set({ datos })
    persistirDatos(datos)
  },
  guardarCompra: (c) => {
    const datos = { ...get().datos, compras: upsert(get().datos.compras, c) }
    set({ datos })
    persistirDatos(datos)
  },
  anularCompra: (id) => {
    const compras = get().datos.compras.map((c) => (c.id === id ? { ...c, anuladoEn: new Date().toISOString() } : c))
    const datos = { ...get().datos, compras }
    set({ datos })
    persistirDatos(datos)
  },
  guardarRecurrente: (r) => {
    const datos = { ...get().datos, recurrentes: upsert(get().datos.recurrentes, r) }
    set({ datos })
    persistirDatos(datos)
  },
  eliminarRecurrente: (id) => {
    const datos = { ...get().datos, recurrentes: get().datos.recurrentes.filter((r) => r.id !== id) }
    set({ datos })
    persistirDatos(datos)
  },

  guardarCuentaTesoreria: (c) => {
    const datos = { ...get().datos, cuentasTesoreria: upsert(get().datos.cuentasTesoreria, c) }
    set({ datos })
    persistirDatos(datos)
  },
  guardarMovimiento: (m) => {
    const datos = { ...get().datos, movimientos: upsert(get().datos.movimientos, m) }
    set({ datos })
    persistirDatos(datos)
  },
  anularMovimiento: (id) => {
    const movimientos = get().datos.movimientos.map((m) => (m.id === id ? { ...m, anuladoEn: new Date().toISOString() } : m))
    const datos = { ...get().datos, movimientos }
    set({ datos })
    persistirDatos(datos)
  },
  importarMovimientos: (ms) => {
    // Idempotencia: no duplica por (cuenta, fecha, importe, referencia).
    const existentes = new Set(
      get().datos.movimientos.map((m) => `${m.cuentaId}|${m.fecha}|${m.importe}|${m.referencia ?? ''}`),
    )
    const nuevos = ms.filter((m) => !existentes.has(`${m.cuentaId}|${m.fecha}|${m.importe}|${m.referencia ?? ''}`))
    if (nuevos.length === 0) return 0
    const datos = { ...get().datos, movimientos: [...get().datos.movimientos, ...nuevos] }
    set({ datos })
    persistirDatos(datos)
    return nuevos.length
  },
  conciliarMovimiento: (id, conciliado) => {
    const movimientos = get().datos.movimientos.map((m) => (m.id === id ? { ...m, conciliado } : m))
    const datos = { ...get().datos, movimientos }
    set({ datos })
    persistirDatos(datos)
  },
  guardarArqueo: (a) => {
    const datos = { ...get().datos, arqueos: upsert(get().datos.arqueos, a) }
    set({ datos })
    persistirDatos(datos)
  },

  guardarAlmacen: (a) => {
    const datos = { ...get().datos, almacenes: upsert(get().datos.almacenes, a) }
    set({ datos })
    persistirDatos(datos)
  },
  guardarArticulo: (a) => {
    const datos = { ...get().datos, articulos: upsert(get().datos.articulos, a) }
    set({ datos })
    persistirDatos(datos)
  },
  anularArticulo: (id) => {
    const articulos = get().datos.articulos.map((a) => (a.id === id ? { ...a, anuladoEn: new Date().toISOString() } : a))
    const datos = { ...get().datos, articulos }
    set({ datos })
    persistirDatos(datos)
  },
  guardarMovimientoStock: (m) => {
    const datos = { ...get().datos, movimientosStock: upsert(get().datos.movimientosStock, m) }
    set({ datos })
    persistirDatos(datos)
  },
  guardarMovimientosStock: (ms) => {
    const datos = { ...get().datos, movimientosStock: [...get().datos.movimientosStock, ...ms] }
    set({ datos })
    persistirDatos(datos)
  },
  anularMovimientoStock: (id) => {
    const movimientosStock = get().datos.movimientosStock.map((m) => (m.id === id ? { ...m, anuladoEn: new Date().toISOString() } : m))
    const datos = { ...get().datos, movimientosStock }
    set({ datos })
    persistirDatos(datos)
  },

  guardarPlantilla: (p) => {
    const config = { ...get().config, plantillasImportacion: upsert(get().config.plantillasImportacion, p) }
    set({ config })
    persistirConDebounce(config)
  },
  eliminarPlantilla: (id) => {
    const config = { ...get().config, plantillasImportacion: get().config.plantillasImportacion.filter((p) => p.id !== id) }
    set({ config })
    persistirConDebounce(config)
  },
  aplicarImportacion: (destinoId, entidades, nombreFichero) => {
    const coleccion = COLECCION_DESTINO[destinoId]
    const lote: LoteImportacion = { id: 'lote-' + Math.random().toString(36).slice(2), fecha: new Date().toISOString(), destinoId, nombreFichero, ids: entidades.map((e) => e.id) }
    const datos = { ...get().datos }
    if (coleccion) {
      datos[coleccion] = [...(datos[coleccion] as { id: string }[]), ...entidades] as any
    }
    datos.importaciones = [...datos.importaciones, lote]
    set({ datos })
    persistirDatos(datos)
    return lote
  },
  deshacerImportacion: (loteId) => {
    const lote = get().datos.importaciones.find((l) => l.id === loteId)
    if (!lote) return
    const coleccion = COLECCION_DESTINO[lote.destinoId]
    const ids = new Set(lote.ids)
    const datos = { ...get().datos }
    if (coleccion) {
      datos[coleccion] = (datos[coleccion] as { id: string }[]).filter((x) => !ids.has(x.id)) as any
    }
    datos.importaciones = datos.importaciones.filter((l) => l.id !== loteId)
    set({ datos })
    persistirDatos(datos)
  },

  guardarDeuda: (d) => {
    const datos = { ...get().datos, deudas: upsert(get().datos.deudas, d) }
    set({ datos })
    persistirDatos(datos)
  },
  anularDeuda: (id) => {
    const deudas = get().datos.deudas.map((x) => (x.id === id ? { ...x, anuladoEn: new Date().toISOString() } : x))
    const datos = { ...get().datos, deudas }
    set({ datos })
    persistirDatos(datos)
  },
  guardarDeudor: (d) => {
    const datos = { ...get().datos, deudores: upsert(get().datos.deudores, d) }
    set({ datos })
    persistirDatos(datos)
  },
  anularDeudor: (id) => {
    const deudores = get().datos.deudores.map((x) => (x.id === id ? { ...x, anuladoEn: new Date().toISOString() } : x))
    const datos = { ...get().datos, deudores }
    set({ datos })
    persistirDatos(datos)
  },
  guardarPresupuesto: (p) => {
    const datos = { ...get().datos, presupuestos: upsert(get().datos.presupuestos, p) }
    set({ datos })
    persistirDatos(datos)
  },

  guardarConector: (c) => {
    const config = { ...get().config, conectores: upsert(get().config.conectores, c) }
    set({ config })
    persistirConDebounce(config)
  },
  eliminarConector: (id) => {
    const config = { ...get().config, conectores: get().config.conectores.filter((c) => c.id !== id) }
    set({ config })
    persistirConDebounce(config)
  },
  guardarLogSync: (l) => {
    const datos = { ...get().datos, logsSync: [l, ...get().datos.logsSync].slice(0, 100) }
    set({ datos })
    persistirDatos(datos)
  },
  reemplazarDatos: (d) => {
    set({ datos: d })
    persistirDatos(d)
  },
  restaurarTodo: (config, datos) => {
    const c = migrarConfig(config)
    const d = { ...datosIniciales(), ...datos }
    set({ config: c, datos: d })
    void guardarConfig(c)
    void guardarDatos(d)
  },
}))

function prefiereOscuro(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

/** Rellena campos ausentes en configuraciones guardadas con versiones anteriores. */
function migrarConfig(c: Partial<Configuracion>): Configuracion {
  const base = configuracionInicial()
  return {
    empresa: { ...base.empresa, ...c.empresa },
    centrosCoste: c.centrosCoste ?? base.centrosCoste,
    planContable: c.planContable ?? base.planContable,
    tiposIva: c.tiposIva ?? base.tiposIva,
    impuestosEspeciales: c.impuestosEspeciales ?? base.impuestosEspeciales,
    obligacionesFiscales: c.obligacionesFiscales ?? base.obligacionesFiscales,
    categoriasGasto: c.categoriasGasto ?? base.categoriasGasto,
    umbrales: { ...base.umbrales, ...c.umbrales },
    apariencia: { ...base.apariencia, ...c.apariencia },
    plantillasImportacion: c.plantillasImportacion ?? base.plantillasImportacion,
    conectores: c.conectores ?? base.conectores,
  }
}
