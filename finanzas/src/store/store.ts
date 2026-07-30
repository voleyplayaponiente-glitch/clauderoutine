/**
 * Estado global (Zustand) + persistencia en IndexedDB con debounce.
 * En la Fase 0 gestiona configuración y tema; los módulos operativos irán
 * añadiendo su porción de estado fase a fase.
 */
import { create } from 'zustand'
import type { Configuracion, DatosOperativos, Tercero, Venta, Compra, GastoRecurrente } from '../dominio/tipos'
import { configuracionInicial } from '../dominio/defaults'
import { cargarConfig, guardarConfig, cargarTema, guardarTema, cargarDatos, guardarDatos } from '../lib/db'

type Tema = 'claro' | 'oscuro'

function datosIniciales(): DatosOperativos {
  return { terceros: [], ventas: [], compras: [], recurrentes: [] }
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
  reemplazarDatos: (d: DatosOperativos) => void
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
  reemplazarDatos: (d) => {
    set({ datos: d })
    persistirDatos(d)
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
  }
}
