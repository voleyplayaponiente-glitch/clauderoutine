/**
 * Estado global (Zustand) + persistencia en IndexedDB con debounce.
 * En la Fase 0 gestiona configuración y tema; los módulos operativos irán
 * añadiendo su porción de estado fase a fase.
 */
import { create } from 'zustand'
import type { Configuracion } from '../dominio/tipos'
import { configuracionInicial } from '../dominio/defaults'
import { cargarConfig, guardarConfig, cargarTema, guardarTema } from '../lib/db'

type Tema = 'claro' | 'oscuro'

interface Estado {
  loaded: boolean
  tema: Tema
  config: Configuracion
  init: () => Promise<void>
  alternarTema: () => void
  actualizarConfig: (parcial: Partial<Configuracion>) => void
  reemplazarConfig: (config: Configuracion) => void
}

let debounce: ReturnType<typeof setTimeout> | undefined
function persistirConDebounce(config: Configuracion) {
  clearTimeout(debounce)
  debounce = setTimeout(() => void guardarConfig(config), 400)
}

export const useStore = create<Estado>((set, get) => ({
  loaded: false,
  tema: 'claro',
  config: configuracionInicial(),

  init: async () => {
    const [config, tema] = await Promise.all([cargarConfig(), cargarTema()])
    set({
      config: config ? migrarConfig(config) : configuracionInicial(),
      tema: tema ?? (prefiereOscuro() ? 'oscuro' : 'claro'),
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
